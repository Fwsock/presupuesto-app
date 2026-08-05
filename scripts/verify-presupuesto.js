// Read-only sanity check after seed-presupuesto.js: prints a full
// breakdown so it can be eyeballed against datos_presupuesto.json before
// trusting the app's UI.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
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

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = 'basti.guzman29@gmail.com';
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (userErr) throw userErr;
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error('Usuario no encontrado');

  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, nombre, es_fija')
    .eq('user_id', user.id)
    .order('nombre');
  if (catErr) throw catErr;

  const { data: movements, error: movErr } = await supabase
    .from('movements')
    .select('concepto, monto, tipo, estado, fecha, notas, category_id, cuota_numero, cuota_total, fixed_series_id, icono')
    .eq('user_id', user.id)
    .order('fecha');
  if (movErr) throw movErr;

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  console.log(`Usuario: ${email} (${user.id})\n`);
  console.log('=== Categorías ===');
  for (const c of categories) {
    console.log(`  ${c.nombre} -- es_fija: ${c.es_fija}`);
  }

  console.log('\n=== Movimientos por categoría ===');
  for (const c of categories) {
    const rows = movements.filter((m) => m.category_id === c.id);
    const total = rows.reduce((s, m) => s + Number(m.monto), 0);
    console.log(`\n${c.nombre} (${rows.length} movimientos, total $${total.toLocaleString('es-CL')}):`);
    for (const m of rows) {
      const cuota = m.cuota_numero ? ` [cuota ${m.cuota_numero}/${m.cuota_total}]` : '';
      const fija = m.fixed_series_id ? ' [FIJA→replica]' : '';
      console.log(
        `  - ${m.fecha} | ${m.tipo === 'ingreso' ? '+' : '-'}$${Number(m.monto).toLocaleString('es-CL')} | ${m.estado.padEnd(10)} | ${m.concepto}${cuota}${fija} | icono:${m.icono}`
      );
    }
  }

  const totalIngresos = movements.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const totalGastos = movements.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0);
  const pendientes = movements.filter((m) => m.estado === 'pendiente').length;
  const pagados = movements.filter((m) => m.estado === 'pagado').length;
  const fijos = movements.filter((m) => m.fixed_series_id).length;

  console.log('\n=== Resumen (todos los movimientos del usuario, cualquier mes) ===');
  console.log(`Total movimientos: ${movements.length}`);
  console.log(`Pagados: ${pagados} | Pendientes: ${pendientes}`);
  console.log(`Marcados como fijos (replicarán el mes siguiente): ${fijos}`);
  console.log(`Total ingresos: $${totalIngresos.toLocaleString('es-CL')}`);
  console.log(`Total gastos: $${totalGastos.toLocaleString('es-CL')}`);

  // This is the number the app itself would show for "Agosto 2026" --
  // calculateMonthSummary (features/movements/summary.ts) only sums
  // estado='pagado', and useMovements filters strictly by calendar month
  // (fecha >= '2026-08-01' AND fecha < '2026-09-01'). The unfiltered totals
  // above intentionally do NOT match this -- they're a raw sanity count
  // across every month currently in the table.
  const isAgosto2026 = (m) => m.fecha >= '2026-08-01' && m.fecha < '2026-09-01';
  const agostoPagados = movements.filter((m) => m.estado === 'pagado' && isAgosto2026(m));
  const agostoIngresos = agostoPagados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const agostoGastos = agostoPagados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0);
  const saldoAgosto = agostoIngresos - agostoGastos;

  console.log('\n=== Saldo disponible Agosto 2026 (fórmula real de la app: pagado + fecha en agosto) ===');
  console.log(`Ingresos pagados de agosto: $${agostoIngresos.toLocaleString('es-CL')}`);
  console.log(`Gastos pagados de agosto: $${agostoGastos.toLocaleString('es-CL')}`);
  console.log(`Saldo disponible (agosto): $${saldoAgosto.toLocaleString('es-CL')}`);
  const SALDO_ESPERADO = 271114;
  if (saldoAgosto !== SALDO_ESPERADO) {
    console.log(`\n*** ADVERTENCIA: saldo esperado $${SALDO_ESPERADO.toLocaleString('es-CL')}, pero se calculó $${saldoAgosto.toLocaleString('es-CL')} ***`);
  } else {
    console.log(`\nSaldo coincide exactamente con el objetivo de $${SALDO_ESPERADO.toLocaleString('es-CL')}.`);
  }

  // Structural sanity checks.
  const problems = [];
  for (const m of movements) {
    if (!['ingreso', 'gasto'].includes(m.tipo)) problems.push(`tipo inválido en "${m.concepto}": ${m.tipo}`);
    if (!['pendiente', 'pagado'].includes(m.estado)) problems.push(`estado inválido en "${m.concepto}": ${m.estado}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) problems.push(`fecha inválida en "${m.concepto}": ${m.fecha}`);
    if (!m.category_id || !categoryById[m.category_id]) problems.push(`categoría no resuelta en "${m.concepto}"`);
    if (Number(m.monto) <= 0) problems.push(`monto no positivo en "${m.concepto}": ${m.monto}`);
  }

  if (problems.length > 0) {
    console.log('\n=== PROBLEMAS ENCONTRADOS ===');
    problems.forEach((p) => console.log(`  - ${p}`));
    process.exit(1);
  }

  console.log('\nSin problemas estructurales detectados.');
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
