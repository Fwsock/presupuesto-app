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
    // Tie-breaker independent of `direction`: rows that tie on the primary
    // field (most commonly same-date movements, grouped together by
    // MovementDateSectionHeader) always show the most recently created one
    // first, regardless of which way the primary sort is toggled -- e.g.
    // two movements both dated today, the one just added shows above one
    // added yesterday for today's date. Falls back to `id` only for full
    // determinism on the practically-impossible case of an exact
    // created_at tie.
    const byCreatedAt = b.created_at.localeCompare(a.created_at);
    if (byCreatedAt !== 0) return byCreatedAt;
    return a.id.localeCompare(b.id);
  });
}

/** Case-insensitive substring match on `concepto`; an empty/blank query returns every movement unchanged. */
export function filterMovementsByQuery(movements: Movement[], query: string): Movement[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return movements;
  return movements.filter((m) => m.concepto.toLowerCase().includes(normalized));
}
