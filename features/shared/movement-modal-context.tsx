// features/shared/movement-modal-context.tsx
import { createContext, useContext } from 'react';
import type { Movement } from '../movements/types';

export interface MovementModalController {
  openCreate: () => void;
  openEdit: (movement: Movement) => void;
}

export const MovementModalContext = createContext<MovementModalController | null>(null);

/**
 * Lets any screen open the shared create/edit movement modal that's actually
 * rendered once at the (app) layout level — see app/(app)/_layout.tsx. This
 * is what lets the center tab-bar "+" button (any tab) and Movimientos' row
 * edit action (only on Movimientos) drive the same modal instance.
 */
export function useMovementModal(): MovementModalController {
  const ctx = useContext(MovementModalContext);
  if (!ctx) throw new Error('useMovementModal must be used within the (app) layout');
  return ctx;
}
