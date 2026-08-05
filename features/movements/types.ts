export type MovementStatus = 'pendiente' | 'pagado';
export type MovementType = 'ingreso' | 'gasto';

export interface Movement {
  id: string;
  user_id: string;
  category_id: string;
  /** Whether this movement is income or an expense — categories are neutral, this classifies the transaction itself. */
  tipo: MovementType;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  installment_group_id: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
  /** Ionicons name, decorative only — see features/movements/iconSuggestion.ts. */
  icono: string;
  /** Set when this movement was auto-generated from a recurring income (fijo o variable) — see features/movements/recurringLock.ts for the lock this implies in Movimientos. */
  recurring_income_id: string | null;
  /** Shared across every monthly replica of one recurring line item under a "fija" category — see features/movements/fixedCategories.ts. Unlike recurring_income_id, this does NOT lock the movement. */
  fixed_series_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewMovementInput {
  categoryId: string;
  tipo: MovementType;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  icono: string;
  /** Set only when creating the first movement of a new "fija" category series — see features/movements/fixedCategories.ts. */
  fixedSeriesId?: string | null;
}

export interface UpdateMovementInput {
  id: string;
  categoryId: string;
  tipo: MovementType;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  icono: string;
}
