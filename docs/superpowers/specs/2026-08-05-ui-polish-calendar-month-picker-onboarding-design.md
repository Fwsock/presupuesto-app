# Diseño: fix de botones del detalle, calendario custom, selector rápido de mes/año, y pulido de registro/onboarding

## Contexto

Continúa en el mismo worktree (`movimientos-cuenta-tabbar-revamp`). Se investigó el estado actual antes de diseñar:

- `MovementDetailSheet`'s botones Editar/Eliminar ya tienen el layout `flex-row`/`flex-1`/`rounded-lg` correcto en el código — el problema es un **bug real**, no falta de diseño: `PressableScale` pone `style`/`className` en su `Pressable` interno, no en el `Animated.View` que es el verdadero hijo flex de la fila (el mismo patrón de bug que `MovementListItem.tsx` ya documenta y resuelve en su propio comentario). El fix es envolver cada `PressableScale` en un `View` con `flex-1`, moviendo el resto de las clases (borde, padding, centrado) al `PressableScale`.
- El selector de fecha (`DateField.tsx`, que envuelve `@react-native-community/datetimepicker`) es un componente único, usado en un solo lugar (`MovementFormModal.tsx`). No hay selector de fecha en filtros. "Aplicarlo globalmente" es reemplazar ese único componente.
- `MonthSelector.tsx` es también un componente único, usado en `movimientos.tsx` y `app/(app)/index.tsx` (Resumen) — un cambio ahí cubre ambas pantallas.
- El flujo de registro es: `login.tsx` → `register.tsx` → `verify-otp.tsx` → (sesión creada) → `onboarding.tsx` (pasos internos `perfil` → `ingreso`) → `(app)`. Hoy ninguna de estas pantallas tiene flecha atrás (`Stack screenOptions={{headerShown:false}}` global, sin chrome de navegación). No hay animación de transición configurada explícitamente (usa el default de Expo Router).
- El único texto literal "Cargando..." de la app está en `app/_layout.tsx` (gate inicial de sesión/perfil, antes de mostrar cualquier pantalla). `verify-otp.tsx` tiene "Validando código..." con `ActivityIndicator` — es un mensaje contextual específico, no el genérico "Cargando...", así que queda fuera de esta tarea.
- Paleta azul de la app: Tailwind `blue-600` (`#2563eb`), ya usado consistentemente (links, spinners, botón "Guardar" del sheet de confirmación).

**Decisiones ya confirmadas contigo:**
- El calendario se construye 100% custom (grilla de mes propia), no un envoltorio sobre el picker nativo — es la única forma de sacar el celeste nativo de Android.
- Flecha atrás: Verificar-código → Registro (sí), Ingreso Mensual → Nombre/Celular dentro de Onboarding (sí, cambio de step local), Nombre/Celular → nada (no, porque Verificar-código ya no es alcanzable en esa rama de navegación una vez existe sesión).

## 0. Fix: layout de Editar/Eliminar en MovementDetailSheet

En `components/MovementDetailSheet.tsx`, el bloque de acciones pasa de:
```tsx
<PressableScale onPress={onEdit} className="flex-1 flex-row items-center justify-center py-3 rounded-lg border border-gray-300">
```
a:
```tsx
<View className="flex-1">
  <PressableScale onPress={onEdit} className="flex-row items-center justify-center py-3 px-3 rounded-lg border border-gray-300">
```
(mismo patrón para el botón Eliminar). Se agrega `px-3` explícito para que el texto nunca toque el borde del botón. Sin cambios de comportamiento, solo de layout.

## 1. Calendario custom (`components/CalendarPickerModal.tsx`)

- Modal centrado (mismo lenguaje visual que `ConfirmDialog`: fade + scale-in, tarjeta blanca `rounded-2xl`, no bottom-sheet) con:
  - Encabezado: nombre del mes + año (ej. "Agosto 2026") con flechas `chevron-back`/`chevron-forward` para navegar mes a mes (reutiliza el mismo patrón visual de `MonthSelector`).
  - Grilla de 7 columnas (L-M-M-J-V-S-D) × hasta 6 filas, generada con una función pura `buildCalendarGrid(year, month)` que devuelve los días del mes más el padding de días del mes anterior/siguiente para completar la grilla (los de relleno se muestran atenuados y no son seleccionables).
  - Día seleccionado: círculo `bg-blue-600` con texto blanco. Día de hoy (si no es el seleccionado): borde `border-blue-600` sin relleno. Días normales: texto `text-gray-900`. Días de relleno: `text-gray-300`.
  - Footer: botones "Cancelar" (outline, gris) y "Guardar" (`bg-blue-600`, texto blanco) — mismo patrón de `ConfirmDialog`'s `VARIANT_CLASSES`.
- Selección de día actualiza un estado local (no cierra el modal ni confirma hasta "Guardar"); "Cancelar" descarta la selección local y cierra sin llamar `onChange`.
- `DateField.tsx` se reescribe para abrir este modal en vez de `DateTimePicker`, en ambas plataformas (Android e iOS) — mismo comportamiento en los dos, ya no hay rama por `Platform.OS`.
- `@react-native-community/datetimepicker` deja de importarse desde `DateField.tsx` (no se desinstala el paquete del proyecto, solo se deja de usar ahí, ya que no es la pieza a remover de package.json en esta tarea).
- Tests unitarios para `buildCalendarGrid` (mes completo, mes que empieza a mitad de semana, año bisiesto, relleno de días del mes anterior/siguiente correcto).

## 2. Selector rápido de mes/año (`components/MonthYearPickerModal.tsx`)

- `MonthSelector.tsx` gana un indicador de interactividad: el texto "Agosto 2026" se envuelve en un `PressableScale` con un ícono `chevron-down` al lado, y al presionarlo abre `MonthYearPickerModal`.
- Modal centrado, mismo lenguaje visual que el calendario (tarjeta `rounded-2xl`, fade+scale):
  - Selector de año arriba (flechas ‹ › a los costados de un texto "2026").
  - Grilla de 3×4 con los 12 nombres de mes abreviados (`MONTH_NAMES`), el mes activo resaltado en `bg-blue-600`/texto blanco.
  - Tocar un mes selecciona año+mes juntos y cierra el modal de inmediato llamando `onChange(year, month)` (dos toques: año si hace falta cambiarlo, luego mes — sin botón "Guardar" separado, ya que elegir el mes ya es la confirmación).
- `MonthSelector` sigue recibiendo `year`, `month`, `onChange` sin cambios de firma — el modal es interno a este componente.

## 3. Auditoría de Registro/Onboarding

- **Transiciones:** `app/_layout.tsx`'s `<Stack screenOptions={{headerShown:false}}>` gana `animation: 'slide_from_right'` explícito, para que las 3 plataformas (iOS/Android) se comporten igual en vez del default implícito de la librería.
- **Flecha atrás:** nuevo componente pequeño `components/BackButton.tsx` (ícono `arrow-back`, safe-area-aware con `useSafeAreaInsets`, posicionado arriba-izquierda). Se agrega:
  - `verify-otp.tsx`: `onPress={() => router.back()}`.
  - `onboarding.tsx`, paso `'ingreso'`: `onPress={() => setStep('perfil')}` (sin navegación, cambio de estado local).
  - `onboarding.tsx`, paso `'perfil'`: sin flecha (primer paso alcanzable de esa rama).
  - `register.tsx`: sin flecha (primer paso del flujo completo; ya tiene el link "¿Ya tienes cuenta?" hacia login, que cumple un rol similar).
- **Cargando → Skeleton:** `app/_layout.tsx`'s bloque `<Text>Cargando...</Text>` se reemplaza por `<ScreenSkeleton />` (ya existe en `components/Skeleton.tsx`, se reutiliza tal cual, sin crear un skeleton nuevo).

## Fuera de alcance

- No se toca `verify-otp.tsx`'s "Validando código..." (mensaje contextual específico, no genérico).
- No se desinstala `@react-native-community/datetimepicker` de `package.json` (queda sin uso pero no forma parte de esta tarea).
- No se agrega flecha atrás en `register.tsx` ni en `login.tsx` (primeros pasos de sus respectivas ramas).
- No se cambia la arquitectura de `Stack.Protected` / guardas de sesión.
