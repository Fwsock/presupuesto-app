import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

// React Native has no localStorage, so supabase-js silently falls back to an
// in-memory store and the session dies with the JS context (logging the user
// out on every reload / cold start). AsyncStorage makes it survive.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Logs the raw error thrown by supabase-js (message, code, details, hint) so
// the real cause surfaces in the console instead of a generic UI message.
export function logSupabaseError(context: string, error: unknown) {
  console.error(`[supabase] ${context}`, error);
}
