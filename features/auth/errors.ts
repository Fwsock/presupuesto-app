/**
 * Maps common Supabase Auth error messages to Spanish. Falls back to a
 * generic friendly message for anything unrecognized -- NEVER the raw
 * message as-is, since some failures (a 500 from Supabase's gateway, a
 * broken SMTP relay, a network drop mid-request) surface as an Error whose
 * `.message` is itself a JSON dump of the whole failed Response object.
 * `err instanceof Error` is true for those too, so a plain "return message"
 * fallback used to render that entire JSON blob straight into the UI.
 *
 * Pure and dependency-free on purpose (no supabase-js/react-native imports)
 * so it's unit-testable directly under plain Jest/ts-jest -- everything
 * else in features/auth/hooks.ts pulls in react-native-get-random-values
 * and AsyncStorage transitively via lib/supabase.ts, which Jest's node
 * environment can't parse.
 */
export function translateAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos';
  if (message.includes('User already registered')) return 'El correo ya está registrado';
  if (message.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres';
  if (message.includes('Unable to validate email address')) return 'Ingresa un correo electrónico válido';
  if (message.includes('Token has expired or is invalid')) return 'El código es incorrecto o ya expiró. Solicita uno nuevo.';
  if (message.includes('Email not confirmed')) return 'Confirma tu correo antes de iniciar sesión';
  if (message.includes('For security purposes')) return 'Espera unos segundos antes de solicitar otro código';
  if (message.includes('email rate limit exceeded')) {
    return 'Alcanzaste el límite de correos permitidos. Espera unos minutos antes de solicitar otro.';
  }
  if (message.includes('Network request failed') || message.includes('Failed to fetch')) {
    return 'Error de conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  if (
    message.includes('unexpected_failure') ||
    message.includes('"status":500') ||
    message.includes('error sending confirmation email') ||
    message.includes('error sending recovery email') ||
    message.toLowerCase().includes('smtp')
  ) {
    return 'No se pudo enviar el correo de confirmación. Inténtalo de nuevo más tarde.';
  }

  // Catch-all: a raw Response/JSON dump (starts with '{', or is simply too
  // long to be a real user-facing Auth message) never reaches the screen.
  const looksLikeRawResponse = message.trim().startsWith('{') || message.length > 180;
  if (looksLikeRawResponse) {
    return 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.';
  }

  return message;
}
