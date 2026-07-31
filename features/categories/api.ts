import { supabase } from '../../lib/supabase';
import type { Category, NewCategoryInput, UpdateCategoryInput } from './types';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('nombre', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory(input: NewCategoryInput): Promise<Category> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('categories')
    .insert({ nombre: input.nombre, tipo: input.tipo, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ nombre: input.nombre, tipo: input.tipo })
    .eq('id', input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      throw new Error('Esta categoría tiene movimientos asociados. Reasígnalos o elimínalos primero.');
    }
    throw error;
  }
}
