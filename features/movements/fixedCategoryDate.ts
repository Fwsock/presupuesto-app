/** Days in `year`-`month` (1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Re-dates an existing 'YYYY-MM-DD' movement fecha into `targetYear`/`targetMonth`,
 * keeping the same day-of-month where possible -- clamped down when the
 * target month is shorter (e.g. day 31 in a 30-day month becomes 30). Pure
 * so it's unit-testable separately from the Supabase calls in
 * features/movements/fixedCategories.ts that use it.
 */
export function shiftFechaToMonth(fecha: string, targetYear: number, targetMonth: number): string {
  const day = Number(fecha.slice(8, 10));
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}
