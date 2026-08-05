import type { Movement } from './types';

export interface MovementDateGroup {
  fecha: string;
  /** Signed sum for the day: ingreso adds, gasto subtracts -- matches the sign shown on each row's amount. */
  totalDelDia: number;
  data: Movement[];
}

/**
 * Groups `movements` by their `fecha`, one section per distinct day, ordered
 * newest-first. Does not itself sort within a day -- callers that also sort
 * (features/movements/sort.ts) should sort before grouping.
 */
export function groupMovementsByDate(movements: Movement[]): MovementDateGroup[] {
  const byFecha = new Map<string, Movement[]>();
  for (const movement of movements) {
    const existing = byFecha.get(movement.fecha);
    if (existing) existing.push(movement);
    else byFecha.set(movement.fecha, [movement]);
  }

  return [...byFecha.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, data]) => ({
      fecha,
      totalDelDia: data.reduce((sum, m) => sum + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0),
      data,
    }));
}
