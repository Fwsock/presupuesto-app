# Movimientos/Cuenta/TabBar Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock recurring-income-generated movements against normal edit/toggle/delete, add an empty state to Movimientos, fix the FAB position-during-loading bug, unify edit/delete icons on Ionicons, replace the "Pagar todo" switch with an action button, redesign Cuenta as an MP-style settings list, and move movement creation into a persistent center tab-bar button.

**Architecture:** Pure logic (recurring-lock check, initials) gets small tested helper functions. UI changes are made in place, following the codebase's existing conventions (PressableScale for touch feedback, NativeWind classNames, RN `<Modal>` for full-screen forms). The create/edit movement modal moves from local state in `movimientos.tsx` to a React Context provided at the `(app)` layout level, so both the new tab-bar button and the existing per-row edit action can trigger it from anywhere in the tab tree.

**Tech Stack:** Expo SDK 54, expo-router ~6.0.24 (classic file-based `Tabs`/`Tabs.Screen` API, not the newer `expo-router/ui` TabTrigger primitives), React Native 0.81.5, NativeWind, react-hook-form + zod, @tanstack/react-query, Supabase, Jest (pure-function unit tests only — no `@testing-library/react-native` in this repo, so UI/navigation wiring is verified manually on-device, not via automated component tests).

## Global Constraints

- **Corrected SDK version:** AGENTS.md says "read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/" — this is stale. `package.json` confirms the app actually runs **Expo SDK 54 / expo-router ~6.0.24 / react-native 0.81.5** (the project was explicitly downgraded from 57 to match Expo Go on the user's phone — see commit `8b6f0f4`). Use v54-era APIs; do not follow the v57 docs for navigation code.
- No new SQL migration is needed anywhere in this plan. `recurring_income_id` already exists on `movements` (migration `0003_profiles_and_recurring_income.sql`) and is already populated for both `fijo` and `variable` generated movements — it's just missing from the TS `Movement` type.
- Currency formatting: always `${amount.toLocaleString('es-CL')}`, matching every existing screen.
- All new/changed interactive elements use `PressableScale`, never a bare `Pressable`.
- Icons: `Ionicons` only, weight/size matching existing usage (`size={18-20}`, color `#374151` for neutral icons, `#9ca3af` for chevrons) — no emoji anywhere in the UI after this plan.
- Reference screenshots were received after the plan's first draft (Mercado Libre's "Mi perfil" screen and Mercado Pago's home screen with its elevated center tab button). Task 8 and Task 10 below already reflect them: avatar circle with initials, name, **email below the name**, then a grouped list of icon+label+chevron rows (mirroring ML's "Información de tu perfil" / "Seguridad" rows almost exactly), and a larger, more prominent elevated circular center tab button (mirroring MP's "Transferir" button position/size). Colors are **not** copied — this app keeps its existing `blue-600` accent instead of MP's yellow/purple.
- Four of the fourteen images the user attached were actually screenshots of this app's own current (buggy) state (Categorías, empty Movimientos, Movimientos mid-"Cargando..."), not design references — they're corroborating evidence for Tasks 3/4/5, not new requirements.
- The screenshots contain the user's real personal data (legal name, national ID number, phone, email, username). None of that data is reproduced anywhere in this plan or in any code/commit it produces — only layout structure and icon choices were taken from them.

---

## File Structure

| File | Responsibility |
|---|---|
| `features/movements/types.ts` | Modify — add `recurring_income_id` to `Movement`. |
| `features/movements/recurringLock.ts` | Create — pure check for "is this movement locked because it's recurring-income-generated". |
| `__tests__/recurringLock.test.ts` | Create — unit tests for the above. |
| `components/MovementListItem.tsx` | Modify — Ionicons icons, lock UI for recurring movements. |
| `app/(app)/movimientos.tsx` | Modify — special delete dialog, empty state, remove local FAB/modal (moved to layout), consume shared modal context for edit. |
| `features/profile/initials.ts` | Create — pure initials-from-name helper. |
| `__tests__/initials.test.ts` | Create — unit tests for the above. |
| `components/FullScreenFormModal.tsx` | Create — shared full-screen modal chrome (back arrow + title + scroll body), extracted for reuse by the new Cuenta sub-sections. |
| `app/(app)/cuenta.tsx` | Modify — full redesign: avatar header + grouped navigable rows opening `FullScreenFormModal`s, reusing all existing form logic unchanged. |
| `app/(app)/categorias.tsx` | Modify — Ionicons icons, "Pagar todo" switch → action button, FAB position-bug fix. |
| `features/shared/movement-modal-context.tsx` | Create — Context + hook so any screen can open the shared create/edit movement modal. |
| `app/(app)/_layout.tsx` | Modify — hosts the movement modal state/provider, renders `MovementFormModal` once at layout level, adds the elevated center "crear" tab button. |
| `app/(app)/crear.tsx` | Create — placeholder route required by expo-router's file-based `Tabs.Screen`; tab press is always intercepted, this is just a safety-net redirect. |

---

### Task 1: `Movement` type gains `recurring_income_id` + pure lock-check helper

**Files:**
- Modify: `features/movements/types.ts`
- Create: `features/movements/recurringLock.ts`
- Test: `__tests__/recurringLock.test.ts`

**Interfaces:**
- Produces: `Movement.recurring_income_id: string | null`; `isRecurringGeneratedMovement(movement: Pick<Movement, 'recurring_income_id'>): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/recurringLock.test.ts
import { isRecurringGeneratedMovement } from '../features/movements/recurringLock';

describe('isRecurringGeneratedMovement', () => {
  it('is true when recurring_income_id is set', () => {
    expect(isRecurringGeneratedMovement({ recurring_income_id: 'abc' })).toBe(true);
  });

  it('is false when recurring_income_id is null', () => {
    expect(isRecurringGeneratedMovement({ recurring_income_id: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest recurringLock -v`
Expected: FAIL — `Cannot find module '../features/movements/recurringLock'`

- [ ] **Step 3: Add the field to the `Movement` type**

In `features/movements/types.ts`, add the field right after `icono` (matches the column's position/purpose — decorative-adjacent metadata, not part of the editable form fields):

```ts
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
  /** Ionicons name, decorative only — see features/movements/iconSuggestion.ts. */
  icono: string;
  /** Set when this movement was auto-generated from a recurring income (fijo or variable) — see features/movements/recurringLock.ts for the lock this implies in Movimientos. */
  recurring_income_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Write the implementation**

```ts
// features/movements/recurringLock.ts
import type { Movement } from './types';

/**
 * True when this movement was auto-generated from a recurring income config
 * (fijo or variable) — see supabase/migrations/0003_profiles_and_recurring_income.sql
 * and features/income/api.ts's submitIncomeForMonth. Its amount/concepto can
 * only be edited from Cuenta, so Movimientos must lock the pagado/pendiente
 * switch and hide the edit action for it, and warn harder before deleting it.
 */
export function isRecurringGeneratedMovement(movement: Pick<Movement, 'recurring_income_id'>): boolean {
  return movement.recurring_income_id !== null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest recurringLock -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full type-check to confirm the new field doesn't break anything**

Run: `npx tsc --noEmit`
Expected: no errors (nothing currently constructs a `Movement` object literal outside test fixtures; test fixtures in `__tests__/summary.test.ts` etc. will need the new field — fix in the next step if `tsc` flags them)

- [ ] **Step 7: If `tsc` flags existing test fixtures, add the field there too**

`__tests__/summary.test.ts` and `__tests__/monthlySeries.test.ts` build `Movement` objects via a local `movement(overrides)` helper — add `recurring_income_id: null,` to each helper's base object (do not change their describe/it blocks).

- [ ] **Step 8: Commit**

```bash
git add features/movements/types.ts features/movements/recurringLock.ts __tests__/recurringLock.test.ts __tests__/summary.test.ts __tests__/monthlySeries.test.ts
git commit -m "feat: type and detect recurring-income-generated movements"
```

---

### Task 2: Lock UI in `MovementListItem` + unify its icons on Ionicons

**Files:**
- Modify: `components/MovementListItem.tsx`

**Interfaces:**
- Consumes: `isRecurringGeneratedMovement` from Task 1 (or an equivalent inline check on `movement.recurring_income_id`), `Movement` type.

- [ ] **Step 1: Rewrite the component**

```tsx
// components/MovementListItem.tsx
import { Switch, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { isRecurringGeneratedMovement } from '../features/movements/recurringLock';
import type { Movement } from '../features/movements/types';
import type { Category } from '../features/categories/types';

interface MovementListItemProps {
  movement: Movement;
  category: Category | undefined;
  onToggleEstado: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** True while this row's estado is being saved, so the switch disables. */
  isUpdating?: boolean;
}

export function MovementListItem({
  movement,
  category,
  onToggleEstado,
  onEdit,
  onDelete,
  isUpdating = false,
}: MovementListItemProps) {
  const isPagado = movement.estado === 'pagado';
  // While the save is in flight, show the target state so the switch doesn't
  // snap back to the old value; it settles to the server state when done.
  const displayPagado = isUpdating ? !isPagado : isPagado;
  const isLocked = isRecurringGeneratedMovement(movement);

  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
      <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3">
        <Ionicons name={movement.icono as keyof typeof Ionicons.glyphMap} size={18} color="#374151" />
      </View>

      <View className="flex-1 pr-2">
        <Text className="font-medium">
          {movement.concepto}
          {movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : ''}
        </Text>
        <Text className="text-gray-500 text-xs">{category?.nombre ?? 'Sin categoría'}</Text>
      </View>

      <Text className="font-semibold mr-3">${movement.monto.toLocaleString('es-CL')}</Text>

      <View className="mr-3" style={{ opacity: isUpdating || isLocked ? 0.5 : 1 }}>
        <Switch
          value={displayPagado}
          onValueChange={onToggleEstado}
          disabled={isUpdating || isLocked}
          trackColor={{ false: '#d1d5db', true: '#16a34a' }}
          thumbColor="#ffffff"
          ios_backgroundColor="#d1d5db"
        />
      </View>

      {!isLocked && (
        <PressableScale
          onPress={onEdit}
          hitSlop={10}
          style={{ minWidth: 44, minHeight: 44 }}
          className="items-center justify-center mr-1"
          accessibilityRole="button"
          accessibilityLabel="Editar"
        >
          <Ionicons name="pencil-outline" size={20} color="#374151" />
        </PressableScale>
      )}
      <PressableScale
        onPress={onDelete}
        hitSlop={10}
        style={{ minWidth: 44, minHeight: 44 }}
        className="items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Eliminar"
      >
        <Ionicons name="trash-outline" size={20} color="#374151" />
      </PressableScale>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/MovementListItem.tsx
git commit -m "feat: lock recurring-income movements in the list, swap emoji icons for Ionicons"
```

---

### Task 3: Special delete dialog + empty state in Movimientos (still using the local FAB/modal for now — Task 9 removes it)

**Files:**
- Modify: `app/(app)/movimientos.tsx`

**Interfaces:**
- Consumes: `movement.recurring_income_id`, `MONTH_NAMES` from `features/shared/monthNames.ts`.

- [ ] **Step 1: Add the special delete branch**

In `app/(app)/movimientos.tsx`, replace `handleDelete` with a version that checks `recurring_income_id` first, before the existing `installment_group_id` branch:

```tsx
const handleDelete = (id: string) => {
  setActionError(null);
  const movement = movements?.find((m) => m.id === id);
  if (!movement) return;

  const onDeleteError = (err: unknown) => setActionError((err as Error).message);
  const conceptoTrimmed = movement.concepto.trim();
  const cuotaLabel =
    movement.cuota_numero && movement.cuota_total
      ? ` (cuota ${movement.cuota_numero}/${movement.cuota_total})`
      : '';

  if (movement.recurring_income_id) {
    const monthIndex = Number(movement.fecha.slice(5, 7)) - 1;
    const mesLabel = `${MONTH_NAMES[monthIndex]} ${movement.fecha.slice(0, 4)}`;
    Alert.alert(
      '⚠️ Advertencia',
      `Estás a punto de eliminar tu ingreso mensual. ¿Estás completamente seguro que deseas eliminar el monto de $${movement.monto.toLocaleString('es-CL')} correspondiente a ${mesLabel}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }) },
      ]
    );
  } else if (movement.installment_group_id) {
    Alert.alert(
      'Eliminar compra en cuotas',
      `"${conceptoTrimmed}"${cuotaLabel}. ¿Qué deseas eliminar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar solo esta cuota',
          style: 'destructive',
          onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }),
        },
        {
          text: 'Eliminar toda la compra',
          style: 'destructive',
          onPress: () => deleteMovementGroup.mutate(movement.installment_group_id!, { onError: onDeleteError }),
        },
      ]
    );
  } else {
    Alert.alert(
      'Eliminar movimiento',
      `¿Estás seguro que deseas eliminar "${conceptoTrimmed}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }) },
      ]
    );
  }
};
```

Add the import: `import { MONTH_NAMES } from '../../features/shared/monthNames';`

- [ ] **Step 2: Add the empty state**

Replace the `isLoading ? <Text>Cargando...</Text> : <FlatList ... />` block with a three-way branch:

```tsx
{isLoading ? (
  <Text className="p-4">Cargando...</Text>
) : visibleMovements && visibleMovements.length === 0 ? (
  <View className="flex-1 items-center justify-center">
    <Text className="text-gray-400 text-center px-8">No hay movimientos registrados para este mes.</Text>
  </View>
) : (
  <FlatList
    className="flex-1"
    data={visibleMovements}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => (
      <MovementListItem
        movement={item}
        category={categories?.find((c) => c.id === item.category_id)}
        onToggleEstado={() => toggleEstado(item)}
        onEdit={() => openEdit(item)}
        onDelete={() => handleDelete(item.id)}
        isUpdating={updateMovement.isPending && updateMovement.variables?.id === item.id}
      />
    )}
  />
)}
```

(`onEdit={() => openEdit(item)}` still refers to the local `openEdit` at this point in the plan — Task 9 will swap it for the shared context's `openEdit`. Do not change that call site here.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/(app)/movimientos.tsx
git commit -m "feat: stronger delete warning for recurring income, empty-month state"
```

---

### Task 4: Fix the FAB position-during-loading bug in Categorías (root-caused pattern)

**Context for the implementer:** In the previous commit (`3e0a1f9`), `PressableScale` was changed so `style`/`className` land on the *inner* `Pressable`, not the outer `Animated.View` wrapper (see `components/PressableScale.tsx`'s doc comment). Any caller that relied on `className="absolute bottom-6 right-6 ..."` directly on a `PressableScale` lost its `position: absolute` on the actual positioned box: the outer `Animated.View` now has no layout properties, collapses to zero size (an absolutely-positioned child doesn't contribute to a CSS/Yoga parent's auto size), and sits wherever normal flex flow puts it — right after whichever sibling precedes it. In Movimientos this made the FAB visually jump between "just below the short 'Cargando...' text" while loading and "pinned to the true bottom, after the full-height FlatIist" once loaded. `categorias.tsx` has the exact same FAB pattern (`PressableScale` with `className="absolute bottom-6 right-6 ..."`, sibling to an `isLoading ? Text : FlatList` block) and is exposed to the same latent bug, so fix it here even though it isn't the screen named in the bug report (Movimientos' own FAB is removed entirely in Task 9, which resolves the bug there structurally).

**Files:**
- Modify: `app/(app)/categorias.tsx`

- [ ] **Step 1: Move the absolute positioning to a plain wrapping `View`**

Change:

```tsx
<PressableScale
  className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center"
  onPress={openCreate}
>
  <Text className="text-white text-2xl">+</Text>
</PressableScale>
```

to:

```tsx
<View className="absolute bottom-6 right-6">
  <PressableScale
    className="bg-blue-600 w-14 h-14 rounded-full items-center justify-center"
    onPress={openCreate}
  >
    <Text className="text-white text-2xl">+</Text>
  </PressableScale>
</View>
```

- [ ] **Step 2: Manually verify on device/simulator**

Open Categorías, confirm the "+" button stays pinned to the same bottom-right spot regardless of the `isLoading` flicker (throttle network in dev tools or just watch on a fresh cold load).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/categorias.tsx"
git commit -m "fix: FAB losing position:absolute through PressableScale's inner-Pressable styling"
```

---

### Task 5: Ionicons for edit/delete + "Pagar todo" switch → action button in Categorías

**Files:**
- Modify: `app/(app)/categorias.tsx`

- [ ] **Step 1: Swap the emoji icons for Ionicons**

```tsx
<PressableScale
  onPress={() => openEdit(item)}
  hitSlop={10}
  style={{ minWidth: 44, minHeight: 44 }}
  className="items-center justify-center mr-1"
  accessibilityRole="button"
  accessibilityLabel="Editar"
>
  <Ionicons name="pencil-outline" size={20} color="#374151" />
</PressableScale>
<PressableScale
  onPress={() => handleDelete(item.id)}
  hitSlop={10}
  style={{ minWidth: 44, minHeight: 44 }}
  className="items-center justify-center"
  accessibilityRole="button"
  accessibilityLabel="Eliminar"
>
  <Ionicons name="trash-outline" size={20} color="#374151" />
</PressableScale>
```

Add `import { Ionicons } from '@expo/vector-icons';` to the top of the file.

- [ ] **Step 2: Replace the "Pagar todo" `Switch` with an action button**

Replace:

```tsx
<View className="flex-row items-center justify-between mt-2">
  <Text className="text-gray-500 text-xs">
    {count > 0 ? `Pagar todo (${count} pendiente${count > 1 ? 's' : ''}, $${total.toLocaleString('es-CL')})` : 'Pagar todo'}
  </Text>
  <Switch
    value={count === 0}
    disabled={count === 0 || isPaying}
    onValueChange={() => handlePayAll(item)}
    trackColor={{ false: '#d1d5db', true: '#16a34a' }}
    thumbColor="#ffffff"
    ios_backgroundColor="#d1d5db"
  />
</View>
```

with:

```tsx
<View className="flex-row items-center justify-between mt-2">
  <Text className="text-gray-500 text-xs">
    {count > 0 ? `${count} pendiente${count > 1 ? 's' : ''}` : 'Sin pendientes'}
  </Text>
  {count > 0 ? (
    <PressableScale
      onPress={() => handlePayAll(item)}
      disabled={isPaying}
      className={`px-3 py-1.5 rounded-full bg-blue-600 ${isPaying ? 'opacity-60' : ''}`}
    >
      <Text className="text-white text-xs font-medium">
        {isPaying ? 'Pagando...' : `Pagar todo ($${total.toLocaleString('es-CL')})`}
      </Text>
    </PressableScale>
  ) : (
    <View className="flex-row items-center px-3 py-1.5 rounded-full bg-gray-100">
      <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />
      <Text className="text-gray-500 text-xs font-medium">Todo pagado</Text>
    </View>
  )}
</View>
```

- [ ] **Step 3: Remove the now-unused `Switch` import**

`categorias.tsx`'s top import was `import { View, Text, FlatList, Switch, Alert } from 'react-native';` — drop `Switch` since nothing in the file uses it anymore: `import { View, Text, FlatList, Alert } from 'react-native';`

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/categorias.tsx"
git commit -m "feat: Ionicons for category actions, Pagar todo as a button instead of a one-way switch"
```

---

### Task 6: Profile initials helper

**Files:**
- Create: `features/profile/initials.ts`
- Test: `__tests__/initials.test.ts`

**Interfaces:**
- Produces: `getInitials(nombre: string | null | undefined, email: string | null | undefined): string`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/initials.test.ts
import { getInitials } from '../features/profile/initials';

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('Bastian Guzmán', null)).toBe('BG');
  });

  it('uses a single letter for a one-word name', () => {
    expect(getInitials('Bastian', null)).toBe('B');
  });

  it('ignores extra whitespace between words', () => {
    expect(getInitials('  Bastian   Guzmán  ', null)).toBe('BG');
  });

  it('falls back to the email initial when there is no name', () => {
    expect(getInitials(null, 'basti@example.com')).toBe('B');
  });

  it('falls back to "?" when there is neither a name nor an email', () => {
    expect(getInitials(null, null)).toBe('?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest initials -v`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// features/profile/initials.ts

/** "Bastian Guzmán" -> "BG". Falls back to the first letter of the email when there's no name yet (new account, onboarding not finished), and to "?" when neither is available. */
export function getInitials(nombre: string | null | undefined, email: string | null | undefined): string {
  const trimmed = nombre?.trim();
  if (trimmed) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('');
  }
  if (email) return email[0]!.toUpperCase();
  return '?';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest initials -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add features/profile/initials.ts __tests__/initials.test.ts
git commit -m "feat: initials helper for the Cuenta avatar"
```

---

### Task 7: Shared `FullScreenFormModal` chrome

**Files:**
- Create: `components/FullScreenFormModal.tsx`

**Interfaces:**
- Produces: `FullScreenFormModal({ visible, title, onClose, children })` — same back-arrow-plus-title-plus-scroll chrome `MovementFormModal` already uses inline, extracted so Cuenta's three new sub-sections (Task 8) don't triplicate it.

- [ ] **Step 1: Write the component**

```tsx
// components/FullScreenFormModal.tsx
import { Modal, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';

interface FullScreenFormModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Full-screen slide-up modal chrome (back arrow + title + scrollable body),
 * shared by every "open this section" screen reached from a list of
 * navigable rows (currently just Cuenta — see app/(app)/cuenta.tsx).
 */
export function FullScreenFormModal({ visible, title, onClose, children }: FullScreenFormModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <PressableScale
            onPress={onClose}
            className="pr-3 py-1"
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </PressableScale>
          <Text className="text-lg font-semibold">{title}</Text>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="pb-8">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/FullScreenFormModal.tsx
git commit -m "feat: extract shared full-screen modal chrome"
```

---

### Task 8: Cuenta redesign — avatar header + grouped navigable rows

**Context for the implementer:** This is a pure restructure. Every mutation/query hook, every `useState`, every validation rule, and every button label already in `app/(app)/cuenta.tsx` stays exactly as-is — you're moving the three existing `Section` blocks (Perfil, Correo+Contraseña combined into "Seguridad", Ingreso recurrente) into three `FullScreenFormModal`s (Task 7), opened from three tappable rows under an avatar/name/email header. "Cerrar sesión" is untouched — it's rendered globally by `app/(app)/_layout.tsx`'s `headerRight`, not by this file, so it stays visible on every tab including this one with zero changes here.

Based on the reference screenshot of Mercado Libre's "Mi perfil" screen: white/light circular avatar with initials, bold name, **gray email text directly below the name**, then a grouped list where each row is icon (left) + label (fills the row) + chevron (right) — that's the `AccountRow` component below, and it already matches. Two icon choices are updated from the plan's first draft to mirror that screenshot more closely: `card-outline` for "Información personal" (ML uses an ID-card icon there) and `lock-closed-outline` for "Seguridad" (ML uses a padlock). Colors stay this app's existing `blue-600` — do not introduce ML's yellow.

**Files:**
- Modify: `app/(app)/cuenta.tsx`

**Interfaces:**
- Consumes: `getInitials` from Task 6, `FullScreenFormModal` from Task 7.

- [ ] **Step 1: Rewrite the file**

```tsx
// app/(app)/cuenta.tsx
import { useEffect, useState } from 'react';
import { Text, TextInput, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession, updateEmail, updatePassword } from '../../features/auth/hooks';
import { useProfile, useUpsertProfile } from '../../features/profile/hooks';
import { useRecurringIncome, useDeleteRecurringIncome } from '../../features/income/hooks';
import { getInitials } from '../../features/profile/initials';
import { RecurringIncomeForm } from '../../components/RecurringIncomeForm';
import { FullScreenFormModal } from '../../components/FullScreenFormModal';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PressableScale } from '../../components/PressableScale';

type AccountSection = 'personal' | 'seguridad' | 'ingreso' | null;

function AccountRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} className="flex-row items-center px-4 py-4 border-b border-gray-100">
      <Ionicons name={icon} size={20} color="#374151" style={{ marginRight: 12 }} />
      <Text className="flex-1 text-base">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </PressableScale>
  );
}

export default function CuentaScreen() {
  const { session } = useSession();
  const { data: profile } = useProfile();
  const upsertProfile = useUpsertProfile();
  const { data: recurringIncome } = useRecurringIncome();
  const deleteRecurringIncome = useDeleteRecurringIncome();

  const [openSection, setOpenSection] = useState<AccountSection>(null);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    setNombre(profile?.nombre ?? '');
    setTelefono(profile?.telefono ?? '');
  }, [profile]);

  const saveProfile = () => {
    setProfileError(null);
    setProfileSaved(false);
    upsertProfile.mutate(
      { nombre: nombre.trim() || null, telefono: telefono.trim() || null },
      {
        onSuccess: () => setProfileSaved(true),
        onError: (err) => setProfileError((err as Error).message),
      }
    );
  };

  const [newEmail, setNewEmail] = useState('');
  const [emailPending, setEmailPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  const changeEmail = async () => {
    if (!newEmail) return;
    setEmailError(null);
    setEmailMessage(null);
    setEmailPending(true);
    try {
      await updateEmail(newEmail.trim());
      setEmailMessage('Revisa tu correo para confirmar el cambio.');
      setNewEmail('');
    } catch (err) {
      setEmailError((err as Error).message);
    } finally {
      setEmailPending(false);
    }
  };

  const [newPassword, setNewPassword] = useState('');
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const changePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordPending(true);
    try {
      await updatePassword(newPassword);
      setPasswordMessage('Contraseña actualizada.');
      setNewPassword('');
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordPending(false);
    }
  };

  const confirmDeleteIncome = () => {
    if (!recurringIncome) return;
    Alert.alert(
      'Eliminar ingreso recurrente',
      `¿Eliminar "${recurringIncome.concepto}"? Ya no se generará automáticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteRecurringIncome.mutate(recurringIncome.id) },
      ]
    );
  };

  const displayName = profile?.nombre?.trim() || session?.user.email || 'Usuario';

  return (
    <View className="flex-1 bg-white">
      <View className="items-center py-8 border-b border-gray-100">
        <View className="w-20 h-20 rounded-full bg-blue-600 items-center justify-center mb-3">
          <Text className="text-white text-2xl font-semibold">
            {getInitials(profile?.nombre, session?.user.email ?? null)}
          </Text>
        </View>
        <Text className="text-lg font-semibold">{displayName}</Text>
        {session?.user.email && <Text className="text-gray-500 mt-0.5">{session.user.email}</Text>}
      </View>

      <View className="mt-4">
        <AccountRow icon="card-outline" label="Información personal" onPress={() => setOpenSection('personal')} />
        <AccountRow icon="lock-closed-outline" label="Seguridad" onPress={() => setOpenSection('seguridad')} />
        <AccountRow icon="repeat-outline" label="Ingreso mensual recurrente" onPress={() => setOpenSection('ingreso')} />
      </View>

      <FullScreenFormModal
        visible={openSection === 'personal'}
        title="Información personal"
        onClose={() => setOpenSection(null)}
      >
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Nombre"
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Teléfono"
          keyboardType="phone-pad"
          value={telefono}
          onChangeText={setTelefono}
        />
        {profileError && (
          <ErrorBanner message={profileError} onRetry={() => setProfileError(null)} actionLabel="Descartar" />
        )}
        {profileSaved && <Text className="text-green-600 mb-2">Guardado.</Text>}
        <Button title="Guardar" onPress={saveProfile} loading={upsertProfile.isPending} disabled={upsertProfile.isPending} />
      </FullScreenFormModal>

      <FullScreenFormModal visible={openSection === 'seguridad'} title="Seguridad" onClose={() => setOpenSection(null)}>
        <Text className="text-base font-semibold mb-2">Correo electrónico</Text>
        <Text className="text-gray-500 mb-2">Actual: {session?.user.email}</Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Nuevo correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={newEmail}
          onChangeText={setNewEmail}
        />
        {emailError && <ErrorBanner message={emailError} onRetry={() => setEmailError(null)} actionLabel="Descartar" />}
        {emailMessage && <Text className="text-green-600 mb-2">{emailMessage}</Text>}
        <Button title="Cambiar correo" onPress={changeEmail} loading={emailPending} disabled={emailPending || !newEmail} />

        <Text className="text-base font-semibold mb-2 mt-6">Contraseña</Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Nueva contraseña"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        {passwordError && (
          <ErrorBanner message={passwordError} onRetry={() => setPasswordError(null)} actionLabel="Descartar" />
        )}
        {passwordMessage && <Text className="text-green-600 mb-2">{passwordMessage}</Text>}
        <Button
          title="Cambiar contraseña"
          onPress={changePassword}
          loading={passwordPending}
          disabled={passwordPending || !newPassword}
        />
      </FullScreenFormModal>

      <FullScreenFormModal
        visible={openSection === 'ingreso'}
        title="Ingreso mensual recurrente"
        onClose={() => setOpenSection(null)}
      >
        <RecurringIncomeForm initialValue={recurringIncome ?? null} />
        {recurringIncome && (
          <Button
            title="Eliminar ingreso recurrente"
            variant="ghost"
            onPress={confirmDeleteIncome}
            disabled={deleteRecurringIncome.isPending}
          />
        )}
      </FullScreenFormModal>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/cuenta.tsx"
git commit -m "feat: redesign Cuenta as avatar header + grouped navigable rows"
```

---

### Task 9: Shared movement-modal context

**Files:**
- Create: `features/shared/movement-modal-context.tsx`

**Interfaces:**
- Produces: `MovementModalContext` (React Context, default `null`), `useMovementModal(): { openCreate: () => void; openEdit: (movement: Movement) => void }`

- [ ] **Step 1: Write the file**

```tsx
// features/shared/movement-modal-context.tsx
import { createContext, useContext } from 'react';
import type { Movement } from '../movements/types';

export interface MovementModalController {
  openCreate: () => void;
  openEdit: (movement: Movement) => void;
}

export const MovementModalContext = createContext<MovementModalController | null>(null);

/**
 * Lets any screen open the shared create/edit movement modal that's actually
 * rendered once at the (app) layout level — see app/(app)/_layout.tsx. This
 * is what lets the center tab-bar "+" button (any tab) and Movimientos' row
 * edit action (only on Movimientos) drive the same modal instance.
 */
export function useMovementModal(): MovementModalController {
  const ctx = useContext(MovementModalContext);
  if (!ctx) throw new Error('useMovementModal must be used within the (app) layout');
  return ctx;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add features/shared/movement-modal-context.tsx
git commit -m "feat: shared context for the create/edit movement modal"
```

---

### Task 10: Center tab-bar "+" button — layout hosts the modal, Movimientos loses its local one

**Context for the implementer:** This is the task that actually moves movement creation into the tab bar. `app/(app)/_layout.tsx` currently renders `<Tabs>` with four `Tabs.Screen`s (index, movimientos, categorias, cuenta) and a `headerRight` "Cerrar sesión" button that's global to every tab (leave that untouched). You're adding a fifth `Tabs.Screen` named `crear` between `movimientos` and `categorias`, whose `tabBarButton` is a custom elevated circular button instead of the normal icon+label, and whose `tabPress` is intercepted (`e.preventDefault()`) so it never actually navigates to a `/crear` screen — pressing it either opens the modal in place (if already on Movimientos) or navigates to Movimientos and opens the modal, per the spec's explicit requirement ("no solo cambiar de pestaña dejando al usuario que presione de nuevo"). `expo-router`'s classic file-based `Tabs`/`Tabs.Screen` (confirmed via `docs.expo.dev/router/advanced/tabs/` and community examples: `listeners={{ tabPress: (e) => { e.preventDefault(); ... } }}` is the documented way to intercept a tab press) still requires a route file to exist for the screen name to register — `app/(app)/crear.tsx` (next task) is that file, and it's a pure safety net since the button's own `tabPress` listener always prevents the navigation from actually reaching it.

Reference screenshot: Mercado Pago's home screen tab bar has 5 slots (2 tabs, then a large circular colored button raised well above the bar line and slightly overlapping the content above it, then 2 more tabs) — that's exactly this 5-slot layout (index/movimientos, then `crear`, then categorias/cuenta). The button in that reference reads as noticeably larger/heavier than a normal tab icon, so `CreateTabButton` below is sized larger (56x56, raised further, stronger shadow) than the plan's first draft to match that visual weight — keep this app's `blue-600`, not MP's purple.

**Files:**
- Modify: `app/(app)/_layout.tsx`

**Interfaces:**
- Consumes: `MovementModalContext` from Task 9, `MovementFormModal` (existing, unmodified), `Movement` type.
- Produces: `MovementModalContext.Provider` wraps the whole tab tree, so `movimientos.tsx` (Task 11) can call `useMovementModal().openEdit`.

- [ ] **Step 1: Rewrite the file**

```tsx
// app/(app)/_layout.tsx
import { useCallback, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../../features/auth/hooks';
import { useProfile } from '../../features/profile/hooks';
import { SelectedMonthProvider } from '../../features/shared/selected-month';
import { PressableScale } from '../../components/PressableScale';
import { MovementFormModal } from '../../components/MovementFormModal';
import { MovementModalContext } from '../../features/shared/movement-modal-context';
import type { Movement } from '../../features/movements/types';

type IconName = keyof typeof Ionicons.glyphMap;

// react-navigation/bottom-tabs already wraps each tab's icon + label in a
// single touchable — tabBarIcon and the tab's title aren't two separate
// pressables, they're rendered inside the same tab button.
function TabIcon(outline: IconName, filled: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

// Renders in place of the normal icon+label tab button for the "crear" tab
// slot. It never reflects focus state on purpose — this isn't a real screen,
// tabPress is always intercepted below (see the crear Tabs.Screen's
// `listeners`), so "selected" would never make sense for it.
function CreateTabButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <PressableScale
        onPress={onPress}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          marginTop: -26,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 6,
        }}
        className="bg-blue-600 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Nuevo movimiento"
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </PressableScale>
    </View>
  );
}

export default function AppLayout() {
  const queryClient = useQueryClient();
  // Bottom tabs pads the bar with the device's safe-area inset (gesture bar /
  // home indicator) on top of whatever height we set — without reserving that
  // space ourselves, the label gets squeezed against that inset instead of
  // sitting above it.
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const router = useRouter();

  // Hosted here (not in movimientos.tsx) so the center tab-bar button can
  // open it from any tab, and Movimientos' row "editar" action can open it
  // too via useMovementModal() — one modal instance, two entry points.
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  // Forces MovementFormModal to fully remount on every open (its `key` prop
  // below) so each session starts with fresh internal state - see the
  // component's own comment for why this matters.
  const [formSessionId, setFormSessionId] = useState(0);

  const openCreate = useCallback(() => {
    setEditingMovement(null);
    setFormSessionId((id) => id + 1);
    setModalVisible(true);
    router.navigate('/movimientos');
  }, [router]);

  const openEdit = useCallback((movement: Movement) => {
    setEditingMovement(movement);
    setFormSessionId((id) => id + 1);
    setModalVisible(true);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Drop every cached row so a later login on this device can't read the
      // previous session's data. The auth gate in app/_layout.tsx redirects to
      // /login on its own once the session clears.
      queryClient.clear();
    } catch (err) {
      Alert.alert('No se pudo cerrar sesión', (err as Error).message);
    }
  };

  return (
    <MovementModalContext.Provider value={{ openCreate, openEdit }}>
      <SelectedMonthProvider>
        <Tabs
          screenOptions={{
            headerShown: true,
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#6b7280',
            tabBarStyle: {
              height: 60 + insets.bottom,
              paddingTop: 8,
              paddingBottom: 8 + insets.bottom,
            },
            tabBarLabelStyle: { fontSize: 11 },
            tabBarIconStyle: { marginBottom: 2 },
            headerRight: () => (
              <PressableScale onPress={handleSignOut} className="px-4 py-2">
                <Text className="text-blue-600 font-medium">Cerrar sesión</Text>
              </PressableScale>
            ),
          }}
        >
          <Tabs.Screen
            name="index"
            options={{ title: 'Resumen', tabBarIcon: TabIcon('stats-chart-outline', 'stats-chart') }}
          />
          <Tabs.Screen
            name="movimientos"
            options={{ title: 'Movimientos', tabBarIcon: TabIcon('swap-horizontal-outline', 'swap-horizontal') }}
          />
          <Tabs.Screen
            name="crear"
            options={{
              title: '',
              tabBarButton: () => <CreateTabButton onPress={openCreate} />,
            }}
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
                openCreate();
              },
            }}
          />
          <Tabs.Screen
            name="categorias"
            options={{ title: 'Categorías', tabBarIcon: TabIcon('pricetags-outline', 'pricetags') }}
          />
          <Tabs.Screen
            name="cuenta"
            options={{
              title: profile?.nombre?.trim() || 'Cuenta',
              tabBarIcon: TabIcon('person-outline', 'person'),
            }}
          />
        </Tabs>
      </SelectedMonthProvider>

      <MovementFormModal
        key={formSessionId}
        visible={modalVisible}
        mode={editingMovement ? 'edit' : 'create'}
        movement={editingMovement}
        onClose={() => setModalVisible(false)}
      />
    </MovementModalContext.Provider>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `app/(app)/movimientos.tsx` only (still references its own local `modalVisible`/`openCreate`/`openEdit`/`MovementFormModal` — fixed in Task 11). If `_layout.tsx` itself has errors, fix those before proceeding.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/_layout.tsx"
git commit -m "feat: host the movement modal at the layout level, add center tab-bar create button"
```

---

### Task 11: `crear.tsx` placeholder route + remove Movimientos' local FAB/modal

**Files:**
- Create: `app/(app)/crear.tsx`
- Modify: `app/(app)/movimientos.tsx`

- [ ] **Step 1: Add the placeholder route**

```tsx
// app/(app)/crear.tsx
import { Redirect } from 'expo-router';

// This route only exists because expo-router's file-based Tabs.Screen needs
// a real file per tab name to register the tab. The center "+" tab's
// tabPress is always intercepted in app/(app)/_layout.tsx (e.detail
// preventDefault + openCreate()), so this component should never actually
// mount in normal use — the redirect is just a safety net for any edge case
// that reaches it directly (e.g. a stale deep link).
export default function CrearScreen() {
  return <Redirect href="/movimientos" />;
}
```

- [ ] **Step 2: Remove the local FAB and modal from Movimientos, wire the shared context in**

In `app/(app)/movimientos.tsx`:
- Remove the `useState` for `modalVisible`, `editing`, `formSessionId`.
- Remove the `openCreate` and `openEdit` local functions.
- Remove the `<PressableScale className="absolute bottom-6 right-6 ...">+</PressableScale>` FAB block entirely.
- Remove the `<MovementFormModal key={formSessionId} .../>` render and its import.
- Add `import { useMovementModal } from '../../features/shared/movement-modal-context';` and, inside the component, `const { openEdit } = useMovementModal();` (the row's `onEdit={() => openEdit(item)}` call site from Task 3 needs no further change — it already calls a variable named `openEdit`, which now resolves to the context's version instead of the removed local one).

The full resulting file:

```tsx
// app/(app)/movimientos.tsx
import { useState } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMovements, useUpdateMovement, useDeleteMovement, useDeleteMovementGroup } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { MonthSelector } from '../../components/MonthSelector';
import { MovementListItem } from '../../components/MovementListItem';
import { ErrorBanner } from '../../components/ErrorBanner';
import { CategoryFilterChips } from '../../components/CategoryFilterChips';
import { VariableIncomePromptModal } from '../../components/VariableIncomePromptModal';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { useVariableIncomePromptState } from '../../features/income/hooks';
import { useMovementModal } from '../../features/shared/movement-modal-context';
import { MONTH_NAMES } from '../../features/shared/monthNames';

export default function MovimientosScreen() {
  const router = useRouter();
  const { year, month, setMonth } = useSelectedMonth();
  // Set when the user taps a category on Resumen (drill-down to that category).
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  const { data: movements, isLoading, isError, refetch } = useMovements(year, month);
  const { data: categories } = useCategories();
  const updateMovement = useUpdateMovement();
  const deleteMovement = useDeleteMovement();
  const deleteMovementGroup = useDeleteMovementGroup();
  const { openEdit } = useMovementModal();

  const [actionError, setActionError] = useState<string | null>(null);

  const toggleEstado = (movement: (typeof movements extends (infer M)[] | undefined ? M : never)) => {
    setActionError(null);
    updateMovement.mutate(
      {
        id: movement.id,
        categoryId: movement.category_id,
        concepto: movement.concepto,
        monto: movement.monto,
        notas: movement.notas,
        fecha: movement.fecha,
        icono: movement.icono,
        estado: movement.estado === 'pagado' ? 'pendiente' : 'pagado',
      },
      {
        onError: (err) => setActionError((err as Error).message),
      }
    );
  };

  const handleDelete = (id: string) => {
    setActionError(null);
    const movement = movements?.find((m) => m.id === id);
    if (!movement) return;

    const onDeleteError = (err: unknown) => setActionError((err as Error).message);
    const conceptoTrimmed = movement.concepto.trim();
    const cuotaLabel =
      movement.cuota_numero && movement.cuota_total
        ? ` (cuota ${movement.cuota_numero}/${movement.cuota_total})`
        : '';

    if (movement.recurring_income_id) {
      const monthIndex = Number(movement.fecha.slice(5, 7)) - 1;
      const mesLabel = `${MONTH_NAMES[monthIndex]} ${movement.fecha.slice(0, 4)}`;
      Alert.alert(
        '⚠️ Advertencia',
        `Estás a punto de eliminar tu ingreso mensual. ¿Estás completamente seguro que deseas eliminar el monto de $${movement.monto.toLocaleString('es-CL')} correspondiente a ${mesLabel}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }) },
        ]
      );
    } else if (movement.installment_group_id) {
      Alert.alert(
        'Eliminar compra en cuotas',
        `"${conceptoTrimmed}"${cuotaLabel}. ¿Qué deseas eliminar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar solo esta cuota',
            style: 'destructive',
            onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }),
          },
          {
            text: 'Eliminar toda la compra',
            style: 'destructive',
            onPress: () => deleteMovementGroup.mutate(movement.installment_group_id!, { onError: onDeleteError }),
          },
        ]
      );
    } else {
      Alert.alert(
        'Eliminar movimiento',
        `¿Estás seguro que deseas eliminar "${conceptoTrimmed}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }) },
        ]
      );
    }
  };

  // Filter only what's rendered -- the query itself stays unfiltered so the
  // screen behaves normally when there's no categoryId param.
  const visibleMovements = categoryId
    ? movements?.filter((m) => m.category_id === categoryId)
    : movements;

  const variableIncomePrompt = useVariableIncomePromptState(year, month);

  return (
    <View className="flex-1 bg-white">
      <MonthSelector year={year} month={month} onChange={setMonth} />

      {categories && (
        <CategoryFilterChips
          categories={categories}
          selectedCategoryId={categoryId}
          onSelect={(id) =>
            id ? router.replace({ pathname: '/movimientos', params: { categoryId: id } }) : router.replace('/movimientos')
          }
        />
      )}

      {isError && <ErrorBanner message="No se pudieron cargar los movimientos." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

      {isLoading ? (
        <Text className="p-4">Cargando...</Text>
      ) : visibleMovements && visibleMovements.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-center px-8">No hay movimientos registrados para este mes.</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={visibleMovements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MovementListItem
              movement={item}
              category={categories?.find((c) => c.id === item.category_id)}
              onToggleEstado={() => toggleEstado(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              isUpdating={updateMovement.isPending && updateMovement.variables?.id === item.id}
            />
          )}
        />
      )}

      <VariableIncomePromptModal
        visible={variableIncomePrompt.visible}
        concepto={variableIncomePrompt.concepto}
        year={year}
        month={month}
        loading={variableIncomePrompt.loading}
        error={variableIncomePrompt.error}
        onSubmit={variableIncomePrompt.submit}
        onSkip={variableIncomePrompt.skip}
        onDismissError={variableIncomePrompt.dismissError}
      />
    </View>
  );
}
```

Note: `toggleEstado`'s parameter type above uses an inline conditional type to stay exactly equivalent to "whatever `useMovements` resolves to, unwrapped" without a new import — if this reads awkwardly to whoever implements it, an equally correct and clearer alternative is `import type { Movement } from '../../features/movements/types';` and typing the parameter as `Movement` directly. Prefer the direct `Movement` import; it's simpler and this file already imports plenty of other types by convention elsewhere in the app.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all tests pass (the pre-existing 30 plus the new `recurringLock` and `initials` suites from Tasks 1 and 6)

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/crear.tsx" "app/(app)/movimientos.tsx"
git commit -m "feat: remove Movimientos' local FAB/modal, wire it through the shared tab-bar create button"
```

---

## Self-Review Notes (already applied above, recorded for the reviewer)

1. **Spec coverage:** A.1–A.4 → Tasks 1–3, 11. B (empty state) → Task 3. BUG (FAB drift) → Task 4 (Categorías) + Task 11 (Movimientos, resolved by removing its FAB entirely). C (Ionicons) → Tasks 2, 5. D (Pagar todo button) → Task 5. E (Cuenta redesign) → Tasks 6–8. F (tab-bar center button) → Tasks 9–11. All six lettered items plus the bug are covered.
2. **Placeholder scan:** no TBD/"add error handling"/"similar to Task N" — every step has literal code.
3. **Type consistency:** `Movement.recurring_income_id` (Task 1) is consumed identically in `MovementListItem` (Task 2, via `isRecurringGeneratedMovement`) and `movimientos.tsx` (Task 11, direct field access). `MovementModalController`'s `openCreate`/`openEdit` shape (Task 9) matches exactly what `_layout.tsx` provides (Task 10) and what `movimientos.tsx` consumes (Task 11, only `openEdit`). `getInitials(nombre, email)` signature (Task 6) matches its one call site in `cuenta.tsx` (Task 8).

---

## What to check on the phone after implementing all tasks (give this to the user)

- **A (recurring income lock):** open Movimientos on a month where a Variable income movement was already generated (or generate one via the amount prompt). Confirm: switch is dimmed/disabled, no pencil icon next to it, delete shows the "⚠️ Advertencia" dialog with the correct amount and month, and after confirming it actually deletes. Confirm editing the amount/concepto is still only possible from Cuenta → Ingreso mensual recurrente. If a Fijo income is configured too, its generated movement is locked the same way (same `recurring_income_id` mechanism) — worth a quick check since the original bug report only mentioned Variable explicitly.
- **B (empty state):** navigate to a month with zero movements (e.g. far future) and confirm the centered gray message shows instead of a blank screen.
- **BUG (FAB drift):** on Categorías, force a slow load (or just watch a cold app start) and confirm the "+" button doesn't jump position. Movimientos no longer has its own FAB at all (moved to the tab bar), so there's nothing to check there anymore.
- **C (icons):** visually confirm every edit/delete icon in Movimientos and Categorías is now a line-style pencil/trash icon, not an emoji.
- **D (Pagar todo button):** in Categorías, with pending movements in a category, confirm the row shows a blue "Pagar todo ($monto)" button (not a switch), confirm the existing confirmation dialog still appears, and confirm it flips to a disabled "Todo pagado" pill after confirming.
- **E (Cuenta redesign):** open Cuenta, confirm the avatar shows the right initials and full name, confirm all three rows ("Información personal", "Seguridad", "Ingreso mensual recurrente") open a full-screen sheet with a back arrow, and confirm every field/button inside still works exactly as before (save name/phone, change email, change password, configure/delete recurring income). Confirm "Cerrar sesión" is still visible in the header.
- **F (tab-bar create button):** confirm the blue elevated "+" sits between Movimientos and Categorías in the tab bar on every screen. From Resumen/Categorías/Cuenta, tap it and confirm it switches to Movimientos AND opens the "Nuevo movimiento" modal in one tap (not two). From Movimientos itself, confirm it just opens the modal without any visible tab switch. Confirm the pencil icon on a normal (non-recurring) movement row still opens the same modal in edit mode.
- **No SQL migration needed** — `recurring_income_id` already existed on `movements` before this plan; only the TypeScript type was missing it.
