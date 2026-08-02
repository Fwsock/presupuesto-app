import type { Category } from '../categories/types';
import type { Movement } from './types';
import { calculateMonthSummary } from './summary';

export interface MonthlySaldoPoint {
  year: number;
  month: number;
  saldoDisponible: number;
  hasMovements: boolean;
}

export function monthOffset(year: number, month: number, offset: number): { year: number; month: number } {
  const zeroBasedMonth = month - 1 + offset;
  const newYear = year + Math.floor(zeroBasedMonth / 12);
  const newMonth = (((zeroBasedMonth % 12) + 12) % 12) + 1;
  return { year: newYear, month: newMonth };
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
      hasMovements: monthMovements.length > 0,
    };
  });
}
