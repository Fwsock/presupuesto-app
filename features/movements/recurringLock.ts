import type { Movement } from './types';

/**
 * True when this movement was auto-generated from a recurring income config
 * (fijo or variable) — see supabase/migrations/0003_profiles_and_recurring_income.sql
 * and features/income/api.ts's submitIncomeForMonth. Its amount/concepto can
 * only be edited from Cuenta, so Movimientos must lock the pagado/pendiente
 * switch and hide the edit action for it, and warn harder before deleting it.
 */
export function isRecurringGeneratedMovement(movement: Pick<Movement, 'recurring_income_id'>): boolean {
  return movement.recurring_income_id !== null;
}
