import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export { translateAuthError } from './errors';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 'PASSWORD_RECOVERY' se emite cuando la sesión se creó verificando un
    // código de recuperación (verifyPasswordRecoveryOtp), no un login normal
    // -- RootNavigator usa este flag para mandar a update-password.tsx en
    // vez de a la app. Se limpia solo al cerrar sesión, que es lo que hace
    // update-password.tsx apenas termina de actualizar la contraseña.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading, isPasswordRecovery };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Whether the new account needs an email confirmation before it can sign
 * in — Supabase only returns a session immediately when confirmations are
 * disabled for the project; otherwise `data.session` is null until the user
 * clicks the link it emails them, and the caller should say so instead of
 * assuming they're logged in. Once a session does exist, RootNavigator's
 * Stack.Protected guards take it from there — onboarding creates the first
 * profile row itself, so nothing else needs to happen here.
 */
export async function signUp(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

/** Verifies the 6-digit signup code sent by email. On success Supabase sets a session, same as signIn -- RootNavigator's guards take it from there. */
export async function verifySignupOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) throw error;
}

/** Re-sends the 6-digit signup code to the same address. */
export async function resendSignupOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Supabase sends a confirmation link to the new address by default and the
 * change only takes effect once it's clicked - the caller should tell the
 * user to check their inbox rather than assume the email changed already.
 */
export async function updateEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

/** Updates immediately for the current session - no re-auth prompt (default Supabase behavior). */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
