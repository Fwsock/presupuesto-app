import type { Category } from '../categories/types';
import type { Movement } from './types';
import { calculateMonthSummary } from './summary';

export interface MonthlySaldoPoint {
  year: number;
  month: number;
  saldoDisponible: number;
  totalIngresos: number;
  totalGastos: number;
  hasMovements: boolean;
}

export function monthOffset(year: number, month: number, offset: number): { year: number; month: number } {
  const zeroBasedMonth = month - 1 + offset;
  const newYear = year + Math.floor(zeroBasedMonth / 12);
  const newMonth = (((zeroBasedMonth % 12) + 12) % 12) + 1;
  return { year: newYear, month: newMonth };
}

/**
 * Average monthly gasto across an "active period baseline": only points
 * that are already over (year/month <= today) AND have a real recorded
 * gasto (> 0) count toward the divisor. A future month in the chart's
 * window always starts at $0 (nothing can have been spent yet, it hasn't
 * happened), and a past month with genuinely nothing logged isn't a
 * meaningful data point either -- counting either drags the average down
 * artificially, understating what a "normal" month actually costs (seen in
 * practice: a mostly-empty 7-month window made every real month of
 * spending look like a multi-hundred-percent spike above "average").
 * `today` is injectable for deterministic tests -- defaults to the real
 * clock for actual chart usage.
 */
export function calculateAverageGasto(points: MonthlySaldoPoint[], today: Date = new Date()): number {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const activePoints = points.filter((p) => {
    const isPastOrPresent = p.year < todayYear || (p.year === todayYear && p.month <= todayMonth);
    return isPastOrPresent && p.totalGastos > 0;
  });
  if (activePoints.length === 0) return 0;
  return activePoints.reduce((sum, p) => sum + p.totalGastos, 0) / activePoints.length;
}

export function buildMonthlySaldoSeries(
  movements: Movement[],
  categories: Category[],
  months: { year: number; month: number }[]
): MonthlySaldoPoint[] {
  return months.map(({ year, month }) => {
    const monthMovements = movements.filter((m) => {
      const y = Number(m.fecha.slice(0, 4));
      const mo = Number(m.fecha.slice(5, 7));
      return y === year && mo === month;
    });
    const summary = calculateMonthSummary(monthMovements, categories);
    return {
      year,
      month,
      saldoDisponible: summary.saldoDisponible,
      totalIngresos: summary.totalIngresos,
      totalGastos: summary.totalGastos,
      hasMovements: monthMovements.length > 0,
    };
  });
}
