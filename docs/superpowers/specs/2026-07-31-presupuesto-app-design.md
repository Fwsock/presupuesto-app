# Diseño: App móvil de presupuesto mensual personal

**Fecha:** 2026-07-31
**Estado:** Aprobado por el usuario, pendiente de plan de implementación

## Contexto y objetivo

Reemplazar un Excel personal de presupuesto mensual por una app móvil (React Native + Expo) con backend en Supabase. Es un proyecto de un solo usuario (sin soporte multi-usuario por ahora). El presupuesto es siempre mensual, nunca anual ni semanal.

El Excel actual usa las categorías: Ingresos, Gastos Fijos, CMR (tarjeta de crédito), Cuotas/Crédito, Gastos Extras y Ahorro. Cada movimiento tiene: concepto, monto, notas, estado (Pendiente/Pagado) y fecha.

## Alcance funcional

1. Crear categorías propias libremente, además de las 6 iniciales.
2. Registrar movimientos en cuotas (ej. 6 cuotas de $21.248) que se repiten automáticamente cada mes hasta completarse, sin reingreso manual.
3. Editar o eliminar cualquier movimiento —incluidas cuotas ya generadas— mediante un ícono de lápiz que abre un popup de edición.
4. Persistencia en la nube con Supabase (proyecto ya existente del usuario).
5. Vista principal: resumen del mes actual con totales por categoría y saldo disponible, calculado automáticamente.

Fuera de alcance (explícitamente no se construye en esta versión):
- Soporte multi-usuario / compartir presupuesto con otras personas.
- Modo offline o sincronización diferida.
- Propagar ediciones de una cuota a las cuotas restantes de la serie.
- Generación de cuotas mes a mes vía cron/Edge Function (se generan todas de una vez al crear la serie).
- Vistas o cálculos agregados a nivel anual/semanal.

## Decisiones de producto

- **Autenticación:** Supabase Auth con email/password desde el día uno (no se arranca sin login).
- **Estado de cuotas al generarse:** cada cuota futura nace en estado `Pendiente`; el usuario la marca `Pagado` manualmente cuando corresponde.
- **Generación de cuotas:** todas las filas de la serie se crean de una sola vez al registrar la cuota (no hay generación diferida ni jobs programados en el servidor).
- **Edición/eliminación de una cuota:** afecta solo a ese movimiento puntual. No existe la opción de propagar el cambio a "esta y las siguientes" cuotas de la serie.
- **Signo por categoría:** cada categoría tiene un `tipo` (`ingreso` | `gasto`). `Ingresos` suma al saldo; todas las demás categorías —incluida `Ahorro`— restan, igual que en el Excel actual.
- **Estado y saldo:** el saldo disponible del mes solo considera movimientos en estado `Pagado`. Los `Pendiente` se muestran de forma informativa pero no afectan el saldo actual.
- **Plataforma:** solo móvil (iOS/Android vía Expo), siempre con conexión a internet. Sin soporte offline.
- **Navegación temporal:** la vista principal permite navegar a meses pasados y futuros (necesario porque las cuotas se extienden varios meses).

## Arquitectura

App Expo (React Native) con Supabase como backend único (Auth + Postgres + Row Level Security). No hay servidor propio ni funciones programadas: toda la lógica de negocio corre en el cliente; Supabase solo persiste y protege los datos por usuario mediante RLS (`auth.uid() = user_id` en cada tabla).

**Stack técnico:**
- **Expo Router** — navegación basada en archivos.
- **React Query (`@tanstack/react-query`)** — fetch, cache e invalidación de datos contra Supabase. Al crear/editar/eliminar un movimiento o categoría, se invalida la query del mes correspondiente y la UI se refresca sola.
- **NativeWind** — estilos con utilidades tipo Tailwind.
- **React Hook Form + Zod** — formularios (movimiento, categoría, login) con validación.

## Modelo de datos

Dos tablas propias además de `auth.users` (provista por Supabase Auth):

```
categories
  id            uuid pk
  user_id       uuid   -- FK a auth.users, protegido por RLS
  nombre        text
  tipo          text   -- 'ingreso' | 'gasto'
  created_at    timestamptz

movements
  id                    uuid pk
  user_id               uuid   -- FK a auth.users, protegido por RLS
  category_id           uuid   -- FK a categories
  concepto              text
  monto                 numeric
  notas                 text nullable
  estado                text   -- 'pendiente' | 'pagado'
  fecha                 date
  installment_group_id  uuid nullable  -- comparten valor las cuotas de una misma compra
  cuota_numero          int nullable   -- ej. 3
  cuota_total           int nullable   -- ej. 6
  created_at            timestamptz
  updated_at            timestamptz
```

**Sin tabla separada para series de cuotas:** cada cuota es una fila independiente de `movements` que comparte un `installment_group_id` (UUID generado al crear la serie, usado solo para agrupar visualmente y mostrar el badge "Cuota 3/6"). No existe una entidad padre con ciclo de vida propio, en línea con la decisión de que cada cuota se edita/elimina de forma independiente.

**RLS:** ambas tablas tienen políticas que restringen todas las operaciones a `auth.uid() = user_id`.

**Cálculo de saldo y totales:** derivado en el cliente (`useMemo`) a partir de los movimientos del mes ya cargados por `useMovements(mes)`: se suman los `ingreso` y se restan los `gasto` considerando solo `estado = 'pagado'`. No se usa vista SQL ni función RPC — el volumen de datos de un presupuesto personal no lo justifica.

## Pantallas

- **`/login`** — Email/password contra Supabase Auth. Sin registro público visible; el usuario único se crea manualmente.
- **`/(app)/index`** — Resumen del mes: selector de mes con flechas (‹ Julio 2026 ›), totales por categoría, saldo disponible destacado. Cada categoría es tocable y lleva al listado filtrado.
- **`/(app)/movimientos`** — Lista de movimientos del mes seleccionado (comparte el mes con el resumen). Cada fila muestra concepto, monto, categoría, estado (con toggle rápido Pendiente↔Pagado) y el ícono de lápiz que abre el popup de edición. Las cuotas muestran un badge "3/6". FAB (+) para agregar movimiento.
- **`/(app)/categorias`** — Lista de categorías (las 6 iniciales + las que agregue el usuario), con crear/renombrar/eliminar.
- **Modal "Crear/Editar movimiento"** — concepto, monto, categoría (picker), notas, fecha, estado. Al **crear**, un switch "¿Es en cuotas?" despliega el número de cuotas y genera todas las filas de una vez. Al **editar** una cuota ya generada, el formulario es el mismo pero sin el campo de cuotas (es un movimiento individual).

## Flujo de datos

- `useCategories()`, `useMovements(mes)` — queries cacheadas por mes.
- `useCreateMovement()`, `useCreateInstallments()` (inserta N filas en un solo `insert` con array), `useUpdateMovement()`, `useDeleteMovement()` — mutations que invalidan la query del mes al completar.
- `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` — mismas convenciones.

## Manejo de errores

- **Red / Supabase caído:** React Query reintenta con backoff; si falla, se muestra un banner inline ("No se pudo cargar. Reintentar") en vez de pantalla en blanco.
- **Login inválido:** error inline bajo el formulario, sin exponer detalles técnicos de Supabase.
- **Validación de formularios (Zod):** monto > 0, concepto obligatorio, fecha obligatoria, número de cuotas ≥ 1 si el switch "es cuota" está activo.
- **Eliminar categoría con movimientos asociados:** se bloquea con mensaje claro ("Esta categoría tiene N movimientos. Reasígnalos o elimínalos primero"), evitando movimientos huérfanos.
- **Mutaciones:** sin optimistic updates en v1 — spinner breve y refresco al confirmar (latencia de Supabase imperceptible en este volumen de datos).

## Testing

- **Unit tests (Jest)** para la lógica pura con reglas de negocio reales: generación de las N filas de una serie de cuotas (fechas, monto, `cuota_numero`/`cuota_total` correctos) y el cálculo de saldo/totales por categoría a partir de un array de movimientos.
- **Sin Detox/e2e:** para una app personal de un solo usuario, un suite e2e completo es más mantenimiento que valor. Se prueba manualmente en Expo Go durante desarrollo.
- **Sin tests de integración contra Supabase real:** se prueban las queries/mutations manualmente contra el proyecto real durante desarrollo.

## Credenciales y configuración pendiente

Las credenciales del proyecto Supabase (URL + anon key) las provee el usuario al momento de implementar la configuración inicial del cliente (`lib/supabase.ts`), y se guardan como variables de entorno de Expo (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), no hardcodeadas ni commiteadas al repositorio.
