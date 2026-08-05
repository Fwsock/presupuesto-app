import { buildCalendarGrid } from '../features/movements/calendarGrid';

describe('buildCalendarGrid', () => {
  it('always returns exactly 42 cells (6 Monday-start weeks)', () => {
    expect(buildCalendarGrid(2026, 2)).toHaveLength(42);
    expect(buildCalendarGrid(2024, 1)).toHaveLength(42);
    expect(buildCalendarGrid(2024, 2)).toHaveLength(42);
  });

  it('has zero leading padding when the month starts on a Monday (January 2024)', () => {
    const cells = buildCalendarGrid(2024, 1);
    expect(cells[0]).toEqual({ year: 2024, month: 1, day: 1, isCurrentMonth: true });
    expect(cells[30]).toEqual({ year: 2024, month: 1, day: 31, isCurrentMonth: true });
    // 31 days used, 11 trailing padding cells from February to reach 42.
    expect(cells[31]).toEqual({ year: 2024, month: 2, day: 1, isCurrentMonth: false });
    expect(cells[41]).toEqual({ year: 2024, month: 2, day: 11, isCurrentMonth: false });
  });

  it('pads a month that starts mid-week with real prior/next month day numbers (February 2026, starts on Sunday)', () => {
    const cells = buildCalendarGrid(2026, 2);
    // Monday-start week, Sunday start -> 6 leading padding days from January (26-31).
    expect(cells.slice(0, 6)).toEqual([
      { year: 2026, month: 1, day: 26, isCurrentMonth: false },
      { year: 2026, month: 1, day: 27, isCurrentMonth: false },
      { year: 2026, month: 1, day: 28, isCurrentMonth: false },
      { year: 2026, month: 1, day: 29, isCurrentMonth: false },
      { year: 2026, month: 1, day: 30, isCurrentMonth: false },
      { year: 2026, month: 1, day: 31, isCurrentMonth: false },
    ]);
    expect(cells[6]).toEqual({ year: 2026, month: 2, day: 1, isCurrentMonth: true });
    expect(cells[33]).toEqual({ year: 2026, month: 2, day: 28, isCurrentMonth: true });
    // 6 leading + 28 days = 34 cells used, 8 trailing padding cells from March.
    expect(cells[34]).toEqual({ year: 2026, month: 3, day: 1, isCurrentMonth: false });
    expect(cells[41]).toEqual({ year: 2026, month: 3, day: 8, isCurrentMonth: false });
  });

  it('handles a leap-year February correctly (2024, starts on Thursday)', () => {
    const cells = buildCalendarGrid(2024, 2);
    // Thursday start -> 3 leading padding days from January (29-31).
    expect(cells.slice(0, 3)).toEqual([
      { year: 2024, month: 1, day: 29, isCurrentMonth: false },
      { year: 2024, month: 1, day: 30, isCurrentMonth: false },
      { year: 2024, month: 1, day: 31, isCurrentMonth: false },
    ]);
    expect(cells[3]).toEqual({ year: 2024, month: 2, day: 1, isCurrentMonth: true });
    expect(cells[31]).toEqual({ year: 2024, month: 2, day: 29, isCurrentMonth: true });
    // 3 leading + 29 days = 32 cells used, 10 trailing padding cells from March.
    expect(cells[32]).toEqual({ year: 2024, month: 3, day: 1, isCurrentMonth: false });
    expect(cells[41]).toEqual({ year: 2024, month: 3, day: 10, isCurrentMonth: false });
  });

  it('rolls year boundaries correctly: December padding trails into next-year January, January padding leads from prior-year December', () => {
    // December 2026 starts on a Tuesday -> 1 leading padding cell from
    // November 30, 2026; 31 real days; 10 trailing cells from January 2027.
    const decCells = buildCalendarGrid(2026, 12);
    expect(decCells[0]).toEqual({ year: 2026, month: 11, day: 30, isCurrentMonth: false });
    expect(decCells[1]).toEqual({ year: 2026, month: 12, day: 1, isCurrentMonth: true });
    expect(decCells[31]).toEqual({ year: 2026, month: 12, day: 31, isCurrentMonth: true });
    expect(decCells[32]).toEqual({ year: 2027, month: 1, day: 1, isCurrentMonth: false });
    expect(decCells[41]).toEqual({ year: 2027, month: 1, day: 10, isCurrentMonth: false });

    // January 2027 starts on a Friday -> 4 leading padding cells from
    // December 28-31, 2026; 31 real days; 7 trailing cells from February 2027.
    const janCells = buildCalendarGrid(2027, 1);
    expect(janCells.slice(0, 4)).toEqual([
      { year: 2026, month: 12, day: 28, isCurrentMonth: false },
      { year: 2026, month: 12, day: 29, isCurrentMonth: false },
      { year: 2026, month: 12, day: 30, isCurrentMonth: false },
      { year: 2026, month: 12, day: 31, isCurrentMonth: false },
    ]);
    expect(janCells[4]).toEqual({ year: 2027, month: 1, day: 1, isCurrentMonth: true });
    expect(janCells[34]).toEqual({ year: 2027, month: 1, day: 31, isCurrentMonth: true });
    expect(janCells[35]).toEqual({ year: 2027, month: 2, day: 1, isCurrentMonth: false });
    expect(janCells[41]).toEqual({ year: 2027, month: 2, day: 7, isCurrentMonth: false });
  });
});
