# Reconciliación a Master + Recuperación de Contraseña — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Organizar y fusionar a `master` todo el trabajo pendiente en el worktree `movimientos-cuenta-tabbar-revamp`, dejando `master` compilando limpio y con toda la suite de tests en verde. (2) Sobre ese `master` ya actualizado, construir el flujo completo de "Recuperar contraseña" con Supabase Auth vía código OTP de 6 dígitos.

**Architecture:** Fase 1 es trabajo de git puro — no se escribe código nuevo, se organiza lo que ya existe en el working tree (que ya compila y pasa tests) en commits lógicos, se fusiona `master` hacia la rama del worktree para resolver conflictos ahí, y luego se fusiona la rama del worktree hacia `master` (fast-forward). Fase 2 sigue el diseño aprobado en `docs/superpowers/specs/2026-08-05-password-reset-design.md`: un flujo de recuperación por código OTP (no link mágico, porque la app corre en Expo Go sin `expo-dev-client` y los deep links con scheme custom no abren la app de forma confiable en desarrollo), con un gate nuevo en `RootNavigator` basado en el evento `PASSWORD_RECOVERY` de Supabase para evitar que verificar el código mande al usuario derecho a la app antes de poner la contraseña nueva.

**Tech Stack:** Expo Router (file-based), React Hook Form + Zod, Supabase Auth (`@supabase/supabase-js`), Jest + ts-jest (solo lógica pura, ver Global Constraints), Tailwind vía `nativewind` (`className`).

## Global Constraints

- Todos los mensajes de UI, errores y commits de código van en español, salvo palabras clave de código.
- Este repo **no testea pantallas `.tsx`** — `jest.config.js` tiene `testMatch: ['**/__tests__/**/*.test.ts']` (nótese: `.test.ts`, no `.test.tsx`) y no hay React Native Testing Library instalada. Tampoco se testea `features/auth/hooks.ts` directamente (llama al cliente real de Supabase, sin mocks de sus métodos). Por eso las tareas de Fase 2 que crean pantallas o funciones de `hooks.ts` **no** llevan ciclo red/green — terminan con `npx tsc --noEmit` como verificación, siguiendo la convención ya establecida en este repo (confirmado en el spec aprobado). Cualquier lógica pura nueva que surja durante la implementación sí debe llevar test en el estilo de `__tests__/passwordStrength.test.ts`.
- No hacer `git push` a ningún remoto en ningún paso de este plan salvo que el usuario lo pida explícitamente en el momento.
- No tocar el stash `stray-master-leak-2026-08-02` (cambio suelto a `movimientos.tsx` referenciando `features/shared/monthNames`, no relacionado con este trabajo).
- Carpeta del worktree: `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp` (rama `worktree-movimientos-cuenta-tabbar-revamp`, luego renombrada a `feature/password-reset` en la Tarea 8). Carpeta del repo principal (donde vive `master`): `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app`. **No** ejecutar `git checkout master` dentro de la carpeta del worktree — `master` ya está checked out en la carpeta principal y git no permite tener la misma rama en dos worktrees a la vez.
- El servidor de Expo ya corre apuntando a la carpeta del worktree (puerto 8081). Ninguna tarea de este plan requiere reiniciarlo: Fase 1 son solo commits de contenido que ya está en disco (no cambia archivos), y Fase 2 continúa en la misma carpeta con un simple `git branch -m` (no un checkout que cambie archivos).
- Antes de poder probar Fase 2 de punta a punta, el usuario debe confirmar en el Dashboard de Supabase → Authentication → Email Templates → "Reset Password" que el cuerpo del correo incluya `{{ .Token }}`. Esto no se puede hacer desde código — se recuerda explícitamente en la Tarea 15 (verificación final).

---

## FASE 1 — Reconciliación y merge a master

### Task 1: Organizar los commits pendientes en el worktree

**Contexto:** Ahora mismo (antes de esta tarea) `npx tsc --noEmit` no reporta errores y `npx jest` pasa 184/184 tests en 20 suites, con el working tree tal cual está. Esta tarea solo organiza ese contenido ya funcional en commits temáticos — no cambia ningún archivo. Por eso los sub-pasos NO verifican tsc/jest entre cada commit (el working tree no cambia entre commits, solo lo que queda registrado en el historial); la verificación real es el paso final de esta tarea.

**Files:** ninguno se crea o modifica — solo se hace `git add` + `git commit` sobre archivos que ya existen en disco.

- [ ] **Paso 1: Commit — flujo de registro + verificación OTP + fuerza de contraseña**

```bash
git add app/register.tsx app/login.tsx components/AuthTextInput.tsx components/OtpInput.tsx components/PasswordStrengthMeter.tsx features/auth/errors.ts features/auth/passwordStrength.ts features/auth/hooks.ts __tests__/passwordStrength.test.ts __tests__/translateAuthError.test.ts
git commit -m "feat: registro de cuenta con verificación por código OTP y medidor de fuerza de contraseña"
```

- [ ] **Paso 2: Commit — refactor de movimientos/categorías/ingresos (fijas, orden, cuotas, filtros)**

```bash
git add features/movements/hooks.ts features/movements/installments.ts features/movements/summary.ts features/movements/types.ts features/movements/fixedCategories.ts features/movements/fixedCategoryDate.ts features/movements/sort.ts components/FixedCategoriesSync.tsx components/MovementFilterSheet.tsx components/MovementSearchBar.tsx components/CategoryFilterToast.tsx components/MovementFormModal.tsx components/VariableIncomePromptModal.tsx components/VariableIncomePromptHost.tsx components/RecurringIncomeForm.tsx features/income/api.ts features/income/hooks.ts "app/(app)/index.tsx" features/categories/types.ts components/CategoryFormModal.tsx components/CategoryTotalsList.tsx components/MonthSaldoChart.tsx __tests__/installments.test.ts __tests__/monthlySeries.test.ts __tests__/summary.test.ts __tests__/fixedCategoryDate.test.ts __tests__/sort.test.ts
git commit -m "feat: categorías fijas, orden de movimientos, override de cuotas y filtros de movimientos"
```

- [ ] **Paso 3: Commit — primitivas de UI compartidas**

```bash
git add components/Skeleton.tsx components/ConfirmDialog.tsx components/PhoneInput.tsx components/AnimatedSwitch.tsx components/AnimatedTabBar.tsx components/FadeTabScreen.tsx components/ErrorBanner.tsx components/FullScreenFormModal.tsx components/IconPickerModal.tsx
git commit -m "feat: componentes compartidos (Skeleton, ConfirmDialog, PhoneInput, tab bar animado)"
```

- [ ] **Paso 4: Commit — utilidades compartidas y sus tests**

```bash
git add features/shared/countries.ts features/shared/withMinDuration.ts __tests__/countries.test.ts __tests__/withMinDuration.test.ts
git commit -m "feat: utilidades compartidas (lista de países, withMinDuration)"
```

- [ ] **Paso 5: Commit — migraciones SQL**

```bash
git add supabase/migrations/0004_movement_tipo.sql supabase/migrations/0005_fixed_categories.sql supabase/migrations/0006_grant_service_role.sql
git commit -m "data: migraciones para tipo de movimiento, categorías fijas y grant de service_role"
```

- [ ] **Paso 6: Commit — docs**

```bash
git add docs/superpowers/specs/2026-08-05-ui-polish-calendar-month-picker-onboarding-design.md
git commit -m "docs: actualizar spec de UI polish (calendario/selector mes-año/onboarding)"
```

- [ ] **Paso 7: Confirmar que no queda nada sin commitear y que todo sigue verde**

```bash
git status --short
```
Esperado: sin salida (working tree limpio).

```bash
npx tsc --noEmit
```
Esperado: sin errores, sin salida.

```bash
npx jest
```
Esperado: `Test Suites: 20 passed, 20 total` / `Tests: 184 passed, 184 total` (los mismos números de antes de empezar esta tarea — solo se reorganizó el historial, el contenido no cambió).

---

### Task 2: Fusionar `master` hacia la rama del worktree

**Contexto:** `master` avanzó de forma independiente (9 commits que esta rama no tiene, incluyendo un merge+revert de otro trabajo no relacionado que se cancela a sí mismo, cambios de datos/seed de Agosto, y un cambio a `jest.config.js`). Se fusiona `master` hacia esta rama primero (no al revés) para resolver cualquier conflicto acá, con las herramientas y el entorno de este worktree, antes de tocar `master`.

**Conflicto ya identificado:** `jest.config.js`. La versión de `master` tiene `testPathIgnorePatterns` (excluye `.claude/worktrees/` de la detección de tests) pero no tiene `moduleNameMapper`/`setupFilesAfterEnv`. La versión de esta rama tiene `moduleNameMapper`/`setupFilesAfterEnv` (mocks de `react-native-get-random-values` y `AsyncStorage`, necesarios para que `features/auth/errors.ts` y los tests de auth corran bajo Jest) pero no tiene `testPathIgnorePatterns`. El resultado fusionado necesita **ambas** cosas.

- [ ] **Paso 1: Iniciar el merge**

```bash
git merge master
```

- [ ] **Paso 2: Resolver el conflicto de `jest.config.js`**

Reemplazar el contenido completo del archivo (después de que `git merge` lo deje con marcadores de conflicto) por:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/'],
  moduleNameMapper: {
    'react-native-get-random-values': '<rootDir>/__mocks__/rn-get-random-values-mock.js',
    '@react-native-async-storage/async-storage': '<rootDir>/__mocks__/async-storage-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/__mocks__/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native-get-random-values)/)',
  ],
};
```

- [ ] **Paso 3: Resolver cualquier otro conflicto que aparezca**

No se esperan más conflictos reales (el análisis previo confirma que el merge+revert de `master` en el otro trabajo se cancela a sí mismo, y los cambios de datos/seed de Agosto no tocan archivos de esta rama). Si `git status` muestra algún otro archivo en conflicto, revisar el diff de cada lado y conservar el contenido combinado (código de esta rama + datos/docs de `master`, según corresponda al archivo) — nunca descartar un lado completo sin revisar qué contiene.

```bash
git status --short
```
Confirmar que no queden líneas con `UU` (unmerged) antes de continuar.

- [ ] **Paso 4: Cerrar el merge**

```bash
git add jest.config.js
git commit --no-edit
```
(Si hubo otros archivos en conflicto, agregarlos también antes del commit.)

- [ ] **Paso 5: Verificar que todo sigue verde después del merge**

```bash
npx tsc --noEmit
```
Esperado: sin errores.

```bash
npx jest
```
Esperado: 100% de los tests en verde (el número total puede ser mayor a 184 si `master` trajo tests propios, ej. `noRawSql.test.ts`/`rlsPolicies.test.ts` ya estaban en esta rama vía sus propios commits — no debería haber tests nuevos de `master` más allá de eso).

Si algo falla, arreglarlo antes de seguir — no continuar a la Tarea 3 con `tsc`/`jest` en rojo.

---

### Task 3: Fusionar la rama del worktree hacia `master`

**Contexto:** Después de la Tarea 2, esta rama contiene todos los commits de `master` más los suyos propios — fusionarla hacia `master` debería ser un fast-forward, sin conflictos. Este paso se hace **desde la carpeta del repo principal** (`C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app`), donde `master` está checked out — no desde la carpeta del worktree.

- [ ] **Paso 1: Confirmar que el repo principal está limpio**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app"
git status --short
```
Esperado: sin cambios trackeados pendientes (puede aparecer un archivo suelto `$log` sin trackear — dejarlo, no es parte de este trabajo, no comitearlo ni borrarlo).

- [ ] **Paso 2: Fusionar**

```bash
git merge worktree-movimientos-cuenta-tabbar-revamp
```
Esperado: `Fast-forward` (o un mensaje equivalente sin conflictos). Si git pide resolver conflictos acá, algo salió mal en la Tarea 2 — volver a esa tarea, no resolver conflictos duplicados en dos lugares distintos.

- [ ] **Paso 3: Verificar `master`**

```bash
npx tsc --noEmit
```
Esperado: sin errores.

```bash
npx jest
```
Esperado: 100% de los tests en verde.

- [ ] **Paso 4: Confirmar el estado final**

```bash
git log --oneline -12
git status --short
```
Confirmar que el historial muestra los commits de la Tarea 1 y 2, y que el working tree está limpio.

---

## FASE 2 — Flujo de "Recuperar contraseña"

Diseño completo y aprobado en `docs/superpowers/specs/2026-08-05-password-reset-design.md` — leerlo antes de empezar si algo en las tareas siguientes no queda claro. Todo el código de abajo ya está completo y listo para copiar tal cual; no hay que inventar nada adicional.

### Task 4: Renombrar la rama del worktree para continuar con la feature

**Contexto:** La rama `worktree-movimientos-cuenta-tabbar-revamp` ya cumplió su propósito (fusionada a `master` en la Tarea 3). Se renombra en vez de crear una rama nueva desde `master` para no hacer un `checkout` que cambie archivos en disco — como `master` ahora apunta al mismo commit que esta rama (fast-forward), el contenido es idéntico; solo cambia la etiqueta. Esto evita cualquier necesidad de reiniciar el servidor de Expo, que sigue apuntando a esta misma carpeta.

**Files:** ninguno.

- [ ] **Paso 1: Renombrar, en la carpeta del worktree**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp"
git branch -m worktree-movimientos-cuenta-tabbar-revamp feature/password-reset
git branch --show-current
```
Esperado: `feature/password-reset`.

- [ ] **Paso 2: Confirmar que sigue todo verde**

```bash
npx tsc --noEmit
npx jest
```
Esperado: ambos limpios (no debería haber cambiado nada respecto a la Tarea 3, paso 3).

---

### Task 5: Gate de navegación `PASSWORD_RECOVERY` en `useSession`

**Files:**
- Modify: `features/auth/hooks.ts`

**Interfaces:**
- Produces: `useSession()` ahora retorna `{ session, loading, isPasswordRecovery }` (antes retornaba solo `{ session, loading }`). `isPasswordRecovery: boolean` — true entre el momento en que se verifica el código de recuperación y el `signOut()` al final del flujo (Tarea 7).

- [ ] **Paso 1: Reemplazar la función `useSession` completa**

En `features/auth/hooks.ts`, reemplazar:

```ts
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

por:

```ts
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
```

- [ ] **Paso 2: Verificar que compila**

```bash
npx tsc --noEmit
```
Esperado: error en `app/_layout.tsx` porque todavía no usa `isPasswordRecovery` — eso es esperado, se corrige en la Tarea 6. Si el error es en otro archivo, revisar el paso anterior.

- [ ] **Paso 3: Commit**

```bash
git add features/auth/hooks.ts
git commit -m "feat: useSession expone isPasswordRecovery para el flujo de reset de contraseña"
```

---

### Task 6: Gate en `RootNavigator`

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `useSession()` → `{ session, loading, isPasswordRecovery }` (Tarea 5).
- Produces: una nueva ruta protegida `update-password`, alcanzable solo cuando `!!session && isPasswordRecovery`. Las pantallas `forgot-password` y `reset-password` (Tareas 9 y 10) se registran en el grupo `!session` junto a `login`/`register`/`verify-otp`.

- [ ] **Paso 1: Reemplazar el archivo completo**

Contenido final de `app/_layout.tsx`:

```tsx
import 'react-native-get-random-values';
import '../global.css';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { useProfile } from '../features/profile/hooks';
import { View } from 'react-native';
import { ScreenSkeleton } from '../components/Skeleton';

// Stack.Protected registers "(app)", "onboarding", "update-password" and the
// unauthenticated screens up front and just toggles which is reachable via
// `guard` — unlike a <Redirect> fired from a pathname check, there's no
// imperative REPLACE action that can land before the target group's
// navigator has mounted.
function RootNavigator() {
  const { session, loading, isPasswordRecovery } = useSession();
  // Skips the profile fetch during a password-recovery session: that
  // session exists only to let update-password.tsx call updateUser(), and
  // fetching a profile for it would be a wasted request that also risks
  // flashing the onboarding/loading skeleton before signOut() kicks in.
  const { data: profile, isLoading: profileLoading } = useProfile(!!session && !isPasswordRecovery);

  if (loading || (!!session && !isPasswordRecovery && profileLoading)) {
    return (
      <View className="flex-1 bg-white">
        <ScreenSkeleton />
      </View>
    );
  }

  // No profile row yet (never saved anything) counts as "not completed" -
  // the onboarding screen upserts the row itself the first time it's used.
  const needsOnboarding = !!session && !isPasswordRecovery && !profile?.onboarding_completed;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!!session && !needsOnboarding && !isPasswordRecovery}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && isPasswordRecovery}>
        <Stack.Screen name="update-password" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-otp" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
```

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit
```
Esperado: errores en `app/_layout.tsx` señalando que `update-password`, `forgot-password` y `reset-password` no existen todavía como rutas — esperado hasta las Tareas 7, 9 y 10. Si aparece cualquier otro error (ej. en la lógica de `needsOnboarding` o los tipos de `useSession`), corregirlo antes de seguir.

- [ ] **Paso 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: RootNavigator muestra update-password durante una sesión de recuperación"
```

---

### Task 7: Hooks de Supabase para solicitar y verificar el reset

**Files:**
- Modify: `features/auth/hooks.ts`

**Interfaces:**
- Produces:
  - `requestPasswordReset(email: string): Promise<void>`
  - `verifyPasswordRecoveryOtp(email: string, token: string): Promise<void>`
- Consumes: `updatePassword` y `signOut` ya existen en este archivo, sin cambios.

- [ ] **Paso 1: Agregar las dos funciones al final de `features/auth/hooks.ts`**

```ts

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
```

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit
```
Esperado: los mismos errores de "ruta no existe" de la Tarea 6 (nada nuevo relacionado a este archivo).

- [ ] **Paso 3: Commit**

```bash
git add features/auth/hooks.ts
git commit -m "feat: hooks requestPasswordReset y verifyPasswordRecoveryOtp"
```

---

### Task 8: Pantalla `update-password.tsx`

**Files:**
- Create: `app/update-password.tsx`

**Interfaces:**
- Consumes: `updatePassword(password: string)`, `signOut()`, `translateAuthError(err: unknown): string` de `features/auth/hooks.ts`; `getPasswordStrength(password: string)` de `features/auth/passwordStrength.ts`; `AuthTextInput`, `PasswordStrengthMeter`, `Button` (props ya definidas en esos componentes, sin cambios).
- Produces: ruta `update-password`, alcanzable solo vía el gate de la Tarea 6. Al éxito, navega a `/login` con el param `passwordReset=1` (consumido en la Tarea 11).

- [ ] **Paso 1: Crear el archivo**

```tsx
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { updatePassword, signOut, translateAuthError } from '../features/auth/hooks';
import { getPasswordStrength } from '../features/auth/passwordStrength';
import { AuthTextInput } from '../components/AuthTextInput';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { Button } from '../components/Button';

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'La contraseña es obligatoria')
      .refine((value) => getPasswordStrength(value).score === 4, {
        message: 'La contraseña debe cumplir las 4 condiciones de seguridad',
      }),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type UpdatePasswordForm = z.infer<typeof updatePasswordSchema>;

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: UpdatePasswordForm) => {
    setServerError(null);
    try {
      await updatePassword(values.password);
      // signOut() limpia la sesión de recuperación (y el flag
      // isPasswordRecovery vía el evento SIGNED_OUT) -- sin esto el usuario
      // quedaría "adentro" de la app en vez de volver a login como se pidió.
      await signOut();
      router.replace({ pathname: '/login', params: { passwordReset: '1' } });
    } catch (err) {
      setServerError(translateAuthError(err));
    }
  };

  const password = watch('password');
  const formError = errors.password?.message ?? errors.confirmPassword?.message ?? serverError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold mb-1 text-center">Nueva contraseña</Text>
        <Text className="text-gray-500 mb-6 text-center">Elige una contraseña nueva para tu cuenta</Text>

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="lock-closed-outline"
              placeholder="Nueva contraseña"
              secureTextEntry
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        <PasswordStrengthMeter password={password} />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="lock-closed-outline"
              placeholder="Confirmar nueva contraseña"
              secureTextEntry
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {formError && <Text className="text-red-600 mb-2">{formError}</Text>}

        <Button
          title="Actualizar contraseña"
          loadingLabel="Actualizando..."
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit
```
Esperado: ya no hay error sobre `update-password` como ruta inexistente. Pueden seguir los errores de `forgot-password`/`reset-password` hasta las Tareas 9-10.

- [ ] **Paso 3: Commit**

```bash
git add app/update-password.tsx
git commit -m "feat: pantalla update-password con validación de fuerza alta"
```

---

### Task 9: Pantalla `forgot-password.tsx`

**Files:**
- Create: `app/forgot-password.tsx`

**Interfaces:**
- Consumes: `requestPasswordReset(email: string)`, `translateAuthError` de `features/auth/hooks.ts`; `AuthTextInput`, `Button`, `BackButton`.
- Produces: ruta `forgot-password` en el grupo `!session`. Acepta param opcional `email`. Al éxito navega a `/reset-password` pasando `email`.

- [ ] **Paso 1: Crear el archivo**

```tsx
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestPasswordReset, translateAuthError } from '../features/auth/hooks';
import { AuthTextInput } from '../components/AuthTextInput';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: emailParam ?? '' },
  });

  const onSubmit = async (values: ForgotPasswordForm) => {
    setServerError(null);
    try {
      await requestPasswordReset(values.email);
      setSentTo(values.email);
    } catch (err) {
      setServerError(translateAuthError(err));
    }
  };

  const formError = errors.email?.message ?? serverError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackButton onPress={() => router.back()} />
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        {sentTo ? (
          <>
            <Text className="text-2xl font-bold mb-1 text-center">Correo enviado</Text>
            <Text className="text-gray-500 mb-8 text-center">
              Revisa tu bandeja de entrada en {sentTo} y escribe el código de 6 dígitos que te enviamos.
            </Text>
            <Button
              title="Ingresar código"
              onPress={() => router.push({ pathname: '/reset-password', params: { email: sentTo } })}
            />
          </>
        ) : (
          <>
            <Text className="text-2xl font-bold mb-1 text-center">Recuperar contraseña</Text>
            <Text className="text-gray-500 mb-6 text-center">
              Ingresa tu correo para recibir un código de recuperación
            </Text>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <AuthTextInput
                  icon="mail-outline"
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />

            {formError && <Text className="text-red-600 mb-2">{formError}</Text>}

            <Button
              title="Enviar instrucciones"
              loadingLabel="Enviando..."
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit
```
Esperado: ya no hay error sobre `forgot-password`. Puede seguir el de `reset-password` hasta la Tarea 10.

- [ ] **Paso 3: Commit**

```bash
git add app/forgot-password.tsx
git commit -m "feat: pantalla forgot-password (solicitud de código de recuperación)"
```

---

### Task 10: Pantalla `reset-password.tsx`

**Files:**
- Create: `app/reset-password.tsx`

**Interfaces:**
- Consumes: `requestPasswordReset(email: string)`, `verifyPasswordRecoveryOtp(email: string, token: string)`, `translateAuthError` de `features/auth/hooks.ts`; `OtpInput`, `Button`, `PressableScale`, `BackButton`.
- Produces: ruta `reset-password` en el grupo `!session`, requiere param `email`. No navega manualmente al verificar OK — el gate de la Tarea 6 hace el cambio de pantalla.

- [ ] **Paso 1: Crear el archivo**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestPasswordReset, translateAuthError, verifyPasswordRecoveryOtp } from '../features/auth/hooks';
import { OtpInput } from '../components/OtpInput';
import { Button } from '../components/Button';
import { PressableScale } from '../components/PressableScale';
import { BackButton } from '../components/BackButton';

const RESEND_SECONDS = 60;
const OTP_LENGTH = 6;

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setResendSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyPasswordRecoveryOtp(email, otp);
      // No manual navigation on success: RootNavigator's Stack.Protected
      // guard reacts to isPasswordRecovery automatically (app/_layout.tsx).
    } catch (err) {
      setError(translateAuthError(err));
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  // Auto-submit the moment the 6th digit lands, same convention as verify-otp.tsx.
  useEffect(() => {
    if (otp.length === OTP_LENGTH) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleResend = async () => {
    if (resendSeconds > 0 || resending) return;
    setResending(true);
    setError(null);
    setResendMessage(null);
    try {
      // supabase.auth.resend() no soporta type: 'recovery' (solo signup /
      // email_change / sms / phone_change) -- reenviar un código de
      // recuperación es simplemente pedir uno nuevo.
      await requestPasswordReset(email);
      setResendSeconds(RESEND_SECONDS);
      setResendMessage('Código reenviado. Revisa tu correo.');
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackButton onPress={() => router.back()} />
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold mb-1 text-center">Ingresa el código de 6 dígitos</Text>
        <Text className="text-gray-500 mb-8 text-center">
          Enviamos un código de recuperación a tu correo {email}
        </Text>

        <OtpInput length={OTP_LENGTH} value={otp} onChange={setOtp} autoFocus disabled={verifying} />

        {verifying && (
          <View className="flex-row items-center justify-center mt-4">
            <ActivityIndicator size="small" color="#2563eb" />
            <Text className="text-gray-500 ml-2">Validando código...</Text>
          </View>
        )}

        {error && <Text className="text-red-600 text-center mt-4">{error}</Text>}
        {resendMessage && !error && <Text className="text-green-600 text-center mt-4">{resendMessage}</Text>}

        <View className="mt-6">
          <Button
            title="Continuar"
            onPress={handleVerify}
            loading={verifying}
            disabled={verifying || otp.length !== OTP_LENGTH}
          />
        </View>

        <PressableScale
          onPress={handleResend}
          disabled={resendSeconds > 0 || resending}
          className="mt-2 py-2"
          accessibilityRole="button"
          accessibilityLabel="Reenviar código"
        >
          <Text className={`text-center ${resendSeconds > 0 ? 'text-gray-400' : 'text-blue-600'}`}>
            {resendSeconds > 0
              ? `Reenviar código (${resendSeconds}s)`
              : resending
                ? 'Reenviando...'
                : 'Reenviar código'}
          </Text>
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit
```
Esperado: sin errores en absoluto — todas las rutas nuevas ya existen.

- [ ] **Paso 3: Commit**

```bash
git add app/reset-password.tsx
git commit -m "feat: pantalla reset-password (verificación de código de recuperación)"
```

---

### Task 11: Integrar el link y el mensaje de éxito en `login.tsx`

**Files:**
- Modify: `app/login.tsx`

**Interfaces:**
- Consumes: nada nuevo de otros módulos.
- Produces: link "¿Olvidaste tu contraseña?" que navega a `/forgot-password` pasando el email ya tipeado; banner verde cuando llega `?passwordReset=1` (emitido por `update-password.tsx` en la Tarea 8).

- [ ] **Paso 1: Reemplazar el archivo completo**

Contenido final de `app/login.tsx`:

```tsx
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocalSearchParams } from 'expo-router';
import { signIn, translateAuthError } from '../features/auth/hooks';
import { AuthTextInput } from '../components/AuthTextInput';
import { Button } from '../components/Button';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    // Without these, an untouched field's value is `undefined` (not `''`)
    // going into Zod, which fails the base z.string() type check before ever
    // reaching .email()/.min() and surfaces Zod's generic English
    // "Invalid input: expected string, received undefined" instead of our
    // Spanish message.
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      // No manual navigation here on purpose: RootNavigator's Stack.Protected
      // guards (app/_layout.tsx) react to useSession()'s state automatically
      // once this resolves.
      await signIn(values.email, values.password);
    } catch (err) {
      setServerError(translateAuthError(err));
    }
  };

  const email = watch('email');

  // Only one message on screen at a time, in priority order: email format,
  // then missing password, then a failed login attempt against the API.
  const formError = errors.email?.message ?? errors.password?.message ?? serverError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold mb-1 text-center">Presupuesto</Text>
        <Text className="text-gray-500 mb-6 text-center">Inicia sesión para continuar</Text>

        {!!passwordReset && (
          <Text className="text-green-600 mb-4 text-center">
            Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.
          </Text>
        )}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="mail-outline"
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="lock-closed-outline"
              placeholder="Contraseña"
              secureTextEntry
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {formError && <Text className="text-red-600 mb-2">{formError}</Text>}

        <Button title="Ingresar" loadingLabel="Ingresando..." onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSubmitting} />

        <Link href={{ pathname: '/forgot-password', params: email ? { email } : undefined }} className="mt-3">
          <Text className="text-blue-600 text-center">¿Olvidaste tu contraseña?</Text>
        </Link>

        <Link href="/register" className="mt-3">
          <Text className="text-blue-600 text-center">¿No tienes cuenta? Regístrate</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add app/login.tsx
git commit -m "feat: link \"olvidaste tu contraseña\" y mensaje de éxito post-reset en login"
```

---

### Task 12: Verificación final de Fase 2

**Files:** ninguno se modifica — solo verificación.

- [ ] **Paso 1: Compilación completa**

```bash
npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Paso 2: Suite de tests completa**

```bash
npx jest
```
Esperado: 100% de los tests en verde (mismos que al final de la Tarea 3 — esta fase no agrega tests nuevos, ver Global Constraints).

- [ ] **Paso 3: Recordatorio del paso manual pendiente**

Este paso no es automatizable: antes de poder probar el flujo de punta a punta hay que confirmar en el Dashboard de Supabase → Authentication → Email Templates → "Reset Password" que el cuerpo del correo incluya `{{ .Token }}` (igual que ya debe estar configurado en "Confirm signup", dado que `verify-otp.tsx` funciona con código). Marcar esta tarea como completa solo después de que el usuario confirme que revisó esto.

- [ ] **Paso 4: Resumen para el usuario**

Al terminar esta tarea, seguir el protocolo de cierre de `AGENTS.md`: resumir en español qué se implementó, qué probar en la app (flujo completo: Login → "¿Olvidaste tu contraseña?" → email → código de 6 dígitos → nueva contraseña con fuerza alta → vuelta a Login con mensaje verde), y confirmar que no hace falta reiniciar el servidor de Expo (todos los cambios de esta fase son de código de pantallas/hooks, recargables por Fast Refresh).
