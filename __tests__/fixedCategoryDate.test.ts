import { shiftFechaToMonth } from '../features/movements/fixedCategoryDate';

describe('shiftFechaToMonth', () => {
  it('keeps the same day when the target month has enough days', () => {
    expect(shiftFechaToMonth('2026-01-15', 2026, 3)).toBe('2026-03-15');
  });

  it('clamps the day down when the target month is shorter', () => {
    expect(shiftFechaToMonth('2026-01-31', 2026, 2)).toBe('2026-02-28');
  });

  it('clamps to 29 in a leap-year February', () => {
    expect(shiftFechaToMonth('2027-01-31', 2028, 2)).toBe('2028-02-29');
  });

  it('pads single-digit month and day', () => {
    expect(shiftFechaToMonth('2026-01-05', 2026, 9)).toBe('2026-09-05');
  });
});
