import { logSupabaseError, supabase } from '../../lib/supabase';
import { fetchCategories, createCategory } from '../categories/api';
import { suggestMovementIcon } from '../movements/iconSuggestion';
import type { Movement } from '../movements/types';
import type { RecurringIncome, UpsertRecurringIncomeInput } from './types';

export async function fetchRecurringIncome(): Promise<RecurringIncome | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('recurring_income')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) {
    logSupabaseError('fetchRecurringIncome', error);
    throw error;
  }
  return data[0] ?? null;
}

export async function upsertRecurringIncome(input: UpsertRecurringIncomeInput): Promise<RecurringIncome> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const existing = await fetchRecurringIncome();
  const payload = { concepto: input.concepto, tipo: input.tipo, monto: input.monto, activo: input.activo };

  if (existing) {
    const { data, error } = await supabase
      .from('recurring_income')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      logSupabaseError('upsertRecurringIncome (update)', error);
      throw error;
    }
    return data;
  }

  const { data, error } = await supabase
    .from('recurring_income')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) {
    logSupabaseError('upsertRecurringIncome (insert)', error);
    throw error;
  }
  return data;
}

export async function deleteRecurringIncome(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_income').delete().eq('id', id);
  if (error) {
    logSupabaseError('deleteRecurringIncome', error);
    throw error;
  }
}

/** Finds the user's "Ingresos" category, creating it if this is the first recurring income ever configured. */
async function resolveIngresosCategoryId(): Promise<string> {
  const categories = await fetchCategories();
  const existing = categories.find((c) => c.tipo === 'ingreso' && c.nombre.trim().toLowerCase() === 'ingresos');
  if (existing) return existing.id;

  const created = await createCategory({ nombre: 'Ingresos', tipo: 'ingreso' });
  return created.id;
}

function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

interface EnsureRecurringIncomeResult {
  /** True when a 'variable' income has no movement for this month yet and the user should be asked for the amount. */
  needsVariablePrompt: boolean;
  recurringIncome: RecurringIncome | null;
}

/**
 * Called when the user views a given month (Resumen/Movimientos). For a
 * 'fijo' income, silently creates that month's movement if it doesn't exist
 * yet. For 'variable', never creates anything here — it only reports whether
 * the caller should show the amount prompt. Safe to call repeatedly (e.g.
 * navigating back and forth between months): the existence check plus a
 * partial unique index on (recurring_income_id, fecha) prevent duplicates.
 */
export async function ensureRecurringIncomeForMonth(
  year: number,
  month: number
): Promise<EnsureRecurringIncomeResult> {
  const recurringIncome = await fetchRecurringIncome();
  if (!recurringIncome || !recurringIncome.activo) {
    return { needsVariablePrompt: false, recurringIncome: null };
  }

  const fecha = firstDayOfMonth(year, month);
  const { data: existingMovement, error } = await supabase
    .from('movements')
    .select('id')
    .eq('recurring_income_id', recurringIncome.id)
    .eq('fecha', fecha)
    .maybeSingle();
  if (error) {
    logSupabaseError('ensureRecurringIncomeForMonth (check)', error);
    throw error;
  }
  if (existingMovement) {
    return { needsVariablePrompt: false, recurringIncome };
  }

  if (recurringIncome.tipo === 'variable') {
    return { needsVariablePrompt: true, recurringIncome };
  }

  // tipo === 'fijo': generate silently.
  await submitIncomeForMonth(recurringIncome, year, month, recurringIncome.monto ?? 0);
  return { needsVariablePrompt: false, recurringIncome };
}

/** Creates the movement for one month of a recurring income — used both for 'fijo' auto-generation and 'variable' after the user answers the prompt. */
export async function submitIncomeForMonth(
  recurringIncome: RecurringIncome,
  year: number,
  month: number,
  monto: number
): Promise<Movement> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const categoryId = await resolveIngresosCategoryId();

  const { data, error } = await supabase
    .from('movements')
    .insert({
      user_id: userId,
      category_id: categoryId,
      concepto: recurringIncome.concepto,
      monto,
      notas: null,
      estado: 'pagado',
      fecha: firstDayOfMonth(year, month),
      icono: suggestMovementIcon(recurringIncome.concepto),
      recurring_income_id: recurringIncome.id,
    })
    .select()
    .single();
  if (error) {
    logSupabaseError('submitIncomeForMonth', error);
    throw error;
  }
  return data;
}
