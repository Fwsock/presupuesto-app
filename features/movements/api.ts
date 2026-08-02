import { logSupabaseError, supabase } from '../../lib/supabase';
import type { InstallmentRow } from './installments';
import type { Movement, NewMovementInput, UpdateMovementInput } from './types';

export async function fetchMovementsForMonth(year: number, month: number): Promise<Movement[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(year, month, 1);
  const to = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .gte('fecha', from)
    .lt('fecha', to)
    .order('fecha', { ascending: true });
  if (error) {
    logSupabaseError('fetchMovementsForMonth', error);
    throw error;
  }
  return data;
}

/**
 * Fetches every movement in a window of consecutive months centered on
 * (centerYear, centerMonth) — one range query instead of N per-month ones.
 * Used by the Resumen chart, which needs several months of data at once.
 */
export async function fetchMovementsForMonthRange(
  centerYear: number,
  centerMonth: number,
  monthsBefore: number,
  monthsAfter: number
): Promise<Movement[]> {
  const startDate = new Date(centerYear, centerMonth - 1 - monthsBefore, 1);
  const endDate = new Date(centerYear, centerMonth + monthsAfter, 1);
  const from = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  const to = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .gte('fecha', from)
    .lt('fecha', to)
    .order('fecha', { ascending: true });
  if (error) {
    logSupabaseError('fetchMovementsForMonthRange', error);
    throw error;
  }
  return data;
}

export async function createMovement(input: NewMovementInput): Promise<Movement> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('movements')
    .insert({
      user_id: userId,
      category_id: input.categoryId,
      concepto: input.concepto,
      monto: input.monto,
      notas: input.notas,
      estado: input.estado,
      fecha: input.fecha,
    })
    .select()
    .single();
  if (error) {
    logSupabaseError('createMovement', error);
    throw error;
  }
  return data;
}

export async function createInstallments(rows: InstallmentRow[]): Promise<Movement[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('movements')
    .insert(rows.map((row) => ({ ...row, user_id: userId })))
    .select();
  if (error) {
    logSupabaseError('createInstallments', error);
    throw error;
  }
  return data;
}

export async function updateMovement(input: UpdateMovementInput): Promise<Movement> {
  const { data, error } = await supabase
    .from('movements')
    .update({
      category_id: input.categoryId,
      concepto: input.concepto,
      monto: input.monto,
      notas: input.notas,
      estado: input.estado,
      fecha: input.fecha,
    })
    .eq('id', input.id)
    .select()
    .single();
  if (error) {
    logSupabaseError('updateMovement', error);
    throw error;
  }
  return data;
}

export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from('movements').delete().eq('id', id);
  if (error) {
    logSupabaseError('deleteMovement', error);
    throw error;
  }
}

export async function deleteMovementGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('movements').delete().eq('installment_group_id', groupId);
  if (error) {
    logSupabaseError('deleteMovementGroup', error);
    throw error;
  }
}
