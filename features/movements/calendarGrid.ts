function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export interface CalendarDay {
  year: number;
  /** 1-12. This is the DAY's own month, which may differ from the grid's target month for leading/trailing padding cells. */
  month: number;
  day: number;
  isCurrentMonth: boolean;
}

/**
 * Monday-start, 6-week (42-cell) calendar grid for `month` (1-12) of `year`,
 * padded with real day numbers from the adjacent months so every month
 * renders the same height (no layout jump switching between a 4-week and a
 * 6-week month) and so a padding cell can still show a real day number
 * instead of blank space.
 */
export function buildCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  // JS getDay(): Sunday=0..Saturday=6. Convert to Monday-start: Monday=0..Sunday=6.
  const leadingCount = (firstOfMonth.getDay() + 6) % 7;
  const totalDaysThisMonth = daysInMonth(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthDays = daysInMonth(prevYear, prevMonth);

  const cells: CalendarDay[] = [];

  for (let i = leadingCount - 1; i >= 0; i--) {
    cells.push({ year: prevYear, month: prevMonth, day: prevMonthDays - i, isCurrentMonth: false });
  }

  for (let d = 1; d <= totalDaysThisMonth; d++) {
    cells.push({ year, month, day: d, isCurrentMonth: true });
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ year: nextYear, month: nextMonth, day: nextDay, isCurrentMonth: false });
    nextDay += 1;
  }

  return cells;
}
