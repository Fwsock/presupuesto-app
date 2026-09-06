import { logSupabaseError, supabase } from '../../lib/supabase';
import { sanitizeText, sanitizeNullableText } from '../shared/sanitize';
import { buildRecurringSkipKey, recordRecurringSkip } from './recurringSkips';
import type { InstallmentRow } from './installments';
import type { Movement, NewMovementInput, UpdateMovementInput } from './types';

export async function fetchMovementsForMonth(year: number, month: number): Promise<Movement[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(year, month, 1);
  const to = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .gte('fecha', from)
    .lt('fecha', to)
    .order('fecha', { ascending: true });
  if (error) {
    logSupabaseError('fetchMovementsForMonth', error);
    throw error;
  }
  return data;
}

/**
 * Fetches every movement in a window of consecutive months centered on
 * (centerYear, centerMonth) — one range query instead of N per-month ones.
 * Used by the Resumen chart, which needs several months of data at once.
 */
export async function fetchMovementsForMonthRange(
  centerYear: number,
  centerMonth: number,
  monthsBefore: number,
  monthsAfter: number
): Promise<Movement[]> {
  const startDate = new Date(centerYear, centerMonth - 1 - monthsBefore, 1);
  const endDate = new Date(centerYear, centerMonth + monthsAfter, 1);
  const from = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  const to = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .gte('fecha', from)
    .lt('fecha', to)
    .order('fecha', { ascending: true });
  if (error) {
    logSupabaseError('fetchMovementsForMonthRange', error);
    throw error;
  }
  return data;
}

export async function createMovement(input: NewMovementInput): Promise<Movement> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('movements')
    .insert({
      user_id: userId,
      category_id: input.categoryId,
      tipo: input.tipo,
      concepto: sanitizeText(input.concepto, 120),
      monto: input.monto,
      notas: sanitizeNullableText(input.notas, 500),
      estado: input.estado,
      fecha: input.fecha,
      icono: input.icono,
      fixed_series_id: input.fixedSeriesId ?? null,
    })
    .select()
    .single();
  if (error) {
    logSupabaseError('createMovement', error);
    throw error;
  }
  return data;
}

export async function createInstallments(rows: InstallmentRow[]): Promise<Movement[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('movements')
    .insert(rows.map((row) => ({ ...row, user_id: userId })))
    .select();
  if (error) {
    logSupabaseError('createInstallments', error);
    throw error;
  }
  return data;
}

export async function updateMovement(input: UpdateMovementInput): Promise<Movement> {
  const { data, error } = await supabase
    .from('movements')
    .update({
      category_id: input.categoryId,
      tipo: input.tipo,
      concepto: sanitizeText(input.concepto, 120),
      monto: input.monto,
      notas: sanitizeNullableText(input.notas, 500),
      estado: input.estado,
      fecha: input.fecha,
      icono: input.icono,
    })
    .eq('id', input.id)
    .select()
    .single();
  if (error) {
    logSupabaseError('updateMovement', error);
    throw error;
  }
  return data;
}

/**
 * Raw delete by id, with no recurring-skip bookkeeping -- used internally
 * by flows that remove a row as an implementation detail of replacing it
 * with something else (e.g. useConvertMovementToInstallments swaps a
 * standalone movement for its first cuota), not as the user asking to
 * permanently remove a recurring instance. Prefer deleteMovement below for
 * anything reachable from a user-facing "eliminar" action.
 */
export async function deleteMovementById(id: string): Promise<void> {
  const { error } = await supabase.from('movements').delete().eq('id', id);
  if (error) {
    logSupabaseError('deleteMovementById', error);
    throw error;
  }
}

/**
 * Deletes one movement, and -- if it was an auto-generated recurring
 * instance (recurring income or a fixed-category series) -- records a skip
 * for that exact (series, month) first, so ensureRecurringIncomeForMonth /
 * ensureFixedCategoryMovementsForMonth never regenerate it on a later
 * refresh or app restart (the "regeneración fantasma" bug). Only the id,
 * fecha, recurring_income_id and fixed_series_id are needed -- callers
 * already have the full Movement in hand (from the list they're deleting
 * from), so this takes a narrow Pick instead of forcing a re-fetch.
 */
export async function deleteMovement(
  movement: Pick<Movement, 'id' | 'fecha' | 'recurring_income_id' | 'fixed_series_id'>
): Promise<void> {
  await deleteMovementById(movement.id);

  // Best-effort, and only AFTER the delete succeeds: the user's actual
  // request (removing the movement) must never be blocked by a failure to
  // record bookkeeping about it -- worst case on failure here is the old
  // phantom-regeneration bug reappearing for this one instance, not lost
  // data or an error the user didn't ask for.
  const seriesKey = movement.recurring_income_id
    ? buildRecurringSkipKey('income', movement.recurring_income_id)
    : movement.fixed_series_id
      ? buildRecurringSkipKey('fixed', movement.fixed_series_id)
      : null;
  if (seriesKey) {
    const monthStart = `${movement.fecha.slice(0, 7)}-01`;
    await recordRecurringSkip(seriesKey, monthStart);
  }
}

export async function deleteMovementGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('movements').delete().eq('installment_group_id', groupId);
  if (error) {
    logSupabaseError('deleteMovementGroup', error);
    throw error;
  }
}

/**
 * Updates `cuota_total` on the rows of a group that come BEFORE
 * `fromCuotaNumero`, without touching their monto/fecha/estado -- keeps
 * already-paid (or otherwise untouched) cuotas showing the new grand total
 * (e.g. "cuota 2/8") after the remaining cuotas from `fromCuotaNumero`
 * onward get regenerated with a different count.
 */
export async function updateInstallmentGroupTotal(
  groupId: string,
  newTotalCuotas: number,
  fromCuotaNumero: number
): Promise<void> {
  const { error } = await supabase
    .from('movements')
    .update({ cuota_total: newTotalCuotas })
    .eq('installment_group_id', groupId)
    .lt('cuota_numero', fromCuotaNumero);
  if (error) {
    logSupabaseError('updateInstallmentGroupTotal', error);
    throw error;
  }
}

/** Deletes a group's rows from `fromCuotaNumero` onward (inclusive) — the tail about to be replaced by a fresh split via createInstallments. */
export async function deleteInstallmentsFrom(groupId: string, fromCuotaNumero: number): Promise<void> {
  const { error } = await supabase
    .from('movements')
    .delete()
    .eq('installment_group_id', groupId)
    .gte('cuota_numero', fromCuotaNumero);
  if (error) {
    logSupabaseError('deleteInstallmentsFrom', error);
    throw error;
  }
}

/** Marks every pendiente movement of one category, in one month, as pagado. */
export async function payAllPendingForCategory(
  categoryId: string,
  year: number,
  month: number
): Promise<Movement[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(year, month, 1);
  const to = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('movements')
    .update({ estado: 'pagado' })
    .eq('category_id', categoryId)
    .eq('estado', 'pendiente')
    .gte('fecha', from)
    .lt('fecha', to)
    .select();
  if (error) {
    logSupabaseError('payAllPendingForCategory', error);
    throw error;
  }
  return data;
}
