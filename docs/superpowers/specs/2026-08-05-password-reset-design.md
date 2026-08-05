# Recuperación de contraseña — diseño

Fecha: 2026-08-05

## Contexto

La app (Expo Router + Supabase Auth) tiene login, registro y verificación de
cuenta por código OTP de 6 dígitos (`app/verify-otp.tsx`), pero no tiene forma
de recuperar una contraseña olvidada. `features/auth/hooks.ts` ya expone
`updatePassword()`, y componentes como `AuthTextInput`, `PasswordStrengthMeter`,
`OtpInput`, `Button`, `BackButton` y `PressableScale` ya existen y se reusan
tal cual.

La app corre en Expo Go sin `expo-dev-client`. Un link mágico con
`redirectTo` a un scheme custom (`presupuestoapp://`) no abre la app de forma
confiable en Expo Go durante desarrollo — solo funcionaría en un build
standalone. Por eso el mecanismo elegido es **código OTP de 6 dígitos**,
igual que el flujo de registro, que no depende de deep links.

## Mecanismo de navegación (el punto crítico)

`supabase.auth.verifyOtp({ type: 'recovery' })` crea una sesión real, igual
que un login. `RootNavigator` (`app/_layout.tsx`) ya reacciona a
`useSession()` automáticamente: en cuanto detecta sesión, monta `(app)` (o
`onboarding`). Sin nada especial, verificar el código de recuperación
mandaría al usuario derecho a la app sin pasar por la pantalla de nueva
contraseña.

`onAuthStateChange` emite el evento `PASSWORD_RECOVERY` quand la sesión se
originó por este camino (distinto de `SIGNED_IN`). Solución:

- `useSession()` captura ese evento y expone `isPasswordRecovery: boolean`.
  Se limpia solo al recibir `SIGNED_OUT`.
- `RootNavigator` agrega una rama de `Stack.Protected` **antes** de las
  ramas de `(app)`/`onboarding`: si hay sesión y `isPasswordRecovery` es
  true, se muestra `update-password` en su lugar. `needsOnboarding` y la
  llamada a `useProfile()` se calculan con `!isPasswordRecovery` para no
  disparar un fetch de perfil innecesario durante la recuperación.
- Al terminar de actualizar la contraseña, `update-password.tsx` llama
  `signOut()` inmediatamente (limpia sesión y el flag) y navega a `login`
  con un mensaje de éxito — no se deja al usuario "ya adentro" de la app
  tras un reset, tal como se pidió explícitamente.

Toda la navegación entre pantallas sigue la convención ya existente en el
archivo: nunca imperativa cuando el `Stack.Protected` guard puede resolverlo
solo.

## Pantallas

Todas sin header nativo azul — el flujo de auth completo (login, registro,
verify-otp, y estas dos nuevas) se mantiene con fondo blanco / header
limpio. El header azul con título blanco queda exclusivo de las pantallas
internas de la app ya logueada (Resumen/Movimientos/Categorías/Cuenta).

### `app/forgot-password.tsx`
- Ruta agregada al grupo `Stack.Protected guard={!session}` junto a
  login/register/verify-otp.
- Recibe `email` opcional por param (precargado desde el link en Login).
- Campo Email (zod: formato válido), botón "Enviar instrucciones" →
  `requestPasswordReset(email)`.
- Éxito: la misma pantalla cambia a un estado de éxito ("Correo enviado.
  Revisa tu bandeja de entrada.") con un botón "Ingresar código" que navega
  a `reset-password` pasando el email.
- Error: `translateAuthError`, mismo patrón de mensaje único que
  login/register.
- `BackButton` flotante (mismo patrón que `verify-otp.tsx`).

### `app/reset-password.tsx`
- Mismo grupo `!session`. Espejo de `verify-otp.tsx`: `OtpInput` de 6
  dígitos, auto-submit al completar, cooldown de reenvío de 60s.
- Verifica con `verifyPasswordRecoveryOtp(email, token)`.
- "Reenviar código" vuelve a llamar `requestPasswordReset(email)` — **no**
  `supabase.auth.resend()`, que no soporta `type: 'recovery'` (solo
  `signup`/`email_change`/`sms`/`phone_change`).
- Al verificar OK no hay navegación manual: el gate de `RootNavigator` hace
  el cambio de pantalla solo en cuanto `isPasswordRecovery` pasa a true.
- `BackButton` → `router.back()`.

### `app/update-password.tsx`
- Ruta en su propio `Stack.Protected guard={!!session && isPasswordRecovery}`,
  **no** en el grupo `!session` (requiere la sesión de recuperación).
- Dos `AuthTextInput` (nueva contraseña, confirmar) + `PasswordStrengthMeter`
  bajo el primero.
- Validación bloqueante (zod `.refine`): `getPasswordStrength(password).score
  === 4` (las 4 condiciones — "alta") y `password === confirmPassword`. El
  registro (`register.tsx`) no cambia — sigue con su mínimo de 6 caracteres.
- Envío: `updatePassword(password)` → `signOut()` →
  `router.replace('/login', { params: { passwordReset: '1' } })`.
- Sin `BackButton`: volver atrás en este punto no lleva a ningún estado
  válido (el código OTP ya se consumió).

### `app/login.tsx`
- Nuevo `<Link>` "¿Olvidaste tu contraseña?" debajo del botón "Ingresar",
  mismo estilo que el link existente "¿No tienes cuenta? Regístrate", pasando
  el email ya tipeado (`watch('email')`) como param.
- Lee el param `passwordReset` y muestra un mensaje verde de éxito (mismo
  patrón que el `resendMessage` de `verify-otp.tsx`): "Contraseña actualizada
  correctamente. Inicia sesión con tu nueva contraseña."

## API (`features/auth/hooks.ts`)

Dos funciones nuevas, mismo estilo que las existentes (throw en error):

```ts
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function verifyPasswordRecoveryOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) throw error;
}
```

`updatePassword()` ya existe y se reusa sin cambios.

`useSession()` gana `isPasswordRecovery` (ver sección de navegación arriba).

## Errores y casos borde

- `resetPasswordForEmail` responde éxito aunque el correo no exista (evita
  revelar qué correos están registrados) — la pantalla de éxito de
  `forgot-password` es siempre la misma, sin ramas de código para "correo no
  encontrado".
- Código expirado/incorrecto y rate-limiting ya están cubiertos por
  `translateAuthError` (`Token has expired or is invalid`, `For security
  purposes`) — mismos mensajes que ya usa `verify-otp.tsx`. No se agregan
  casos nuevos salvo que aparezca un mensaje de Supabase no cubierto durante
  la implementación.

## Paso manual fuera del código

Antes de poder probar el flujo de punta a punta hay que confirmar en el
Dashboard de Supabase → Authentication → Email Templates → "Reset Password"
que el cuerpo del correo incluya `{{ .Token }}` (igual que ya debe estar
configurado en "Confirm signup", dado que `verify-otp.tsx` funciona con
código). Esto no es SQL, es configuración del dashboard — no se puede
verificar ni aplicar desde el código.

## Tests

`getPasswordStrength` (`__tests__/passwordStrength.test.ts`) ya cubre el
umbral "alta" que exige `update-password.tsx`, y `translateAuthError`
(`__tests__/translateAuthError.test.ts`) ya cubre los mensajes de error que
este flujo puede disparar. No se agregan tests nuevos para estas dos piezas.

Este repo no testea pantallas `.tsx` (no está en `testMatch` de
`jest.config.js`, no hay React Native Testing Library instalado) ni
`features/auth/hooks.ts` (impuro, llama al cliente real de Supabase — mismo
motivo por el que las funciones existentes ahí tampoco tienen test directo).
Si durante la implementación surge lógica pura nueva (ej. un helper de
validación separado), se le suma test en el mismo estilo que
`passwordStrength.test.ts`.

## Fuera de alcance

- No se toca `register.tsx` (mínimo de 6 caracteres se mantiene ahí).
- No se unifica el header de login/register/verify-otp con el header azul de
  las tabs — decisión explícita: el header azul queda exclusivo del interior
  de la app ya logueada.
- No se implementa el flujo de link mágico con `redirectTo` — descartado por
  la limitación de Expo Go en desarrollo.
