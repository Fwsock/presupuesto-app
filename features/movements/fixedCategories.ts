import { logSupabaseError, supabase } from '../../lib/supabase';
import { fetchCategories } from '../categories/api';
import { computeFixedCategoryReplications } from './fixedCategoryReplication';
import type { Movement } from './types';

function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Called when the user views a given month (Resumen/Movimientos), same
 * contract as ensureRecurringIncomeForMonth (features/income/api.ts):
 * silently creates this month's copy of every "fija" category's recurring
 * movement series that doesn't have one yet. Safe to call repeatedly -- each
 * series is only replicated once per month (checked by fixed_series_id
 * membership before inserting).
 *
 * Unlike recurring income, there can be any number of independent series
 * (one per distinct recurring line item a fija category holds, e.g. "Luz"
 * and "Agua" both under "Servicios"), so this works off fixed_series_id
 * chains instead of a single per-user config row.
 */
export async function ensureFixedCategoryMovementsForMonth(year: number, month: number): Promise<void> {
  const categories = await fetchCategories();
  const fixedCategoryIds = categories.filter((c) => c.es_fija).map((c) => c.id);
  if (fixedCategoryIds.length === 0) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const monthStart = firstDayOfMonth(year, month);
  const nextMonthDate = new Date(year, month, 1);
  const nextMonthStart = firstDayOfMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1);

  // Latest instance of each series from any month before the one being
  // viewed -- the template that gets copied forward.
  const { data: priorMovements, error: priorError } = await supabase
    .from('movements')
    .select('*')
    .in('category_id', fixedCategoryIds)
    .not('fixed_series_id', 'is', null)
    .lt('fecha', monthStart)
    .order('fecha', { ascending: false });
  if (priorError) {
    logSupabaseError('ensureFixedCategoryMovementsForMonth (prior)', priorError);
    throw priorError;
  }
  if (!priorMovements || priorMovements.length === 0) return;

  // This month's movements from those same series, so already-replicated
  // ones aren't duplicated on a repeat view of the month.
  const { data: currentMonthMovements, error: currentError } = await supabase
    .from('movements')
    .select('fixed_series_id')
    .in('category_id', fixedCategoryIds)
    .not('fixed_series_id', 'is', null)
    .gte('fecha', monthStart)
    .lt('fecha', nextMonthStart);
  if (currentError) {
    logSupabaseError('ensureFixedCategoryMovementsForMonth (current)', currentError);
    throw currentError;
  }
  const alreadyPresent = new Set((currentMonthMovements ?? []).map((m) => m.fixed_series_id as string));

  const toInsert = computeFixedCategoryReplications(
    priorMovements as Movement[],
    alreadyPresent,
    year,
    month,
    userId
  );
  if (toInsert.length === 0) return;

  const { error: insertError } = await supabase.from('movements').insert(toInsert);
  if (insertError) {
    logSupabaseError('ensureFixedCategoryMovementsForMonth (insert)', insertError);
    throw insertError;
  }
}
