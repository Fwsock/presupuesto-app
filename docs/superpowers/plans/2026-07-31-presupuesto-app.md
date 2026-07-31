# Presupuesto App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal mobile budget-tracking app (React Native + Expo + Supabase) that replaces the user's Excel spreadsheet: custom categories, auto-repeating installment movements, editable/deletable movements, and an auto-calculated monthly summary.

**Architecture:** Expo app using Expo Router for navigation, Supabase for Auth + Postgres + Row Level Security (no custom backend/server), React Query for data fetching/cache/invalidation, NativeWind for styling, React Hook Form + Zod for form validation.

**Tech Stack:** Expo (TypeScript template), expo-router, @tanstack/react-query, @supabase/supabase-js, nativewind + tailwindcss, react-hook-form, @hookform/resolvers, zod, uuid + react-native-get-random-values, jest + ts-jest.

## Global Constraints

- Solo móvil (iOS/Android vía Expo), siempre requiere conexión a internet — sin modo offline ni cola de sincronización.
- Toda pantalla de datos requiere sesión activa (Supabase Auth email/password) — sin acceso sin login.
- RLS habilitado en toda tabla nueva: las políticas restringen todo a `auth.uid() = user_id`.
- El presupuesto es siempre mensual — toda query de movimientos está acotada a un mes calendario, nunca anual ni semanal.
- Sin soporte multi-usuario, sin cron/Edge Functions, sin generación diferida de cuotas (se generan todas de una vez).
- Editar/eliminar una cuota afecta solo a ese movimiento — no hay propagación a "esta y las siguientes".
- Sin optimistic updates en v1, sin Detox/e2e, sin tests de integración contra Supabase real (verificación manual vía Expo Go) — solo se testean con TDD las dos piezas de lógica pura: generación de cuotas y cálculo de resumen mensual.
- Credenciales de Supabase vía variables de entorno `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, nunca hardcodeadas ni commiteadas.

---

## Task 1: Project scaffolding & tooling

**Files:**
- Create: `package.json`, `app.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `tsconfig.json`, `jest.config.js`, `.env.example`, `.gitignore`
- Create: `app/_layout.tsx` (placeholder), `app/index.tsx` (placeholder)

**Interfaces:**
- Produces: a bootable Expo TypeScript project with expo-router, NativeWind, React Query, React Hook Form/Zod, Supabase client library, and Jest all installed and configured. Later tasks assume these are available as imports.

- [ ] **Step 1: Scaffold the Expo project**

Run inside `presupuesto-app/` (which already has `.git` and `docs/`):

```bash
npx create-expo-app@latest . --template blank-typescript
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install @tanstack/react-query @supabase/supabase-js react-hook-form @hookform/resolvers zod uuid react-native-get-random-values
npm install nativewind tailwindcss
```

- [ ] **Step 3: Install dev/test dependencies**

```bash
npm install -D jest ts-jest @types/jest @types/uuid typescript
```

- [ ] **Step 4: Configure Expo Router entry point**

In `package.json`, set:

```json
{
  "main": "expo-router/entry"
}
```

In `app.json`, add the router plugin and a URL scheme:

```json
{
  "expo": {
    "scheme": "presupuestoapp",
    "plugins": ["expo-router"]
  }
}
```

- [ ] **Step 5: Configure NativeWind**

Create `global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `tailwind.config.js`:

```js
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
```

Create/replace `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

Create `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 6: Configure Jest for pure-logic unit tests**

Create `jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

In `package.json` scripts, add:

```json
{
  "scripts": {
    "test": "jest"
  }
}
```

- [ ] **Step 7: Create env template and gitignore entries**

Create `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Ensure `.gitignore` includes:

```
node_modules/
.env
.expo/
dist/
```

- [ ] **Step 8: Verify the project builds and type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (the default `blank-typescript` template's `App.tsx`/`app/` files type-check cleanly).

Run: `npx expo start --no-dev --non-interactive` and stop it once Metro bundles successfully (Ctrl+C), or use `npx expo-doctor` to confirm the config is valid.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo app with router, NativeWind, React Query, Jest"
```

---

## Task 2: Supabase client & env config

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/queryClient.ts`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` env vars (Task 1's `.env.example`).
- Produces: `supabase` (typed `SupabaseClient`) — imported by every `features/*/api.ts` file. `queryClient` (typed `QueryClient`) — imported by `app/_layout.tsx` in Task 14.

- [ ] **Step 1: Create the Supabase client**

Create `lib/supabase.ts`:

```ts
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Create the React Query client**

Create `lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});
```

- [ ] **Step 3: Get the user's Supabase credentials and create `.env`**

Ask the user for their Supabase project URL and anon key (Project Settings → API in the Supabase dashboard). Create `.env` (not committed) with:

```
EXPO_PUBLIC_SUPABASE_URL=<their url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<their anon key>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Write a throwaway `scripts/check-supabase.ts` that imports `supabase` and calls `supabase.auth.getSession()`, run it with `npx ts-node scripts/check-supabase.ts` (or temporarily import it in `app/index.tsx` and check the Metro logs), confirm it resolves without a network/config error, then delete the throwaway script.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts lib/queryClient.ts .env.example
git commit -m "feat: add Supabase and React Query clients"
```

---

## Task 3: Database schema (SQL migration)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: `categories` and `movements` tables in the user's Supabase project, matching the types defined in Task 6 (`Category`) and Task 8 (`Movement`), with RLS enforcing `auth.uid() = user_id`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  created_at timestamptz not null default now()
);

create table movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  concepto text not null,
  monto numeric not null check (monto > 0),
  notas text,
  estado text not null check (estado in ('pendiente', 'pagado')),
  fecha date not null,
  installment_group_id uuid,
  cuota_numero int,
  cuota_total int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table movements enable row level security;

create policy "categories_owner_all" on categories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "movements_owner_all" on movements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index movements_user_fecha_idx on movements (user_id, fecha);
create index movements_category_idx on movements (category_id);
```

Note: `category_id ... on delete restrict` is what makes deleting a category with associated movements fail with Postgres error code `23503` — Task 9's `deleteCategory` catches this and turns it into the user-facing message from the spec.

- [ ] **Step 2: Run the migration against the user's Supabase project**

In the Supabase dashboard SQL editor (or via `supabase db push` if the user has the Supabase CLI linked to their project), run the contents of `0001_init.sql`.

- [ ] **Step 3: Verify**

In the Supabase dashboard, confirm both tables exist under Table Editor, and that RLS is shown as enabled on both.

Manually insert a test row as an authenticated user (via the SQL editor's "Run as" or via the app once Task 6's login exists) and confirm a different/anonymous session cannot read it.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add categories and movements schema with RLS"
```

---

## Task 4: Pure logic — installment generation (TDD)

**Files:**
- Create: `features/movements/installments.ts`
- Test: `__tests__/installments.test.ts`

**Interfaces:**
- Produces: `NewInstallmentInput`, `InstallmentRow`, `generateInstallments(input, groupId): InstallmentRow[]` — consumed by Task 8's `createInstallments` and Task 11's `MovementFormModal`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/installments.test.ts`:

```ts
import { generateInstallments } from '../features/movements/installments';

describe('generateInstallments', () => {
  it('generates one row per cuota with sequential months', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'Notebook',
        montoCuota: 21248,
        notas: null,
        totalCuotas: 6,
        fechaInicio: '2026-07-31',
      },
      'group-1'
    );

    expect(rows).toHaveLength(6);
    expect(rows[0].fecha).toBe('2026-07-31');
    expect(rows[1].fecha).toBe('2026-08-31');
    expect(rows[5].fecha).toBe('2026-12-31');
  });

  it('clamps day-of-month when the target month is shorter', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'Curso',
        montoCuota: 10000,
        notas: null,
        totalCuotas: 3,
        fechaInicio: '2026-01-31',
      },
      'group-2'
    );

    expect(rows[1].fecha).toBe('2026-02-28');
    expect(rows[2].fecha).toBe('2026-03-31');
  });

  it('sets cuota_numero, cuota_total, estado and shared group id on every row', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'TV',
        montoCuota: 5000,
        notas: 'Compra Falabella',
        totalCuotas: 2,
        fechaInicio: '2026-03-15',
      },
      'group-3'
    );

    expect(rows[0]).toMatchObject({
      cuota_numero: 1,
      cuota_total: 2,
      estado: 'pendiente',
      installment_group_id: 'group-3',
      notas: 'Compra Falabella',
    });
    expect(rows[1]).toMatchObject({
      cuota_numero: 2,
      cuota_total: 2,
      estado: 'pendiente',
      installment_group_id: 'group-3',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest installments -v`
Expected: FAIL with "Cannot find module '../features/movements/installments'"

- [ ] **Step 3: Implement `generateInstallments`**

Create `features/movements/installments.ts`:

```ts
export interface NewInstallmentInput {
  categoryId: string;
  concepto: string;
  montoCuota: number;
  notas: string | null;
  totalCuotas: number;
  fechaInicio: string; // 'YYYY-MM-DD', date of the first installment
}

export interface InstallmentRow {
  category_id: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: 'pendiente';
  fecha: string;
  installment_group_id: string;
  cuota_numero: number;
  cuota_total: number;
}

function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);
  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function generateInstallments(input: NewInstallmentInput, groupId: string): InstallmentRow[] {
  const rows: InstallmentRow[] = [];
  for (let i = 0; i < input.totalCuotas; i++) {
    rows.push({
      category_id: input.categoryId,
      concepto: input.concepto,
      monto: input.montoCuota,
      notas: input.notas,
      estado: 'pendiente',
      fecha: addMonths(input.fechaInicio, i),
      installment_group_id: groupId,
      cuota_numero: i + 1,
      cuota_total: input.totalCuotas,
    });
  }
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest installments -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add features/movements/installments.ts __tests__/installments.test.ts
git commit -m "feat: add installment series generation with TDD"
```

---

## Task 5: Pure logic — month summary calculation (TDD)

**Files:**
- Create: `features/movements/summary.ts`
- Test: `__tests__/summary.test.ts`

**Interfaces:**
- Consumes: `Category` type (defined inline here, matches Task 6's `features/categories/types.ts`), `Movement` type (defined inline here, matches Task 8's `features/movements/types.ts`).
- Produces: `CategoryTotal`, `MonthSummary`, `calculateMonthSummary(movements, categories): MonthSummary` — consumed by Task 12's Resumen screen.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/summary.test.ts`:

```ts
import { calculateMonthSummary } from '../features/movements/summary';
import type { Category } from '../features/categories/types';
import type { Movement } from '../features/movements/types';

const categories: Category[] = [
  { id: 'ing', user_id: 'u1', nombre: 'Ingresos', tipo: 'ingreso', created_at: '' },
  { id: 'fijos', user_id: 'u1', nombre: 'Gastos Fijos', tipo: 'gasto', created_at: '' },
  { id: 'ahorro', user_id: 'u1', nombre: 'Ahorro', tipo: 'gasto', created_at: '' },
];

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm',
    user_id: 'u1',
    category_id: 'fijos',
    concepto: 'x',
    monto: 0,
    notas: null,
    estado: 'pagado',
    fecha: '2026-07-01',
    installment_group_id: null,
    cuota_numero: null,
    cuota_total: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('calculateMonthSummary', () => {
  it('sums ingresos and subtracts gastos for the saldo disponible', () => {
    const movements = [
      movement({ category_id: 'ing', monto: 500000, estado: 'pagado' }),
      movement({ category_id: 'fijos', monto: 100000, estado: 'pagado' }),
      movement({ category_id: 'ahorro', monto: 50000, estado: 'pagado' }),
    ];

    const summary = calculateMonthSummary(movements, categories);

    expect(summary.totalIngresos).toBe(500000);
    expect(summary.totalGastos).toBe(150000);
    expect(summary.saldoDisponible).toBe(350000);
  });

  it('ignores movements that are still pendiente', () => {
    const movements = [
      movement({ category_id: 'ing', monto: 500000, estado: 'pagado' }),
      movement({ category_id: 'fijos', monto: 999999, estado: 'pendiente' }),
    ];

    const summary = calculateMonthSummary(movements, categories);

    expect(summary.totalGastos).toBe(0);
    expect(summary.saldoDisponible).toBe(500000);
  });

  it('includes every category in totalsByCategory even with zero movements', () => {
    const summary = calculateMonthSummary([], categories);

    expect(summary.totalsByCategory).toHaveLength(3);
    expect(summary.totalsByCategory.every((c) => c.total === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest summary -v`
Expected: FAIL with "Cannot find module '../features/movements/summary'" (and `features/categories/types`, `features/movements/types` won't exist yet either — that's expected, Task 6 and Task 8 create them; create minimal stub type files now if needed so this task's test file compiles, or run Task 6/8's type files first. See Step 3.)

- [ ] **Step 3: Implement `calculateMonthSummary`**

Create `features/categories/types.ts` (if not already created by Task 6 — check first, this file is shared):

```ts
export type CategoryType = 'ingreso' | 'gasto';

export interface Category {
  id: string;
  user_id: string;
  nombre: string;
  tipo: CategoryType;
  created_at: string;
}
```

Create `features/movements/types.ts` (if not already created by Task 8 — check first, this file is shared):

```ts
export type MovementStatus = 'pendiente' | 'pagado';

export interface Movement {
  id: string;
  user_id: string;
  category_id: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  installment_group_id: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
  created_at: string;
  updated_at: string;
}
```

Create `features/movements/summary.ts`:

```ts
import type { Category, CategoryType } from '../categories/types';
import type { Movement } from './types';

export interface CategoryTotal {
  categoryId: string;
  nombre: string;
  tipo: CategoryType;
  total: number;
}

export interface MonthSummary {
  totalIngresos: number;
  totalGastos: number;
  saldoDisponible: number;
  totalsByCategory: CategoryTotal[];
}

export function calculateMonthSummary(movements: Movement[], categories: Category[]): MonthSummary {
  const paidMovements = movements.filter((m) => m.estado === 'pagado');

  const totalsByCategory: CategoryTotal[] = categories.map((category) => {
    const total = paidMovements
      .filter((m) => m.category_id === category.id)
      .reduce((sum, m) => sum + m.monto, 0);
    return { categoryId: category.id, nombre: category.nombre, tipo: category.tipo, total };
  });

  const totalIngresos = totalsByCategory
    .filter((c) => c.tipo === 'ingreso')
    .reduce((sum, c) => sum + c.total, 0);
  const totalGastos = totalsByCategory
    .filter((c) => c.tipo === 'gasto')
    .reduce((sum, c) => sum + c.total, 0);

  return {
    totalIngresos,
    totalGastos,
    saldoDisponible: totalIngresos - totalGastos,
    totalsByCategory,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest summary -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add features/movements/summary.ts features/movements/types.ts features/categories/types.ts __tests__/summary.test.ts
git commit -m "feat: add monthly summary calculation with TDD"
```

---

## Task 6: Auth — session hooks and login screen

**Files:**
- Create: `features/auth/hooks.ts`
- Create: `app/login.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 2).
- Produces: `useSession(): { session: Session | null, loading: boolean }`, `signIn(email, password): Promise<void>`, `signOut(): Promise<void>` — consumed by Task 14's root layout and any screen with a logout button.

- [ ] **Step 1: Implement session hooks**

Create `features/auth/hooks.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

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

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

- [ ] **Step 2: Build the login screen**

Create `app/login.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { signIn } from '../features/auth/hooks';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      await signIn(values.email, values.password);
      router.replace('/');
    } catch (err) {
      setServerError('Email o contraseña incorrectos');
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-6">Presupuesto</Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2 mb-1"
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={value ?? ''}
            onChangeText={onChange}
          />
        )}
      />
      {errors.email && <Text className="text-red-600 mb-2">{errors.email.message}</Text>}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2 mb-1"
            placeholder="Contraseña"
            secureTextEntry
            value={value ?? ''}
            onChangeText={onChange}
          />
        )}
      />
      {errors.password && <Text className="text-red-600 mb-2">{errors.password.message}</Text>}

      {serverError && <Text className="text-red-600 mb-2">{serverError}</Text>}

      <Pressable
        className="bg-blue-600 rounded-md py-3 mt-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        <Text className="text-white text-center font-semibold">
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

This screen is fully wired to routing/auth-gating in Task 14 — manual verification (typing wrong credentials shows the inline error, correct credentials navigates away) happens there once the root layout exists.

- [ ] **Step 4: Commit**

```bash
git add features/auth/hooks.ts app/login.tsx
git commit -m "feat: add Supabase auth session hooks and login screen"
```

---

## Task 7: Categories data layer

**Files:**
- Create: `features/categories/api.ts`
- Create: `features/categories/hooks.ts`
- Modify: `features/categories/types.ts` (created in Task 5 — add `NewCategoryInput`, `UpdateCategoryInput`)

**Interfaces:**
- Consumes: `supabase` (Task 2), `Category`/`CategoryType` (Task 5).
- Produces: `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` — consumed by Task 10 (Categorías screen), Task 11 (MovementFormModal's category picker), Task 12 (Resumen screen).

- [ ] **Step 1: Add category input types**

Append to `features/categories/types.ts`:

```ts
export interface NewCategoryInput {
  nombre: string;
  tipo: CategoryType;
}

export interface UpdateCategoryInput {
  id: string;
  nombre: string;
  tipo: CategoryType;
}
```

- [ ] **Step 2: Implement the Supabase-facing API functions**

Create `features/categories/api.ts`:

```ts
import { supabase } from '../../lib/supabase';
import type { Category, NewCategoryInput, UpdateCategoryInput } from './types';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('nombre', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory(input: NewCategoryInput): Promise<Category> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('categories')
    .insert({ nombre: input.nombre, tipo: input.tipo, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ nombre: input.nombre, tipo: input.tipo })
    .eq('id', input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      throw new Error('Esta categoría tiene movimientos asociados. Reasígnalos o elimínalos primero.');
    }
    throw error;
  }
}
```

- [ ] **Step 3: Implement the React Query hooks**

Create `features/categories/hooks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCategory, deleteCategory, fetchCategories, updateCategory } from './api';
import type { NewCategoryInput, UpdateCategoryInput } from './types';

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCategoryInput) => createCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCategoryInput) => updateCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual check happens in Task 10 once the Categorías screen exists (requires a logged-in session against the real Supabase project from Task 3).

- [ ] **Step 5: Commit**

```bash
git add features/categories/types.ts features/categories/api.ts features/categories/hooks.ts
git commit -m "feat: add categories data layer with delete-guard error mapping"
```

---

## Task 8: Movements data layer

**Files:**
- Create: `features/movements/api.ts`
- Create: `features/movements/hooks.ts`
- Modify: `features/movements/types.ts` (created in Task 5 — add `NewMovementInput`, `UpdateMovementInput`)

**Interfaces:**
- Consumes: `supabase` (Task 2), `Movement` (Task 5), `InstallmentRow` (Task 4).
- Produces: `useMovements(year, month)`, `useCreateMovement()`, `useCreateInstallments()`, `useUpdateMovement()`, `useDeleteMovement()` — consumed by Task 11 (MovementFormModal), Task 12 (Movimientos screen), Task 13 (Resumen screen).

- [ ] **Step 1: Add movement input types**

Append to `features/movements/types.ts`:

```ts
export interface NewMovementInput {
  categoryId: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
}

export interface UpdateMovementInput {
  id: string;
  categoryId: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
}
```

- [ ] **Step 2: Implement the Supabase-facing API functions**

Create `features/movements/api.ts`:

```ts
import { supabase } from '../../lib/supabase';
import type { InstallmentRow } from './installments';
import type { Movement, NewMovementInput, UpdateMovementInput } from './types';

export async function fetchMovementsForMonth(year: number, month: number): Promise<Movement[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(year, month, 1);
  const to = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .gte('fecha', from)
    .lt('fecha', to)
    .order('fecha', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMovement(input: NewMovementInput): Promise<Movement> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('movements')
    .insert({
      user_id: userId,
      category_id: input.categoryId,
      concepto: input.concepto,
      monto: input.monto,
      notas: input.notas,
      estado: input.estado,
      fecha: input.fecha,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createInstallments(rows: InstallmentRow[]): Promise<Movement[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('movements')
    .insert(rows.map((row) => ({ ...row, user_id: userId })))
    .select();
  if (error) throw error;
  return data;
}

export async function updateMovement(input: UpdateMovementInput): Promise<Movement> {
  const { data, error } = await supabase
    .from('movements')
    .update({
      category_id: input.categoryId,
      concepto: input.concepto,
      monto: input.monto,
      notas: input.notas,
      estado: input.estado,
      fecha: input.fecha,
    })
    .eq('id', input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from('movements').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 3: Implement the React Query hooks**

Create `features/movements/hooks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInstallments,
  createMovement,
  deleteMovement,
  fetchMovementsForMonth,
  updateMovement,
} from './api';
import type { InstallmentRow } from './installments';
import type { NewMovementInput, UpdateMovementInput } from './types';

export function useMovements(year: number, month: number) {
  return useQuery({
    queryKey: ['movements', year, month],
    queryFn: () => fetchMovementsForMonth(year, month),
  });
}

function useInvalidateMovements() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['movements'] });
}

export function useCreateMovement() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (input: NewMovementInput) => createMovement(input),
    onSuccess: invalidate,
  });
}

export function useCreateInstallments() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (rows: InstallmentRow[]) => createInstallments(rows),
    onSuccess: invalidate,
  });
}

export function useUpdateMovement() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (input: UpdateMovementInput) => updateMovement(input),
    onSuccess: invalidate,
  });
}

export function useDeleteMovement() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (id: string) => deleteMovement(id),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add features/movements/types.ts features/movements/api.ts features/movements/hooks.ts
git commit -m "feat: add movements data layer including installment batch insert"
```

---

## Task 9: Shared ErrorBanner component

**Files:**
- Create: `components/ErrorBanner.tsx`

**Interfaces:**
- Produces: `<ErrorBanner message={string} onRetry={() => void} />` — consumed by Task 10, 12, 13.

- [ ] **Step 1: Implement the component**

Create `components/ErrorBanner.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <View className="bg-red-50 border border-red-200 rounded-md px-4 py-3 mx-4 my-2 flex-row items-center justify-between">
      <Text className="text-red-700 flex-1 mr-3">{message}</Text>
      <Pressable onPress={onRetry}>
        <Text className="text-red-700 font-semibold">Reintentar</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ErrorBanner.tsx
git commit -m "feat: add reusable ErrorBanner component"
```

---

## Task 10: Categorías screen

**Files:**
- Create: `components/CategoryFormModal.tsx`
- Create: `app/(app)/categorias.tsx`

**Interfaces:**
- Consumes: `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` (Task 7), `Category`/`CategoryType` (Task 5), `ErrorBanner` (Task 9).

- [ ] **Step 1: Build the category form modal**

Create `components/CategoryFormModal.tsx`:

```tsx
import { Modal, View, Text, TextInput, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Category, CategoryType } from '../features/categories/types';

const categorySchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  tipo: z.enum(['ingreso', 'gasto']),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface CategoryFormModalProps {
  visible: boolean;
  initialValue: Category | null;
  onClose: () => void;
  onSubmit: (values: CategoryForm) => void;
}

export function CategoryFormModal({ visible, initialValue, onClose, onSubmit }: CategoryFormModalProps) {
  const { control, handleSubmit, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    values: { nombre: initialValue?.nombre ?? '', tipo: (initialValue?.tipo ?? 'gasto') as CategoryType },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-2xl p-6">
          <Text className="text-lg font-bold mb-4">
            {initialValue ? 'Editar categoría' : 'Nueva categoría'}
          </Text>

          <Controller
            control={control}
            name="nombre"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Nombre"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.nombre && <Text className="text-red-600 mb-2">{errors.nombre.message}</Text>}

          <Controller
            control={control}
            name="tipo"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row mb-4">
                <Pressable
                  className={`flex-1 py-2 rounded-l-md border ${value === 'ingreso' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('ingreso')}
                >
                  <Text className={`text-center ${value === 'ingreso' ? 'text-white' : 'text-black'}`}>Ingreso</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-2 rounded-r-md border ${value === 'gasto' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('gasto')}
                >
                  <Text className={`text-center ${value === 'gasto' ? 'text-white' : 'text-black'}`}>Gasto</Text>
                </Pressable>
              </View>
            )}
          />

          <Pressable className="bg-blue-600 rounded-md py-3 mb-2" onPress={handleSubmit(onSubmit)}>
            <Text className="text-white text-center font-semibold">Guardar</Text>
          </Pressable>
          <Pressable className="py-2" onPress={onClose}>
            <Text className="text-center text-gray-500">Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Build the Categorías screen**

Create `app/(app)/categorias.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../features/categories/hooks';
import { CategoryFormModal } from '../../components/CategoryFormModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Category } from '../../features/categories/types';

export default function CategoriasScreen() {
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setModalVisible(true);
  };

  const handleSubmit = (values: { nombre: string; tipo: 'ingreso' | 'gasto' }) => {
    if (editing) {
      updateCategory.mutate({ id: editing.id, ...values });
    } else {
      createCategory.mutate(values);
    }
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    setDeleteError(null);
    deleteCategory.mutate(id, {
      onError: (err) => setDeleteError((err as Error).message),
    });
  };

  return (
    <View className="flex-1 bg-white">
      {isError && <ErrorBanner message="No se pudieron cargar las categorías." onRetry={refetch} />}
      {deleteError && <ErrorBanner message={deleteError} onRetry={() => setDeleteError(null)} />}

      {isLoading ? (
        <Text className="p-4">Cargando...</Text>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <View>
                <Text className="font-medium">{item.nombre}</Text>
                <Text className="text-gray-500 text-xs">{item.tipo}</Text>
              </View>
              <View className="flex-row">
                <Pressable onPress={() => openEdit(item)} className="mr-4">
                  <Text>✏️</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item.id)}>
                  <Text>🗑️</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Pressable
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center"
        onPress={openCreate}
      >
        <Text className="text-white text-2xl">+</Text>
      </Pressable>

      <CategoryFormModal
        visible={modalVisible}
        initialValue={editing}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual check (once Task 14 wires navigation and there's a logged-in session): create a category, edit it, delete an unused one (succeeds), attempt to delete a category with movements attached and confirm the friendly error banner appears.

- [ ] **Step 4: Commit**

```bash
git add components/CategoryFormModal.tsx "app/(app)/categorias.tsx"
git commit -m "feat: add Categorias screen with create/edit/delete"
```

---

## Task 11: Movement form modal (create + edit, with cuotas)

**Files:**
- Create: `components/MovementFormModal.tsx`

**Interfaces:**
- Consumes: `useCategories` (Task 7), `useCreateMovement`, `useCreateInstallments`, `useUpdateMovement` (Task 8), `generateInstallments` (Task 4), `Movement` (Task 5).
- Produces: `<MovementFormModal visible mode="create" | "edit" movement={Movement | null} onClose={() => void} />` — consumed by Task 12 (Movimientos screen).

- [ ] **Step 1: Build the modal**

Create `components/MovementFormModal.tsx`:

```tsx
import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, Switch, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useCategories } from '../features/categories/hooks';
import { useCreateMovement, useCreateInstallments, useUpdateMovement } from '../features/movements/hooks';
import { generateInstallments } from '../features/movements/installments';
import type { Movement, MovementStatus } from '../features/movements/types';

const movementSchema = z.object({
  concepto: z.string().min(1, 'El concepto es obligatorio'),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  categoryId: z.string().min(1, 'Selecciona una categoría'),
  notas: z.string().optional(),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  estado: z.enum(['pendiente', 'pagado']),
  esCuota: z.boolean(),
  totalCuotas: z.coerce.number().int().min(1, 'Debe ser al menos 1').optional(),
});

type MovementForm = z.infer<typeof movementSchema>;

interface MovementFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  movement: Movement | null;
  onClose: () => void;
}

export function MovementFormModal({ visible, mode, movement, onClose }: MovementFormModalProps) {
  const { data: categories } = useCategories();
  const createMovement = useCreateMovement();
  const createInstallments = useCreateInstallments();
  const updateMovement = useUpdateMovement();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    values: {
      concepto: movement?.concepto ?? '',
      monto: movement?.monto ?? 0,
      categoryId: movement?.category_id ?? '',
      notas: movement?.notas ?? '',
      fecha: movement?.fecha ?? new Date().toISOString().slice(0, 10),
      estado: (movement?.estado ?? 'pendiente') as MovementStatus,
      esCuota: false,
      totalCuotas: 1,
    },
  });

  const esCuota = watch('esCuota');

  const onSubmit = (values: MovementForm) => {
    if (mode === 'edit' && movement) {
      updateMovement.mutate({
        id: movement.id,
        categoryId: values.categoryId,
        concepto: values.concepto,
        monto: values.monto,
        notas: values.notas || null,
        estado: values.estado,
        fecha: values.fecha,
      });
    } else if (values.esCuota && values.totalCuotas && values.totalCuotas > 1) {
      const rows = generateInstallments(
        {
          categoryId: values.categoryId,
          concepto: values.concepto,
          montoCuota: values.monto,
          notas: values.notas || null,
          totalCuotas: values.totalCuotas,
          fechaInicio: values.fecha,
        },
        uuidv4()
      );
      createInstallments.mutate(rows);
    } else {
      createMovement.mutate({
        categoryId: values.categoryId,
        concepto: values.concepto,
        monto: values.monto,
        notas: values.notas || null,
        estado: values.estado,
        fecha: values.fecha,
      });
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView className="bg-white rounded-t-2xl p-6 max-h-[85%]">
          <Text className="text-lg font-bold mb-4">
            {mode === 'edit' ? 'Editar movimiento' : 'Nuevo movimiento'}
          </Text>

          <Controller
            control={control}
            name="concepto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Concepto"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.concepto && <Text className="text-red-600 mb-2">{errors.concepto.message}</Text>}

          <Controller
            control={control}
            name="monto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Monto"
                keyboardType="numeric"
                value={String(value ?? '')}
                onChangeText={onChange}
              />
            )}
          />
          {errors.monto && <Text className="text-red-600 mb-2">{errors.monto.message}</Text>}

          <Controller
            control={control}
            name="categoryId"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap mb-2">
                {categories?.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => onChange(c.id)}
                    className={`px-3 py-2 mr-2 mb-2 rounded-full border ${value === c.id ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  >
                    <Text className={value === c.id ? 'text-white' : 'text-black'}>{c.nombre}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
          {errors.categoryId && <Text className="text-red-600 mb-2">{errors.categoryId.message}</Text>}

          <Controller
            control={control}
            name="fecha"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Fecha (YYYY-MM-DD)"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.fecha && <Text className="text-red-600 mb-2">{errors.fecha.message}</Text>}

          <Controller
            control={control}
            name="notas"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-3"
                placeholder="Notas (opcional)"
                value={value}
                onChangeText={onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="estado"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row mb-4">
                <Pressable
                  className={`flex-1 py-2 rounded-l-md border ${value === 'pendiente' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('pendiente')}
                >
                  <Text className={`text-center ${value === 'pendiente' ? 'text-white' : 'text-black'}`}>Pendiente</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-2 rounded-r-md border ${value === 'pagado' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('pagado')}
                >
                  <Text className={`text-center ${value === 'pagado' ? 'text-white' : 'text-black'}`}>Pagado</Text>
                </Pressable>
              </View>
            )}
          />

          {mode === 'create' && (
            <>
              <Controller
                control={control}
                name="esCuota"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center justify-between mb-3">
                    <Text>¿Es en cuotas?</Text>
                    <Switch value={value} onValueChange={onChange} />
                  </View>
                )}
              />

              {esCuota && (
                <>
                  <Controller
                    control={control}
                    name="totalCuotas"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                        placeholder="Número de cuotas"
                        keyboardType="numeric"
                        value={String(value ?? '')}
                        onChangeText={onChange}
                      />
                    )}
                  />
                  {errors.totalCuotas && <Text className="text-red-600 mb-2">{errors.totalCuotas.message}</Text>}
                </>
              )}
            </>
          )}

          <Pressable className="bg-blue-600 rounded-md py-3 mb-2 mt-2" onPress={handleSubmit(onSubmit)}>
            <Text className="text-white text-center font-semibold">Guardar</Text>
          </Pressable>
          <Pressable className="py-2 mb-4" onPress={onClose}>
            <Text className="text-center text-gray-500">Cancelar</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MovementFormModal.tsx
git commit -m "feat: add movement form modal with installment creation"
```

---

## Task 12: Movimientos screen

**Files:**
- Create: `components/MovementListItem.tsx`
- Create: `components/MonthSelector.tsx`
- Create: `app/(app)/movimientos.tsx`

**Interfaces:**
- Consumes: `useMovements`, `useUpdateMovement`, `useDeleteMovement` (Task 8), `useCategories` (Task 7), `MovementFormModal` (Task 11), `ErrorBanner` (Task 9).
- Produces: `<MonthSelector year month onChange={(year, month) => void} />` — reused by Task 13's Resumen screen.

- [ ] **Step 1: Build the month selector**

Create `components/MonthSelector.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface MonthSelectorProps {
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
}

export function MonthSelector({ year, month, onChange }: MonthSelectorProps) {
  const goPrev = () => (month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1));
  const goNext = () => (month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1));

  return (
    <View className="flex-row items-center justify-center py-3">
      <Pressable onPress={goPrev} className="px-4">
        <Text className="text-lg">‹</Text>
      </Pressable>
      <Text className="text-base font-semibold">
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <Pressable onPress={goNext} className="px-4">
        <Text className="text-lg">›</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Build the movement list item**

Create `components/MovementListItem.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';
import type { Movement } from '../features/movements/types';
import type { Category } from '../features/categories/types';

interface MovementListItemProps {
  movement: Movement;
  category: Category | undefined;
  onToggleEstado: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MovementListItem({ movement, category, onToggleEstado, onEdit, onDelete }: MovementListItemProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
      <View className="flex-1">
        <Text className="font-medium">
          {movement.concepto}
          {movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : ''}
        </Text>
        <Text className="text-gray-500 text-xs">{category?.nombre ?? 'Sin categoría'}</Text>
      </View>

      <Text className="font-semibold mr-3">${movement.monto.toLocaleString('es-CL')}</Text>

      <Pressable onPress={onToggleEstado} className="mr-3">
        <Text className={movement.estado === 'pagado' ? 'text-green-600' : 'text-yellow-600'}>
          {movement.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
        </Text>
      </Pressable>

      <Pressable onPress={onEdit} className="mr-3">
        <Text>✏️</Text>
      </Pressable>
      <Pressable onPress={onDelete}>
        <Text>🗑️</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Build the Movimientos screen**

Create `app/(app)/movimientos.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useMovements, useUpdateMovement, useDeleteMovement } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { MonthSelector } from '../../components/MonthSelector';
import { MovementListItem } from '../../components/MovementListItem';
import { MovementFormModal } from '../../components/MovementFormModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Movement } from '../../features/movements/types';

export default function MovimientosScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: movements, isLoading, isError, refetch } = useMovements(year, month);
  const { data: categories } = useCategories();
  const updateMovement = useUpdateMovement();
  const deleteMovement = useDeleteMovement();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (movement: Movement) => {
    setEditing(movement);
    setModalVisible(true);
  };

  const toggleEstado = (movement: Movement) => {
    updateMovement.mutate({
      id: movement.id,
      categoryId: movement.category_id,
      concepto: movement.concepto,
      monto: movement.monto,
      notas: movement.notas,
      fecha: movement.fecha,
      estado: movement.estado === 'pagado' ? 'pendiente' : 'pagado',
    });
  };

  return (
    <View className="flex-1 bg-white">
      <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

      {isError && <ErrorBanner message="No se pudieron cargar los movimientos." onRetry={refetch} />}

      {isLoading ? (
        <Text className="p-4">Cargando...</Text>
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MovementListItem
              movement={item}
              category={categories?.find((c) => c.id === item.category_id)}
              onToggleEstado={() => toggleEstado(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => deleteMovement.mutate(item.id)}
            />
          )}
        />
      )}

      <Pressable
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center"
        onPress={openCreate}
      >
        <Text className="text-white text-2xl">+</Text>
      </Pressable>

      <MovementFormModal
        visible={modalVisible}
        mode={editing ? 'edit' : 'create'}
        movement={editing}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual check (once Task 14 wires navigation): create a 6-cuota movement, confirm 6 rows appear across the corresponding months via the month selector; edit one cuota and confirm only that row changes; delete one cuota and confirm the rest remain; toggle Pendiente↔Pagado and confirm it persists after a refresh.

- [ ] **Step 5: Commit**

```bash
git add components/MonthSelector.tsx components/MovementListItem.tsx "app/(app)/movimientos.tsx"
git commit -m "feat: add Movimientos screen with month navigation and CRUD"
```

---

## Task 13: Resumen screen

**Files:**
- Create: `components/CategoryTotalsList.tsx`
- Create: `app/(app)/index.tsx`

**Interfaces:**
- Consumes: `useMovements` (Task 8), `useCategories` (Task 7), `calculateMonthSummary` (Task 5), `MonthSelector` (Task 12), `ErrorBanner` (Task 9).

- [ ] **Step 1: Build the category totals list**

Create `components/CategoryTotalsList.tsx`:

```tsx
import { View, Text } from 'react-native';
import type { CategoryTotal } from '../features/movements/summary';

interface CategoryTotalsListProps {
  totals: CategoryTotal[];
}

export function CategoryTotalsList({ totals }: CategoryTotalsListProps) {
  return (
    <View className="px-4">
      {totals.map((t) => (
        <View key={t.categoryId} className="flex-row justify-between py-2 border-b border-gray-100">
          <Text>{t.nombre}</Text>
          <Text className={t.tipo === 'ingreso' ? 'text-green-600' : 'text-gray-800'}>
            ${t.total.toLocaleString('es-CL')}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Build the Resumen screen**

Create `app/(app)/index.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useMovements } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { calculateMonthSummary } from '../../features/movements/summary';
import { MonthSelector } from '../../components/MonthSelector';
import { CategoryTotalsList } from '../../components/CategoryTotalsList';
import { ErrorBanner } from '../../components/ErrorBanner';

export default function ResumenScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: movements, isLoading: loadingMovements, isError: movementsError, refetch: refetchMovements } = useMovements(year, month);
  const { data: categories, isLoading: loadingCategories, isError: categoriesError, refetch: refetchCategories } = useCategories();

  const summary = useMemo(() => {
    if (!movements || !categories) return null;
    return calculateMonthSummary(movements, categories);
  }, [movements, categories]);

  const isLoading = loadingMovements || loadingCategories;
  const isError = movementsError || categoriesError;

  return (
    <ScrollView className="flex-1 bg-white">
      <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

      {isError && (
        <ErrorBanner
          message="No se pudo cargar el resumen del mes."
          onRetry={() => { refetchMovements(); refetchCategories(); }}
        />
      )}

      {isLoading || !summary ? (
        <Text className="p-4">Cargando...</Text>
      ) : (
        <>
          <View className="items-center py-6">
            <Text className="text-gray-500">Saldo disponible</Text>
            <Text className="text-3xl font-bold">${summary.saldoDisponible.toLocaleString('es-CL')}</Text>
          </View>

          <View className="flex-row justify-around mb-4">
            <View className="items-center">
              <Text className="text-gray-500 text-xs">Ingresos</Text>
              <Text className="text-green-600 font-semibold">${summary.totalIngresos.toLocaleString('es-CL')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-gray-500 text-xs">Gastos</Text>
              <Text className="text-red-600 font-semibold">${summary.totalGastos.toLocaleString('es-CL')}</Text>
            </View>
          </View>

          <CategoryTotalsList totals={summary.totalsByCategory} />
        </>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual check (once Task 14 wires navigation): mark a movement as Pagado in the Movimientos screen, confirm the Resumen screen's saldo and category total update after navigating back to it; confirm Pendiente movements are excluded from the saldo.

- [ ] **Step 4: Commit**

```bash
git add components/CategoryTotalsList.tsx "app/(app)/index.tsx"
git commit -m "feat: add Resumen screen with auto-calculated monthly totals"
```

---

## Task 14: Root layout, auth gate, and tab navigation

**Files:**
- Modify: `app/_layout.tsx` (replace Task 1's placeholder)
- Create: `app/(app)/_layout.tsx`
- Delete: `app/index.tsx` (Task 1's placeholder — superseded by `app/(app)/index.tsx`)

**Interfaces:**
- Consumes: `useSession` (Task 6), `queryClient` (Task 2), all three `app/(app)/*` screens (Tasks 10, 12, 13).

- [ ] **Step 1: Remove the placeholder root screen**

Delete `app/index.tsx` (its content moved to `app/(app)/index.tsx` in Task 13).

- [ ] **Step 2: Build the auth-gated root layout**

Replace `app/_layout.tsx`:

```tsx
import 'react-native-get-random-values';
import '../global.css';
import { Slot, Redirect } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { View, Text } from 'react-native';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Slot />
      </AuthGate>
    </QueryClientProvider>
  );
}
```

Note: `AuthGate` wraps `<Slot />`, which renders whichever route matched — including `/login` itself. To avoid `/login` being caught by the `!session` redirect (which would loop), the check only applies when the matched route isn't `/login`. Since Expo Router's `Slot` doesn't expose the current path directly here, use `usePathname` from `expo-router` to special-case it:

```tsx
import 'react-native-get-random-values';
import '../global.css';
import { Slot, Redirect, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { View, Text } from 'react-native';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!session && pathname !== '/login') {
    return <Redirect href="/login" />;
  }

  if (session && pathname === '/login') {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Slot />
      </AuthGate>
    </QueryClientProvider>
  );
}
```

Use this second version as the actual file content.

- [ ] **Step 3: Build the authenticated tab layout**

Create `app/(app)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: 'Resumen' }} />
      <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="categorias" options={{ title: 'Categorías' }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Verify end-to-end in Expo Go**

Run: `npx expo start`

Manual smoke test:
1. App opens directly to `/login` (no session yet).
2. Log in with the user's real Supabase credentials — lands on the Resumen tab.
3. Go to Categorías, create the 6 initial categories from the user's Excel (Ingresos as `ingreso`, the rest as `gasto`).
4. Go to Movimientos, create a plain movement and a 6-cuota installment movement; confirm cuotas appear in the right future months via the month selector.
5. Edit and delete a single cuota; confirm siblings are unaffected.
6. Mark movements as Pagado; go to Resumen and confirm the saldo and category totals reflect only paid movements.
7. Force a network error (e.g. toggle airplane mode) and confirm the ErrorBanner with "Reintentar" appears instead of a blank screen.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire auth gate and tab navigation, complete MVP flow"
```

---

## Post-implementation note

After Task 14 passes its manual smoke test, the user should add their remaining category names (Gastos Fijos, CMR, Cuotas/Crédito, Gastos Extras, Ahorro) via the Categorías screen if not already created during the smoke test — there is no seed script, categories are created through the UI per the spec's "crear categorías propias libremente" requirement.
