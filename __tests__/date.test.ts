import { isValidISODate, formatLongDate, formatSectionHeaderDate } from '../features/movements/date';

describe('isValidISODate', () => {
  it('accepts real calendar dates in YYYY-MM-DD form', () => {
    expect(isValidISODate('2026-07-31')).toBe(true);
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // 2024 is a leap year
    expect(isValidISODate('2026-12-31')).toBe(true);
  });

  it('rejects wrong formats', () => {
    expect(isValidISODate('31/07/2026')).toBe(false);
    expect(isValidISODate('2026-7-3')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate('hoy')).toBe(false);
  });

  it('rejects dates that do not exist, including ones Date.parse accepts', () => {
    expect(isValidISODate('2026-13-45')).toBe(false);
    expect(isValidISODate('2026-00-10')).toBe(false);
    expect(isValidISODate('2026-01-32')).toBe(false);
    // Date.parse rolls these over to a valid timestamp; Postgres rejects them.
    expect(isValidISODate('2026-02-31')).toBe(false);
    expect(isValidISODate('2026-02-29')).toBe(false); // 2026 is not a leap year
  });
});

describe('formatLongDate', () => {
  it('formats as "day de Month" without a leading zero on the day', () => {
    expect(formatLongDate('2026-08-12')).toBe('12 de Agosto');
    expect(formatLongDate('2026-08-05')).toBe('5 de Agosto');
  });

  it('returns the raw value for an invalid date', () => {
    expect(formatLongDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatSectionHeaderDate', () => {
  it('prefixes "HOY" when fecha matches todayISO', () => {
    expect(formatSectionHeaderDate('2026-08-04', '2026-08-04')).toBe('HOY · 04 de Agosto');
  });

  it('omits the prefix for any other date', () => {
    expect(formatSectionHeaderDate('2026-08-03', '2026-08-04')).toBe('03 de Agosto');
  });

  it('pads single-digit days with a leading zero', () => {
    expect(formatSectionHeaderDate('2026-08-01', '2026-08-04')).toBe('01 de Agosto');
  });
});
