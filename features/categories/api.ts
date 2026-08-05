import { logSupabaseError, supabase } from '../../lib/supabase';
import { sanitizeText } from '../shared/sanitize';
import type { Category, NewCategoryInput, UpdateCategoryInput } from './types';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('nombre', { ascending: true });
  if (error) {
    logSupabaseError('fetchCategories', error);
    throw error;
  }
  return data;
}

function normalizeName(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Throws a friendly error if another category (other than `excludeId`) already has this name, ignoring case/whitespace. */
async function assertNameNotTaken(nombre: string, excludeId?: string): Promise<void> {
  const categories = await fetchCategories();
  const normalized = normalizeName(nombre);
  const isDuplicate = categories.some((c) => c.id !== excludeId && normalizeName(c.nombre) === normalized);
  if (isDuplicate) {
    throw new Error('Ya existe una categoría con este nombre');
  }
}

export async function createCategory(input: NewCategoryInput): Promise<Category> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const nombre = sanitizeText(input.nombre, 60);
  await assertNameNotTaken(nombre);

  const { data, error } = await supabase
    .from('categories')
    .insert({ nombre, es_fija: input.esFija, user_id: userId })
    .select()
    .single();
  if (error) {
    logSupabaseError('createCategory', error);
    throw error;
  }
  return data;
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  const nombre = sanitizeText(input.nombre, 60);
  await assertNameNotTaken(nombre, input.id);

  const { data, error } = await supabase
    .from('categories')
    .update({ nombre, es_fija: input.esFija })
    .eq('id', input.id)
    .select()
    .single();
  if (error) {
    logSupabaseError('updateCategory', error);
    throw error;
  }
  return data;
}

/** Whether this category has any movement ever (any month), not just in the currently viewed month — used to decide whether deleting it needs the plain confirm dialog or will hit the FK-violation banner instead. */
export async function categoryHasMovements(categoryId: string): Promise<boolean> {
  const { data, error } = await supabase.from('movements').select('id').eq('category_id', categoryId).limit(1);
  if (error) {
    logSupabaseError('categoryHasMovements', error);
    throw error;
  }
  return (data?.length ?? 0) > 0;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    // A foreign-key violation here just means "this category still has
    // movements" — an expected, user-facing case the UI already handles via
    // ErrorBanner, not a real failure. Don't console.error it (that trips
    // Expo's LogBox redbox even though nothing is actually broken); only log
    // genuinely unexpected delete failures.
    if (error.code === '23503') {
      throw new Error('Esta categoría tiene movimientos asociados. Reasígnalos o elimínalos primero.');
    }
    logSupabaseError('deleteCategory', error);
    throw error;
  }
}
