import type { Movement } from './types';

export type MovementSortField = 'fecha' | 'monto' | 'nombre';
export type SortDirection = 'asc' | 'desc';

/** Sorts a copy of `movements` by the given field; never mutates the input. */
export function sortMovements(movements: Movement[], field: MovementSortField, direction: SortDirection): Movement[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...movements].sort((a, b) => {
    let primary: number;
    if (field === 'fecha') primary = a.fecha.localeCompare(b.fecha);
    else if (field === 'monto') primary = a.monto - b.monto;
    else primary = a.concepto.localeCompare(b.concepto, 'es', { sensitivity: 'base' });
    if (primary !== 0) return sign * primary;
    // Stable tie-breaker independent of `direction`/array-order, so rows
    // that tie on the primary field (e.g. same-date movements) never
    // visually reorder just because the underlying cache array shifted.
    return a.id.localeCompare(b.id);
  });
}

/** Case-insensitive substring match on `concepto`; an empty/blank query returns every movement unchanged. */
export function filterMovementsByQuery(movements: Movement[], query: string): Movement[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return movements;
  return movements.filter((m) => m.concepto.toLowerCase().includes(normalized));
}
