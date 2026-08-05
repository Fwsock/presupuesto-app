// One-off admin script: loads the real August budget from
// datos_presupuesto.json into Supabase for a single user, replacing
// whatever test data existed for them.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env (service_role bypasses RLS,
// which is required both to look up a user by email via the admin API and
// to write rows belonging to a user this script isn't authenticated as).
//
// Run with: node scripts/seed-presupuesto.js
// Add --dry-run to only print the plan without touching the database.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

// Trimmed copy of features/movements/iconSuggestion.ts's rules -- that file
// is TS inside the Expo/Metro project and this script runs under plain
// Node, so the logic is duplicated here rather than imported.
const DEFAULT_ICON = 'receipt-outline';
const ICON_RULES = [
  { keywords: ['luz', 'electricidad'], icon: 'flash-outline' },
  { keywords: ['agua'], icon: 'water-outline' },
  { keywords: ['celular', 'telefono', 'entel', 'wom', 'claro', 'movistar', 'plan movil'], icon: 'call-outline' },
  { keywords: ['iptv', 'netflix', 'streaming'], icon: 'film-outline' },
  { keywords: ['gimnasio', 'gym'], icon: 'fitness-outline' },
  { keywords: ['zapatillas', 'ropa'], icon: 'shirt-outline' },
  { keywords: ['celular xiaomi', 'xiaomi'], icon: 'phone-portrait-outline' },
  { keywords: ['tarjeta', 'credito', 'cmr', 'impuesto', 'administracion'], icon: 'card-outline' },
  { keywords: ['auto', 'credito auto'], icon: 'car-outline' },
  { keywords: ['supermercado', 'lider', 'feria'], icon: 'cart-outline' },
  { keywords: ['cine', 'cinepolis', 'pelicula'], icon: 'film-outline' },
  { keywords: ['transferencia', 'santander', 'mama', 'bb'], icon: 'swap-horizontal-outline' },
  { keywords: ['ahorro'], icon: 'wallet-outline' },
  { keywords: ['sueldo', 'salario', 'ingreso'], icon: 'cash-outline' },
  { keywords: ['seguro', 'bupa', 'integramedica'], icon: 'medical-outline' },
  { keywords: ['claude'], icon: 'sparkles-outline' },
  { keywords: ['polla'], icon: 'people-outline' },
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function suggestIcon(concepto) {
  const normalized = normalize(concepto);
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
      return rule.icon;
    }
  }
  return DEFAULT_ICON;
}

// Category definitions -- es_fija is true whenever at least one movement in
// that group is es_fijo:true in the source JSON, since that's what unlocks
// the "this category can hold recurring items" behavior in the app.
const CATEGORY_DEFS = [
  { key: 'Ingresos', esFija: true },
  { key: 'Gastos Fijos', esFija: true },
  { key: 'CMR Falabella', esFija: true },
  { key: 'Cuotas/Crédito', esFija: true },
  { key: 'Gastos Extras', esFija: false },
  { key: 'Ahorro', esFija: true },
];

function buildMovements(data) {
  const rows = [];

  for (const item of data.ingresos) {
    rows.push({ ...item, categoria: 'Ingresos', tipo: 'ingreso' });
  }
  for (const item of data.gastos_fijos) rows.push({ ...item, tipo: 'gasto' });
  for (const item of data.cmr_falabella) rows.push({ ...item, tipo: 'gasto' });
  for (const item of data.cuotas_credito) rows.push({ ...item, tipo: 'gasto' });
  for (const item of data.gastos_extras) rows.push({ ...item, tipo: 'gasto' });
  for (const item of data.ahorro) rows.push({ ...item, tipo: 'gasto' });

  return rows;
}

async function findUserIdByEmail(supabase, email) {
  // supabase-js v2's admin.listUsers() is paginated; a dev project's user
  // count is small, but page through properly instead of assuming page 1
  // has everyone.
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const dataPath = path.join(__dirname, '..', 'datos_presupuesto.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const recurring = data.ingreso_mensual_recurrente;

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`Buscando usuario ${data.usuario_email}...`);
  const userId = await findUserIdByEmail(supabase, data.usuario_email);
  if (!userId) {
    throw new Error(`No se encontró ningún usuario con el email ${data.usuario_email}`);
  }
  console.log(`user_id: ${userId}`);

  const movementRows = buildMovements(data);
  const total = (rows) => rows.reduce((sum, r) => sum + r.monto, 0);
  console.log(`\nPlan: ${CATEGORY_DEFS.length} categorías, ${movementRows.length} movimientos.`);
  console.log(`Total ingresos: $${total(data.ingresos).toLocaleString('es-CL')}`);
  console.log(
    `Total gastos: $${(
      total(data.gastos_fijos) +
      total(data.cmr_falabella) +
      total(data.cuotas_credito) +
      total(data.gastos_extras) +
      total(data.ahorro)
    ).toLocaleString('es-CL')}`
  );
  console.log(`Ingreso mensual recurrente (Sueldo): $${recurring.monto.toLocaleString('es-CL')} (no cuenta en 'Total ingresos' de arriba -- se calcula aparte)`);

  if (DRY_RUN) {
    console.log('\n--dry-run: no se modificó la base de datos.');
    return;
  }

  // 1. Delete existing data for this user. Movements first -- categories
  // has `on delete restrict` from movements.category_id, so deleting
  // categories first would fail while old movements still reference them.
  console.log('\nBorrando movimientos existentes...');
  const { error: delMovementsError, count: deletedMovements } = await supabase
    .from('movements')
    .delete({ count: 'exact' })
    .eq('user_id', userId);
  if (delMovementsError) throw delMovementsError;
  console.log(`  ${deletedMovements ?? 0} movimientos eliminados.`);

  console.log('Borrando categorías existentes...');
  const { error: delCategoriesError, count: deletedCategories } = await supabase
    .from('categories')
    .delete({ count: 'exact' })
    .eq('user_id', userId);
  if (delCategoriesError) throw delCategoriesError;
  console.log(`  ${deletedCategories ?? 0} categorías eliminadas.`);

  // Sueldo is driven by recurring_income, not a plain movement (see
  // datos_presupuesto.json's `ingreso_mensual_recurrente` and the rule that
  // the monthly salary must never also appear as a regular Ingresos row --
  // that would double-count it). Upsert the user's recurring_income row to
  // match the real monto, then materialize August's own movement for it
  // directly here (rather than waiting for ensureRecurringIncomeForMonth to
  // do it lazily on first app view) so verify-presupuesto.js reports the
  // correct totals immediately after this script runs.
  console.log('\nConfigurando ingreso mensual recurrente (Sueldo)...');
  const { data: existingRecurring, error: fetchRecurringError } = await supabase
    .from('recurring_income')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fetchRecurringError) throw fetchRecurringError;

  let recurringIncomeId;
  if (existingRecurring) {
    const { error: updateRecurringError } = await supabase
      .from('recurring_income')
      .update({ concepto: recurring.concepto, tipo: recurring.tipo, monto: recurring.monto, activo: true })
      .eq('id', existingRecurring.id);
    if (updateRecurringError) throw updateRecurringError;
    recurringIncomeId = existingRecurring.id;
    console.log(`  recurring_income actualizado (${existingRecurring.id}) -> monto $${recurring.monto.toLocaleString('es-CL')}`);
  } else {
    const { data: createdRecurring, error: createRecurringError } = await supabase
      .from('recurring_income')
      .insert({ user_id: userId, concepto: recurring.concepto, tipo: recurring.tipo, monto: recurring.monto, activo: true })
      .select('id')
      .single();
    if (createRecurringError) throw createRecurringError;
    recurringIncomeId = createdRecurring.id;
    console.log(`  recurring_income creado (${createdRecurring.id}) -> monto $${recurring.monto.toLocaleString('es-CL')}`);
  }

  // 2. Create categories, keep name -> id map.
  console.log('\nCreando categorías...');
  const categoryIdByName = {};
  for (const def of CATEGORY_DEFS) {
    const { data: created, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, nombre: def.key, es_fija: def.esFija })
      .select()
      .single();
    if (error) throw error;
    categoryIdByName[def.key] = created.id;
    console.log(`  ${def.key} (${def.esFija ? 'fija' : 'variable'}) -> ${created.id}`);
  }

  // 3. Insert movements.
  console.log('\nInsertando movimientos...');
  const rowsToInsert = movementRows.map((item) => {
    // A movement belongs to a fixed-category replication chain (gets a
    // fixed_series_id) whenever either: (a) it's marked es_fijo:true (an
    // indefinite recurring item -- Luz, Agua, Gimnasio...), or (b) it
    // carries cuota_actual/cuotas_totales inside a fija category (an
    // installment purchase whose monthly replication must still run, but
    // stops once the cuota lifecycle completes -- see
    // features/movements/fixedCategoryReplication.ts's cuotasCompleted).
    const hasCuotas = item.cuota_actual != null && item.cuotas_totales != null;
    const isReplicatingSeries = item.es_fijo === true || hasCuotas;
    return {
      user_id: userId,
      category_id: categoryIdByName[item.categoria],
      tipo: item.tipo,
      concepto: item.descripcion,
      monto: item.monto,
      notas: item.notas ?? null,
      estado: item.estado,
      fecha: item.fecha,
      installment_group_id: null,
      cuota_numero: hasCuotas ? item.cuota_actual : null,
      cuota_total: hasCuotas ? item.cuotas_totales : null,
      icono: suggestIcon(item.descripcion),
      recurring_income_id: null,
      fixed_series_id: isReplicatingSeries ? crypto.randomUUID() : null,
    };
  });

  // August's own Sueldo movement -- generated here (not left for the app to
  // lazily create on first view) so this script's own totals, and
  // verify-presupuesto.js right after it, already reflect the real number.
  rowsToInsert.push({
    user_id: userId,
    category_id: categoryIdByName['Ingresos'],
    tipo: 'ingreso',
    concepto: recurring.concepto,
    monto: recurring.monto,
    notas: null,
    estado: 'pagado',
    fecha: '2026-08-01',
    installment_group_id: null,
    cuota_numero: null,
    cuota_total: null,
    icono: suggestIcon(recurring.concepto),
    recurring_income_id: recurringIncomeId,
    fixed_series_id: null,
  });

  const { data: inserted, error: insertError } = await supabase.from('movements').insert(rowsToInsert).select();
  if (insertError) throw insertError;
  console.log(`  ${inserted.length} movimientos insertados.`);

  // 4. Verification pass -- counts and totals from what's actually in the
  // database now, not just what we intended to send.
  console.log('\nVerificando...');
  const { data: finalMovements, error: verifyError } = await supabase
    .from('movements')
    .select('tipo, monto, estado')
    .eq('user_id', userId);
  if (verifyError) throw verifyError;

  const finalIngresos = finalMovements.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const finalGastos = finalMovements.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0);
  console.log(`  Movimientos en BD: ${finalMovements.length} (esperado ${rowsToInsert.length})`);
  console.log(`  Total ingresos en BD: $${finalIngresos.toLocaleString('es-CL')}`);
  console.log(`  Total gastos en BD: $${finalGastos.toLocaleString('es-CL')}`);

  if (finalMovements.length !== rowsToInsert.length) {
    throw new Error('El conteo final de movimientos no coincide con lo insertado -- revisar antes de usar la app.');
  }

  console.log('\nListo.');
}

main().catch((err) => {
  console.error('\nERROR:', err.message || err);
  process.exit(1);
});
