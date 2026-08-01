/**
 * True when `value` is a real calendar date in YYYY-MM-DD form.
 *
 * Date.parse alone is not enough: JS rolls overflowing days over, so
 * Date.parse('2026-02-31') and Date.parse('2026-02-29') both return valid
 * timestamps even though Postgres rejects those dates outright. Round-tripping
 * through Date.UTC and comparing the components back catches them.
 */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

// Local-timezone conversion (not UTC) so the DateTimePicker doesn't shift the
// day across midnight. Both helpers round-trip via local getters.
export function parseISODate(value: string): Date | null {
  if (!isValidISODate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 'YYYY-MM-DD' -> 'DD-MM-YYYY' for display in the date field.
export function formatDisplayDate(value: string): string {
  if (!isValidISODate(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
}
