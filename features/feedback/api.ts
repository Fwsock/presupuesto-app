import { logSupabaseError, supabase } from '../../lib/supabase';
import { sanitizeText } from '../shared/sanitize';
import { getDeviceInfo } from './deviceInfo';
import type { Feedback, NewFeedbackInput } from './types';

/**
 * Uploads to the private `feedback-evidence` bucket (see
 * supabase/migrations/0007_feedback.sql) under the user's own folder, so the
 * storage RLS policy (auth.uid() = the folder name) can allow it. Returns
 * the storage PATH, not a public URL -- the bucket is private on purpose
 * (a bug screenshot can show real account data), so viewing it later means
 * opening it in the Supabase dashboard's Storage browser or generating a
 * signed URL, never a plain public link.
 */
async function uploadEvidence(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('feedback-evidence')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
  if (error) {
    logSupabaseError('uploadEvidence', error);
    throw new Error('No se pudo subir la imagen de evidencia. Intenta de nuevo o envía el feedback sin ella.');
  }
  return path;
}

export async function submitFeedback(input: NewFeedbackInput): Promise<Feedback> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('No hay sesión activa');

  const imageUrl = input.imageUri ? await uploadEvidence(user.id, input.imageUri) : null;

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      user_email: user.email ?? 'desconocido',
      title: sanitizeText(input.title, 100),
      category: input.category,
      description: sanitizeText(input.description, 2000),
      image_url: imageUrl,
      device_info: getDeviceInfo(),
    })
    .select()
    .single();
  if (error) {
    logSupabaseError('submitFeedback', error);
    throw error;
  }
  return data;
}
