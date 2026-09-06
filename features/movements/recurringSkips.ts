import { logSupabaseError, supabase } from '../../lib/supabase';

export type RecurringSkipKind = 'income' | 'fixed';

/**
 * One shared `recurring_skips` table backs both replication engines
 * (ensureRecurringIncomeForMonth and ensureFixedCategoryMovementsForMonth)
 * instead of two near-identical ones -- this prefix is what keeps a
 * recurring_income_id and a fixed_series_id (both plain uuids, so
 * collision-prone on their own) from ever being confused with each other.
 */
export function buildRecurringSkipKey(kind: RecurringSkipKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Records that this user explicitly deleted the `fecha`-month instance of
 * a recurring series, so it must never be silently regenerated again. Uses
 * upsert (not insert) so deleting the same already-skipped instance twice
 * -- unlikely, but not impossible if a request retries -- doesn't throw on
 * the table's own unique(series_key, fecha) constraint. Best-effort by
 * design: callers should not let a failure here block the movement delete
 * itself, which is the user's actual request -- see deleteMovement's own
 * comment in features/movements/api.ts.
 */
export async function recordRecurringSkip(seriesKey: string, fecha: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('recurring_skips')
    .upsert({ user_id: userId, series_key: seriesKey, fecha }, { onConflict: 'series_key,fecha' });
  if (error) {
    logSupabaseError('recordRecurringSkip', error);
  }
}

/** True if this exact (series, month) was explicitly deleted before and must not be regenerated. */
export async function isRecurringSkipped(seriesKey: string, fecha: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('recurring_skips')
    .select('id')
    .eq('series_key', seriesKey)
    .eq('fecha', fecha)
    .maybeSingle();
  if (error) {
    logSupabaseError('isRecurringSkipped', error);
    throw error;
  }
  return data !== null;
}

/**
 * Every fixed_series_id skipped for this exact month, as a plain id set --
 * ensureFixedCategoryMovementsForMonth checks potentially many independent
 * series at once (one per recurring line item a fija category holds), so
 * this fetches them all in one query instead of one round-trip per series.
 */
export async function fetchSkippedFixedSeriesIds(fecha: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('recurring_skips')
    .select('series_key')
    .eq('fecha', fecha)
    .like('series_key', 'fixed:%');
  if (error) {
    logSupabaseError('fetchSkippedFixedSeriesIds', error);
    throw error;
  }
  return new Set((data ?? []).map((row) => (row.series_key as string).slice('fixed:'.length)));
}
