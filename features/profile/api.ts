import { logSupabaseError, supabase } from '../../lib/supabase';
import type { Profile, UpsertProfileInput } from './types';

export async function fetchProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    logSupabaseError('fetchProfile', error);
    throw error;
  }
  return data;
}

export async function upsertProfile(input: UpsertProfileInput): Promise<Profile> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const existing = await fetchProfile();

  const merged = {
    id: userId,
    nombre: input.nombre !== undefined ? input.nombre : (existing?.nombre ?? null),
    telefono: input.telefono !== undefined ? input.telefono : (existing?.telefono ?? null),
    onboarding_completed:
      input.onboarding_completed !== undefined ? input.onboarding_completed : (existing?.onboarding_completed ?? false),
  };

  const { data, error } = await supabase.from('profiles').upsert(merged).select().single();
  if (error) {
    logSupabaseError('upsertProfile', error);
    throw error;
  }
  return data;
}
