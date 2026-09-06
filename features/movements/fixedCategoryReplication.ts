import { shiftFechaToMonth } from './fixedCategoryDate';
import type { Movement } from './types';

export interface NewFixedMovementRow {
  user_id: string;
  category_id: string;
  tipo: Movement['tipo'];
  concepto: string;
  monto: number;
  notas: string | null;
  estado: 'pendiente';
  fecha: string;
  icono: string;
  fixed_series_id: string;
  cuota_numero: number | null;
  cuota_total: number | null;
}

/** True once a cuota series has already replicated its last installment -- the fija category's "replicate indefinitely" rule stops applying to it from that point on. */
function cuotasCompleted(m: Movement): boolean {
  return m.cuota_total !== null && m.cuota_numero !== null && m.cuota_numero >= m.cuota_total;
}

/**
 * Whether a freshly-created movement should start a new fixed-category
 * series (get its own fixed_series_id). True only for `gasto` movements
 * under a fija category -- `ingreso` is excluded even there, because income
 * recurrence is exclusively the profile's single recurring-income
 * mechanism (features/income/api.ts's ensureRecurringIncomeForMonth,
 * "INGRESO BASE PERFIL": the only income that auto-replicates, regardless
 * of its own category). Without this exclusion, a one-off ingreso filed
 * under a fija category -- e.g. a friend's one-time "Transferencia de
 * Alvaro" logged under an "Ingresos" category someone later marked fija --
 * would spuriously start replicating forever, indistinguishable from a
 * real recurring bill. Used by MovementFormModal at creation time; see
 * this file's own filter below for the matching defense-in-depth check on
 * the replication side, which also protects any row that slipped through
 * before this function existed.
 */
export function shouldStartFixedSeries(categoryEsFija: boolean, tipo: Movement['tipo']): boolean {
  return categoryEsFija && tipo === 'gasto';
}

/**
 * Pure decision logic behind ensureFixedCategoryMovementsForMonth
 * (features/movements/fixedCategories.ts), split out so the "jump straight
 * to a month far in the future" case can be unit-tested without a Supabase
 * connection.
 *
 * `priorMovements` is every fixed-category movement dated strictly before
 * the viewed month, REGARDLESS of how far back -- there is no requirement
 * that every month in between already has its own replica, which is what
 * makes a direct jump (e.g. Agosto 2026 -> Enero 2027) work in one step:
 * the latest prior instance of each series, however old, is still the
 * template that gets copied into the viewed month.
 *
 * A series whose latest instance carries cuota_numero/cuota_total (an
 * installment purchase living inside an otherwise-indefinite fija category,
 * e.g. "Zapatillas (cuota)" under CMR Falabella) stops replicating once
 * cuota_numero reaches cuota_total -- the cuota lifecycle overrides the
 * category's own "replicate forever" rule. A series with no cuotas
 * (cuota_numero/cuota_total both null, e.g. Luz, Agua) is unaffected and
 * keeps replicating indefinitely exactly as before.
 */
export function computeFixedCategoryReplications(
  priorMovements: Movement[],
  currentMonthSeriesIds: ReadonlySet<string>,
  year: number,
  month: number,
  userId: string
): NewFixedMovementRow[] {
  // Latest instance of each series -- priorMovements is expected sorted by
  // fecha descending, so the first occurrence per series is the newest one.
  const latestPerSeries = new Map<string, Movement>();
  for (const m of priorMovements) {
    const seriesId = m.fixed_series_id;
    if (seriesId && !latestPerSeries.has(seriesId)) {
      latestPerSeries.set(seriesId, m);
    }
  }

  return [...latestPerSeries.values()]
    // Defense-in-depth for the "Transferencia de Alvaro" bug: income
    // recurrence is exclusively ensureRecurringIncomeForMonth's job (see
    // shouldStartFixedSeries above) -- this filter also protects any row
    // that got a fixed_series_id before that rule existed, or from data
    // edited directly outside the app.
    .filter((m) => m.tipo !== 'ingreso')
    .filter((m) => !currentMonthSeriesIds.has(m.fixed_series_id as string))
    .filter((m) => !cuotasCompleted(m))
    .map((m) => ({
      user_id: userId,
      category_id: m.category_id,
      tipo: m.tipo,
      concepto: m.concepto,
      monto: m.monto,
      notas: m.notas,
      estado: 'pendiente' as const,
      fecha: shiftFechaToMonth(m.fecha, year, month),
      icono: m.icono,
      fixed_series_id: m.fixed_series_id as string,
      cuota_numero: m.cuota_numero === null ? null : m.cuota_numero + 1,
      cuota_total: m.cuota_total,
    }));
}
