export type RecurringIncomeType = 'fijo' | 'variable';

export interface RecurringIncome {
  id: string;
  user_id: string;
  concepto: string;
  tipo: RecurringIncomeType;
  /** Only set for tipo='fijo' — a 'variable' income's amount lives on each month's generated movement instead. */
  monto: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertRecurringIncomeInput {
  concepto: string;
  tipo: RecurringIncomeType;
  monto: number | null;
  activo: boolean;
}
