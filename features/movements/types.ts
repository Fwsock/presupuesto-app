export type MovementStatus = 'pendiente' | 'pagado';

export interface Movement {
  id: string;
  user_id: string;
  category_id: string;
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
  /** Set when this movement was auto-generated from a recurring income (fijo or variable) — see features/movements/recurringLock.ts for the lock this implies in Movimientos. */
  recurring_income_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewMovementInput {
  categoryId: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  icono: string;
}

export interface UpdateMovementInput {
  id: string;
  categoryId: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  icono: string;
}
