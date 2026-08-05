# Diseño: merge parcial a master, endurecimiento de seguridad realista, header azul, y consolidación de Seguridad en Cuenta

## Contexto

Se investigó el estado actual antes de diseñar:

- El worktree tiene 38 commits por delante de `master` (mis dos planes ya implementados, revisados y probados esta sesión), y **59 archivos adicionales sin commitear** — trabajo previo de una sesión anterior (tab-bar, rediseño de Cuenta, pantallas de auth) que nunca fue revisado ni auditado por mí. No hay remoto configurado (`git remote -v` vacío) — el merge es 100% local.
- **RLS ya está correctamente implementado**: `categories`, `movements`, `profiles`, `recurring_income` tienen `enable row level security` + policy `using (auth.uid() = user_id/id) with check (auth.uid() = user_id/id)` (migraciones 0001 y 0003).
- **Cero uso de `.rpc()` o SQL crudo** en toda la app — únicamente el query builder de `supabase-js` (parametrizado automáticamente vía PostgREST). No hay vector de SQL injection clásico en la arquitectura actual.
- **La service role key nunca está en código de cliente** — solo en `.env`, usada por `scripts/*.js` (Node, fuera de la app).
- **XSS "clásico" no aplica a React Native** de la misma forma que a una web app: no hay `dangerouslySetInnerHTML` ni renderizado de HTML; `Text`/`TextInput` no ejecutan contenido inyectado.
- Único `console.error` real de la app: `lib/supabase.ts`'s `logSupabaseError`, sin gate de `__DEV__` — corre también en builds de producción.
- Header: `app/(app)/_layout.tsx` usa `<Tabs screenOptions={{headerShown:true}}>` (header nativo default, sin estilo). Solo `categorias.tsx` personaliza su header (vía `navigation.setOptions({headerRight...})`, botón "+ Nueva categoría" en `text-blue-600` — quedaría invisible sobre un header azul si no se cambia).
- Cuenta → Seguridad: dos formularios independientes (`changeEmail`/`updateEmail`, `changePassword`/`updatePassword`), cada uno con su propio botón y sus propios estados de error/pending/mensaje.

**Decisiones ya confirmadas contigo:**
- El merge a master lleva SOLO los 38 commits ya revisados; los 59 archivos sin commitear quedan intactos en el worktree para una revisión aparte más adelante.
- "Guardar cambios" único: guarda lo que esté completo (solo correo, solo contraseña, o ambos), deshabilitado si los dos campos están vacíos.

## 1. Merge parcial a master

- `git checkout master` en el checkout raíz, `git merge --no-ff worktree-movimientos-cuenta-tabbar-revamp` (merge explícito, no fast-forward, para que el historial deje claro que fue una integración de rama de feature, no commits directos a master).
- Antes de mergear: confirmar que `master` no tiene cambios propios sin commitear que pudieran perderse (ya verificado: solo `$log`, un archivo de log de una sesión de Expo previa, no código).
- Después del merge: correr `npx jest` y `npx tsc --noEmit` en la raíz (`master` ya actualizado) para confirmar que el estado fusionado compila y pasa tests igual que en el worktree.
- El worktree sigue existiendo y con su rama activa después del merge (no se borra ni se hace `git worktree remove`) — los puntos 2-4 de este plan se implementan ahí, no en master directamente, siguiendo el mismo patrón de todo lo hecho hoy.

## 2. Seguridad — endurecimiento real, no teatro

Basado en los hallazgos de arriba, el trabajo real y de valor es:

- **Logging condicionado a desarrollo:** `logSupabaseError` (`lib/supabase.ts`) se envuelve en `if (__DEV__)` — deja de imprimir el objeto de error crudo de Supabase en builds de producción, sin perder el detalle en desarrollo.
- **Sanitización de inputs de texto:** nueva función pura `sanitizeText(value: string, maxLength: number): string` en `features/shared/sanitize.ts` — recorta espacios, elimina caracteres de control no imprimibles (defensa contra payloads malformados o intentos de manipular renderizado/exportaciones futuras), y trunca a un largo máximo razonable. Se aplica en la capa de API (no en cada input individual) a los campos de texto libre que llegan a la base de datos: `nombre` de categoría (`features/categories/api.ts`), `concepto`/`notas` de movimiento (`features/movements/api.ts`), `nombre` de perfil (`features/profile/api.ts` si existe esa capa, si no donde se hace el upsert).
- **Suite de tests de seguridad**, enfocada en lo que es real y verificable de forma automática (no requiere una base de datos viva):
  - `__tests__/sanitizeText.test.ts` — la función nueva: recorte, límite de largo, remoción de caracteres de control, casos límite (vacío, solo espacios, exactamente en el límite).
  - `__tests__/rlsPolicies.test.ts` — lee los archivos `.sql` de `supabase/migrations/` como texto plano y verifica, para cada una de las 4 tablas de datos de usuario (`categories`, `movements`, `profiles`, `recurring_income`), que exista `enable row level security` y una policy con `auth.uid() = user_id` (o `= id` para `profiles`) tanto en `using` como en `with check`. Esto es una prueba de regresión real: si alguien agrega una tabla nueva sin RLS, o debilita una policy, este test falla.
  - `__tests__/noRawSql.test.ts` — escaneo estático de todos los archivos `features/**/api.ts` y `lib/*.ts`: falla si aparece `.rpc(` (llamada a función remota, canal más común para SQL crudo con `supabase-js`) o construcción de query por concatenación de strings. Documenta y fija como regla automatizada la ausencia actual de SQL crudo.
  - `__tests__/secureLogging.test.ts` — confirma que `logSupabaseError` respeta `__DEV__` (mockeando la global en ambos valores y espiando `console.error`).
- **Fuera de alcance, justificado:** no se implementa sanitización anti-XSS de HTML (no aplica al modelo de renderizado de React Native), no se agregan tests de penetración contra RLS con una base de datos real (Jest corre en Node sin conexión a Supabase; la cobertura real de RLS ya está garantizada por las policies mismas más el test estático de su presencia).

## 3. Header azul con texto blanco

- `app/(app)/_layout.tsx`: `<Tabs screenOptions={{...}}>` gana:
  ```
  headerStyle: { backgroundColor: '#2563eb' },
  headerTintColor: '#ffffff',
  headerTitleStyle: { color: '#ffffff', fontWeight: '600' },
  ```
  (`#2563eb` = Tailwind `blue-600`, el mismo azul corporativo ya usado en toda la app esta sesión). Esto cubre Resumen, Movimientos, Categorías y Cuenta de una sola vez, sin tocar cada pantalla — ninguna de las 4 sobreescribe `headerStyle`/`headerTitleStyle` hoy (verificado: solo `categorias.tsx` usa `setOptions`, y solo para `headerRight`).
- `categorias.tsx`: el botón "+ Nueva categoría" pasa de `text-blue-600` (invisible sobre fondo azul) a texto blanco con un borde/fondo sutil que le da contraste y feedback táctil, manteniendo `PressableScale` para la animación de presión ya estándar en la app:
  ```
  className="mr-3 px-3 py-1.5 rounded-full border border-white/70"
  ...
  <Text className="text-white font-medium text-sm">+ Nueva categoría</Text>
  ```

## 4. Consolidación de Seguridad en Cuenta

- Un solo estado de pendiente/error/mensaje compartido en vez de dos independientes.
- `handleGuardarCambios`: si `newEmail` tiene contenido, llama `updateEmail`; si `newPassword` tiene al menos 6 caracteres, llama `updatePassword`; ejecuta las que apliquen (una, otra, o ambas — en paralelo con `Promise.allSettled` para que un fallo en una no cancele la otra), agrega el mensaje/error de cada una que corrió, y limpia solo el campo que se guardó con éxito.
- Un solo botón "Guardar cambios" al final de ambos bloques de campos, deshabilitado cuando ambos campos están vacíos.
- Se ajusta el espaciado entre el bloque de correo y el de contraseña (`mt-6` ya existente entre bloques se mantiene) y se agrega separación consistente antes del botón final (`mt-4` o similar) para que no quede pegado al último campo.

## 5. Verificación final

- `npx jest` (worktree) — todo verde, incluyendo los 4 tests nuevos de seguridad.
- `npx tsc --noEmit` (worktree) — limpio.
- `npx jest` + `npx tsc --noEmit` en `master` después del merge (paso separado, ver punto 1) para confirmar que el estado fusionado también compila y pasa.
