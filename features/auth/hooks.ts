import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';

export { translateAuthError } from './errors';

const RECOVERY_FLAG_KEY = 'auth_password_recovery_pending';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(RECOVERY_FLAG_KEY)]).then(
      ([{ data }, recoveryFlag]) => {
        setSession(data.session);
        // Restores isPasswordRecovery across a JS reload (Fast Refresh, a
        // crash, backgrounding) that happens while the user is mid-recovery
        // -- Supabase persists the session to AsyncStorage before the
        // PASSWORD_RECOVERY event even fires, so without this a reload at
        // that moment would otherwise drop the user into the app fully
        // signed in with their old password still active.
        setIsPasswordRecovery(recoveryFlag === '1');
        setLoading(false);
      }
    );

    // 'PASSWORD_RECOVERY' se emite cuando la sesión se creó verificando un
    // código de recuperación (verifyPasswordRecoveryOtp), no un login normal
    // -- RootNavigator usa este flag para mandar a update-password.tsx en
    // vez de a la app. Se limpia solo al cerrar sesión, que es lo que hace
    // update-password.tsx apenas termina de actualizar la contraseña.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        AsyncStorage.setItem(RECOVERY_FLAG_KEY, '1');
      }
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        AsyncStorage.removeItem(RECOVERY_FLAG_KEY);
      }
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
 * Google sign-in, native OAuth flow: `signInWithOAuth` doesn't redirect the
 * browser itself on native (only on web) -- `skipBrowserRedirect: true`
 * makes that explicit and just hands back the provider's authorize URL,
 * which `WebBrowser.openAuthSessionAsync` opens in an in-app browser tab
 * that closes itself once Google redirects back to `redirectTo`.
 *
 * `redirectTo` is the bare `presupuestoapp://` scheme (app.json's `scheme`),
 * not `Linking.createURL(...)` with a path -- Supabase only honors a
 * `redirectTo` that exactly matches (or matches a wildcard in) its Redirect
 * URLs allow-list; anything else silently falls back to the project's
 * default Site URL (which is why this was opening `localhost:3000` instead
 * of coming back to the app). Keep this in sync with whatever's entered in
 * Supabase Auth's Redirect URLs list.
 *
 * Supabase appends the session as URL fragment params on that final
 * redirect, which `setSessionFromUrl` below turns into a real session --
 * from there `useSession`'s own `onAuthStateChange` listener takes over
 * exactly like it does after `signIn`, no extra navigation needed here.
 *
 * NOTE: requires the "Google" provider enabled in Supabase Auth (with its
 * OAuth client id/secret) and `presupuestoapp://` added as a Redirect URL
 * in that same provider config -- both are dashboard-side setup, not code.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = 'presupuestoapp://';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No se pudo iniciar el flujo de Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    // User closed the browser tab / cancelled -- not an error to surface.
    return;
  }
  await setSessionFromUrl(result.url);
}

/** Parses the `#access_token=...&refresh_token=...` fragment Supabase appends to the OAuth redirect and turns it into a real session. */
async function setSessionFromUrl(url: string): Promise<void> {
  const fragment = url.split('#')[1];
  if (!fragment) throw new Error('Google no devolvió una sesión válida.');
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Google no devolvió una sesión válida.');

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
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

let passwordJustReset = false;

/** Marks that a password was just reset via the recovery flow, so login.tsx can show a one-time success banner. Call this before signOut() in update-password.tsx -- it must be set before the sign-out, not after, since it has to be true by the time RootNavigator's guard swaps back to the login screen. */
export function markPasswordJustReset(): void {
  passwordJustReset = true;
}

/** Reads and clears the one-shot flag set by markPasswordJustReset(). Call once when login.tsx mounts. */
export function consumePasswordJustReset(): boolean {
  const value = passwordJustReset;
  passwordJustReset = false;
  return value;
}

/** Envía el correo con el código de recuperación de 6 dígitos. Responde éxito aunque el correo no exista, para no revelar qué cuentas están registradas -- el llamador siempre debe mostrar el mismo mensaje de éxito. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/** Verifica el código de recuperación de 6 dígitos. Éxito crea una sesión y dispara el evento 'PASSWORD_RECOVERY' que useSession() captura como isPasswordRecovery -- RootNavigator toma el control desde ahí, sin navegación manual acá. */
export async function verifyPasswordRecoveryOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) throw error;
}
