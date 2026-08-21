// features/shared/movement-filter-context.tsx
import { createContext, useContext } from 'react';

export interface MovementFilterController {
  categoryFilter: string | undefined;
  setCategoryFilter: (categoryId: string | undefined) => void;
}

export const MovementFilterContext = createContext<MovementFilterController | null>(null);

/**
 * Deliberately NOT backed by `useLocalSearchParams()` / route params: this
 * value is real React state owned by the (app) layout (see
 * app/(app)/_layout.tsx), so clearing it on the Movimientos tab's `tabPress`
 * is a plain, synchronous `setCategoryFilter(undefined)` -- no dependency on
 * how expo-router/React Navigation resolve or merge params for a NAVIGATE
 * action on an already-mounted tab screen, which is what made the filter
 * "leak" back in across a tab-bar visit even after re-navigating to the bare
 * path with no params.
 */
export function useMovementFilter(): MovementFilterController {
  const ctx = useContext(MovementFilterContext);
  if (!ctx) throw new Error('useMovementFilter must be used within the (app) layout');
  return ctx;
}
