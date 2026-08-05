# Movimientos row cleanup, date grouping, cuotas-over-fijas override, and Agosto 2026 audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free up name width in the Movimientos row by moving edit/delete into the existing detail sheet, group the Movimientos list by date with daily totals, make an installment's cuota lifecycle override its category's indefinite "fija" replication, and replace the test data currently seeded for `basti.guzman29@gmail.com` in Supabase with the real, reconciled Agosto 2026 budget.

**Architecture:** All work happens in the existing worktree at `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp` (branch `worktree-movimientos-cuenta-tabbar-revamp`), on top of its current uncommitted changes (categorías fijas, `MovementDetailSheet`, search/filter, etc — none of this plan re-does that work). UI changes touch `MovementListItem`/`MovementDetailSheet`/`movimientos.tsx`. The cuota-override is a pure-function change in `features/movements/fixedCategoryReplication.ts` plus its caller in `features/movements/fixedCategories.ts`. The data audit is entirely in `datos_presupuesto.json` + `scripts/seed-presupuesto.js` + `scripts/verify-presupuesto.js` (Node scripts, run outside Expo, using the `SUPABASE_SERVICE_ROLE_KEY` already in `.env`).

**Tech Stack:** Expo/React Native (v57), TypeScript, NativeWind (Tailwind classNames), `@tanstack/react-query`, Supabase (`@supabase/supabase-js`), Jest + ts-jest for pure-logic tests.

## Global Constraints

- Every task's summary/testing-instructions/SQL-and-restart evaluation to the user MUST be written in Spanish, per `AGENTS.md`'s closing protocol — this applies to how the plan is *executed and reported*, not to the plan file itself.
- The Expo dev server, if running, must be pointed at this worktree's folder, never at the root `master` checkout (`AGENTS.md` point 5).
- Do not touch the other two `recurring_income` rows in Supabase (different `user_id`s — other dev/test users, out of scope).
- `scripts/seed-presupuesto.js` must **never run for real (non `--dry-run`) without the user's explicit go-ahead on that specific run's dry-run output** — this is a full delete+reseed of a real user's `movements` and `categories` tables.
- Target: `Saldo disponible (agosto)` computed the same way the app computes it (`calculateMonthSummary`: only `estado='pagado'`, only movements with `fecha` inside `[2026-08-01, 2026-09-01)`) must equal **exactly $271.114**.

---

## Task 1: Add `/model opusplan` instruction to AGENTS.md

**Files:**
- Modify: `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\AGENTS.md`
- Modify: `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp\AGENTS.md`

Both files are currently byte-identical (verified). Both need the same new section.

- [ ] **Step 1: Add the section to the root AGENTS.md**

Insert this new section right after the `# Expo HAS CHANGED` block and before `## Protocolo de cierre por tarea/cambio`:

```markdown
## Modelo de sesión

Usa siempre `/model opusplan` al iniciar una sesión en este proyecto.
```

- [ ] **Step 2: Apply the identical edit to the worktree's copy**

Same insertion, same exact text, in `.claude\worktrees\movimientos-cuenta-tabbar-revamp\AGENTS.md`.

- [ ] **Step 3: Commit (root repo)**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app"
git add AGENTS.md
git commit -m "docs: instruct sessions to use /model opusplan"
```

- [ ] **Step 4: Commit (worktree)**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp"
git add AGENTS.md
git commit -m "docs: instruct sessions to use /model opusplan"
```

---

## Task 2: Move edit/delete out of the movement row and into MovementDetailSheet

**Files:**
- Modify: `components/MovementListItem.tsx`
- Modify: `components/MovementDetailSheet.tsx`
- Modify: `app/(app)/movimientos.tsx` (only the `MovementListItem`/detail-sheet wiring, not its data logic)

**Interfaces:**
- `MovementDetailSheet` new props: `onEdit: () => void`, `onDelete: () => void`, `isLocked: boolean` (in addition to its current `visible`, `movement`, `category`, `onClose`).
- `MovementListItem` loses its `onEdit`/`onDelete` props' row-level rendering but keeps receiving them (unchanged prop signature) — it just forwards them into `MovementDetailSheet` instead of rendering its own pencil/trash icons.

- [ ] **Step 1: Add edit/delete actions to `MovementDetailSheet`**

Replace the full file `components/MovementDetailSheet.tsx` with:

```tsx
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenFormModal } from './FullScreenFormModal';
import { PressableScale } from './PressableScale';
import { formatFullDate } from '../features/movements/date';
import type { Movement } from '../features/movements/types';
import type { Category } from '../features/categories/types';

interface MovementDetailSheetProps {
  visible: boolean;
  movement: Movement;
  category: Category | undefined;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** True for recurring-income-generated movements -- hides both actions, matching the row's previous lock behavior. */
  isLocked: boolean;
}

/**
 * Detail view for a single movement -- opened by tapping anywhere on its
 * MovementListItem row (icon, title, date or amount). Editar/Eliminar live
 * here now (moved off the row in the movements-row-cleanup revamp) so the
 * row itself only needs to reserve width for the Pagado/Pendiente switch.
 */
export function MovementDetailSheet({
  visible,
  movement,
  category,
  onClose,
  onEdit,
  onDelete,
  isLocked,
}: MovementDetailSheetProps) {
  const isGasto = movement.tipo === 'gasto';
  const isPagado = movement.estado === 'pagado';
  const title =
    movement.concepto +
    (movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : '');
  const notas = movement.notas?.trim();

  return (
    <FullScreenFormModal visible={visible} title="Detalle del movimiento" onClose={onClose}>
      <View className="items-center mb-6">
        <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
          <Ionicons name={movement.icono as keyof typeof Ionicons.glyphMap} size={30} color="#374151" />
        </View>
        <Text className="text-lg font-semibold text-center">{title}</Text>
        <Text className={`text-3xl font-bold mt-2 ${isGasto ? 'text-red-600' : 'text-green-600'}`}>
          {isGasto ? '-' : ''}${movement.monto.toLocaleString('es-CL')}
        </Text>
      </View>

      <View
        className={`self-center flex-row items-center px-3 py-1.5 rounded-full mb-6 ${isPagado ? 'bg-green-50' : 'bg-orange-50'}`}
      >
        <Ionicons
          name={isPagado ? 'checkmark-circle' : 'time-outline'}
          size={16}
          color={isPagado ? '#16a34a' : '#f59e0b'}
          style={{ marginRight: 6 }}
        />
        <Text className={`text-sm font-medium ${isPagado ? 'text-green-700' : 'text-orange-700'}`}>
          {isPagado ? 'Pagado' : 'Pendiente'}
        </Text>
      </View>

      <View className="border-t border-gray-100 pt-4" style={{ gap: 16 }}>
        <View className="flex-row justify-between">
          <Text className="text-gray-500">Categoría</Text>
          <Text className="font-medium">{category?.nombre ?? 'Sin categoría'}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-500">Fecha</Text>
          <Text className="font-medium">{formatFullDate(movement.fecha)}</Text>
        </View>
      </View>

      {notas ? (
        <View className="border-t border-gray-100 mt-4 pt-4">
          <Text className="text-gray-500 mb-2">Notas</Text>
          <Text className="text-gray-800 leading-5">{notas}</Text>
        </View>
      ) : null}

      {!isLocked && (
        <View className="border-t border-gray-100 mt-6 pt-4 flex-row" style={{ gap: 10 }}>
          <PressableScale
            onPress={onEdit}
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg border border-gray-300"
            accessibilityRole="button"
            accessibilityLabel="Editar movimiento"
          >
            <Ionicons name="pencil-outline" size={18} color="#374151" style={{ marginRight: 6 }} />
            <Text className="font-semibold text-gray-700">Editar</Text>
          </PressableScale>
          <PressableScale
            onPress={onDelete}
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-red-600"
            accessibilityRole="button"
            accessibilityLabel="Eliminar movimiento"
          >
            <Ionicons name="trash-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text className="font-semibold text-white">Eliminar</Text>
          </PressableScale>
        </View>
      )}
    </FullScreenFormModal>
  );
}
```

- [ ] **Step 2: Simplify `MovementListItem` to `[concepto/fecha] ... [monto][switch]`**

Replace the full file `components/MovementListItem.tsx` with:

```tsx
import { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedSwitch } from './AnimatedSwitch';
import { PressableScale } from './PressableScale';
import { MovementDetailSheet } from './MovementDetailSheet';
import { isRecurringGeneratedMovement } from '../features/movements/recurringLock';
import { formatLongDate } from '../features/movements/date';
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

// Fixed widths for the amount + switch slots, so the switch's right edge
// always sits flush against the row's own padding. Editar/Eliminar moved
// into MovementDetailSheet (opened by tapping the row) -- the row itself
// only needs to reserve space for the amount and the Pagado/Pendiente
// switch, which is what gives the concepto text its extra width.
const AMOUNT_WIDTH = 88;
const SWITCH_SLOT_WIDTH = 46;
const TRAILING_GAP = 6;

export function MovementListItem({
  movement,
  category,
  onToggleEstado,
  onEdit,
  onDelete,
  isUpdating = false,
}: MovementListItemProps) {
  const [detailVisible, setDetailVisible] = useState(false);
  const isPagado = movement.estado === 'pagado';
  // While the save is in flight, show the target state so the switch doesn't
  // snap back to the old value; it settles to the server state when done.
  const displayPagado = isUpdating ? !isPagado : isPagado;
  const isLocked = isRecurringGeneratedMovement(movement);
  const isGasto = movement.tipo === 'gasto';
  const openDetail = () => setDetailVisible(true);

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
      {/* This plain View -- not PressableScale itself -- is what carries
          flex-1: PressableScale's className lands on its INNER Pressable,
          one level below the Animated.View that's the actual flex child of
          this row, so a bare "flex-1" className on PressableScale never
          reaches the parent flex layout and the whole left side collapses
          to its content width instead of sharing space with the right side. */}
      <View className="flex-1">
        <PressableScale
          onPress={openDetail}
          className="flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${movement.concepto}`}
        >
          <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3">
            <Ionicons name={movement.icono as keyof typeof Ionicons.glyphMap} size={18} color="#374151" />
          </View>

          <View className="flex-1 pr-2">
            <Text className="font-medium" numberOfLines={1} ellipsizeMode="tail">
              {movement.concepto}
              {movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : ''}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5">{formatLongDate(movement.fecha)}</Text>
          </View>
        </PressableScale>
      </View>

      {/* Right side, strictly [Monto][Switch], flush to the row's own right
          padding -- no extra flex-1/justify-end needed since this group's
          width is just the sum of its fixed slots. */}
      <View className="flex-row items-center" style={{ gap: TRAILING_GAP }}>
        <PressableScale
          onPress={openDetail}
          style={{ width: AMOUNT_WIDTH }}
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${movement.concepto}`}
        >
          <Text
            className={`font-semibold ${isGasto ? 'text-red-600' : 'text-green-600'}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ textAlign: 'right' }}
          >
            {isGasto ? '-' : ''}${movement.monto.toLocaleString('es-CL')}
          </Text>
        </PressableScale>

        <View style={{ width: SWITCH_SLOT_WIDTH, alignItems: 'center' }}>
          {!isLocked && (
            <AnimatedSwitch value={displayPagado} onValueChange={onToggleEstado} disabled={isUpdating} />
          )}
        </View>
      </View>

      <MovementDetailSheet
        visible={detailVisible}
        movement={movement}
        category={category}
        onClose={() => setDetailVisible(false)}
        onEdit={() => {
          setDetailVisible(false);
          onEdit();
        }}
        onDelete={() => {
          setDetailVisible(false);
          onDelete();
        }}
        isLocked={isLocked}
      />
    </View>
  );
}
```

Note `onEdit`/`onDelete` passed into `MovementDetailSheet` close the sheet first (`setDetailVisible(false)`) before calling the real handler — `onEdit` opens the separate `MovementFormModal` (shared context) and `onDelete` opens `ConfirmDialog`; both would otherwise stack visually on top of the still-open detail sheet.

- [ ] **Step 3: Confirm `movimientos.tsx` needs no changes**

`app/(app)/movimientos.tsx` already passes `onEdit={() => openEdit(item)}` and `onDelete={() => handleDelete(item.id)}` into `MovementListItem` (see its `renderItem`) — those props are unchanged by this task, only where `MovementListItem` renders them changed. No edit needed here; this step is just a read to confirm, not a code change:

Run: `grep -n "onEdit\|onDelete" "app/(app)/movimientos.tsx"` and confirm both lines still reference `MovementListItem`'s props (not `MovementDetailSheet` directly — that's `MovementListItem`'s job now).

- [ ] **Step 4: Manual verification (no automated test exists for RN components in this repo — jest only covers pure-logic files)**

Not run automatically; covered in the closing report to the user (see Task 11).

- [ ] **Step 5: Commit**

```bash
git add components/MovementListItem.tsx components/MovementDetailSheet.tsx
git commit -m "feat: move movement row's edit/delete into the detail sheet, widen concepto"
```

---

## Task 3: Pure date-grouping function + tests

**Files:**
- Create: `features/movements/dateGrouping.ts`
- Test: `__tests__/dateGrouping.test.ts`

**Interfaces:**
- Produces: `groupMovementsByDate(movements: Movement[]): MovementDateGroup[]`, `export interface MovementDateGroup { fecha: string; totalDelDia: number; data: Movement[] }`. Consumed by Task 4 (`movimientos.tsx`'s `SectionList`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/dateGrouping.test.ts`:

```ts
import { groupMovementsByDate } from '../features/movements/dateGrouping';
import type { Movement } from '../features/movements/types';

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm',
    user_id: 'u1',
    category_id: 'c1',
    tipo: 'gasto',
    concepto: 'Item',
    monto: 1000,
    notas: null,
    estado: 'pagado',
    fecha: '2026-08-04',
    installment_group_id: null,
    cuota_numero: null,
    cuota_total: null,
    icono: 'receipt-outline',
    recurring_income_id: null,
    fixed_series_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('groupMovementsByDate', () => {
  it('returns an empty array for no movements', () => {
    expect(groupMovementsByDate([])).toEqual([]);
  });

  it('groups movements sharing a fecha into one section', () => {
    const movements = [
      movement({ id: 'a', fecha: '2026-08-04', tipo: 'gasto', monto: 5000 }),
      movement({ id: 'b', fecha: '2026-08-04', tipo: 'gasto', monto: 3000 }),
    ];

    const result = groupMovementsByDate(movements);

    expect(result).toHaveLength(1);
    expect(result[0].fecha).toBe('2026-08-04');
    expect(result[0].data.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('sums the day total with sign: ingreso positive, gasto negative', () => {
    const movements = [
      movement({ id: 'a', fecha: '2026-08-04', tipo: 'ingreso', monto: 10000 }),
      movement({ id: 'b', fecha: '2026-08-04', tipo: 'gasto', monto: 3000 }),
    ];

    const result = groupMovementsByDate(movements);

    expect(result[0].totalDelDia).toBe(7000);
  });

  it('orders sections by fecha descending regardless of input order', () => {
    const movements = [
      movement({ id: 'a', fecha: '2026-08-01' }),
      movement({ id: 'b', fecha: '2026-08-05' }),
      movement({ id: 'c', fecha: '2026-08-03' }),
    ];

    const result = groupMovementsByDate(movements);

    expect(result.map((g) => g.fecha)).toEqual(['2026-08-05', '2026-08-03', '2026-08-01']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/dateGrouping.test.ts`
Expected: FAIL — `Cannot find module '../features/movements/dateGrouping'`

- [ ] **Step 3: Implement `groupMovementsByDate`**

Create `features/movements/dateGrouping.ts`:

```ts
import type { Movement } from './types';

export interface MovementDateGroup {
  fecha: string;
  /** Signed sum for the day: ingreso adds, gasto subtracts -- matches the sign shown on each row's amount. */
  totalDelDia: number;
  data: Movement[];
}

/**
 * Groups `movements` by their `fecha`, one section per distinct day, ordered
 * newest-first. Does not itself sort within a day -- callers that also sort
 * (features/movements/sort.ts) should sort before grouping.
 */
export function groupMovementsByDate(movements: Movement[]): MovementDateGroup[] {
  const byFecha = new Map<string, Movement[]>();
  for (const movement of movements) {
    const existing = byFecha.get(movement.fecha);
    if (existing) existing.push(movement);
    else byFecha.set(movement.fecha, [movement]);
  }

  return [...byFecha.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, data]) => ({
      fecha,
      totalDelDia: data.reduce((sum, m) => sum + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0),
      data,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/dateGrouping.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add features/movements/dateGrouping.ts __tests__/dateGrouping.test.ts
git commit -m "feat: pure groupMovementsByDate helper for the Movimientos date sections"
```

---

## Task 4: Section header formatting helper + tests

**Files:**
- Modify: `features/movements/date.ts`
- Test: `__tests__/date.test.ts` (existing file, add cases)

**Interfaces:**
- Produces: `formatSectionHeaderDate(fecha: string, todayISO: string): string` — takes "today" as an explicit parameter (not `new Date()` internally) so it's deterministic to test. Consumed by Task 5.

- [ ] **Step 1: Add the failing test cases**

Open `__tests__/date.test.ts`, add at the end of the file (inside or alongside the existing `describe` blocks — match the file's existing style):

```ts
import { formatSectionHeaderDate } from '../features/movements/date';

describe('formatSectionHeaderDate', () => {
  it('prefixes "HOY" when fecha matches todayISO', () => {
    expect(formatSectionHeaderDate('2026-08-04', '2026-08-04')).toBe('HOY · 04 de Agosto');
  });

  it('omits the prefix for any other date', () => {
    expect(formatSectionHeaderDate('2026-08-03', '2026-08-04')).toBe('03 de Agosto');
  });

  it('pads single-digit days with a leading zero', () => {
    expect(formatSectionHeaderDate('2026-08-01', '2026-08-04')).toBe('01 de Agosto');
  });
});
```

(If the existing `import` at the top of `__tests__/date.test.ts` already imports from `'../features/movements/date'`, add `formatSectionHeaderDate` to that same import instead of a second import line.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/date.test.ts`
Expected: FAIL — `formatSectionHeaderDate is not a function` / not exported.

- [ ] **Step 3: Implement `formatSectionHeaderDate`**

Add to `features/movements/date.ts` (after `formatFullDate`):

```ts
// 'YYYY-MM-DD' + today's 'YYYY-MM-DD' -> 'HOY · 04 de Agosto' or '03 de Agosto',
// for the Movimientos date-section headers (bank/Mercado Pago style).
export function formatSectionHeaderDate(value: string, todayISO: string): string {
  if (!isValidISODate(value)) return value;
  const [, month, day] = value.split('-').map(Number);
  const label = `${String(day).padStart(2, '0')} de ${MONTH_NAMES[month - 1]}`;
  return value === todayISO ? `HOY · ${label}` : label;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/date.test.ts`
Expected: PASS (all cases, old + 3 new)

- [ ] **Step 5: Commit**

```bash
git add features/movements/date.ts __tests__/date.test.ts
git commit -m "feat: formatSectionHeaderDate for Movimientos date-group headers"
```

---

## Task 5: Movimientos screen — FlatList to SectionList grouped by date

**Files:**
- Modify: `app/(app)/movimientos.tsx`
- Create: `components/MovementDateSectionHeader.tsx`

**Interfaces:**
- Consumes: `groupMovementsByDate` (Task 3), `formatSectionHeaderDate` (Task 4).
- `MovementDateSectionHeader` props: `{ fecha: string; totalDelDia: number }`.

- [ ] **Step 1: Add the section header component**

Create `components/MovementDateSectionHeader.tsx`:

```tsx
import { Text, View } from 'react-native';
import { formatSectionHeaderDate, formatISODate } from '../features/movements/date';

interface MovementDateSectionHeaderProps {
  fecha: string;
  totalDelDia: number;
}

export function MovementDateSectionHeader({ fecha, totalDelDia }: MovementDateSectionHeaderProps) {
  const todayISO = formatISODate(new Date());
  const isNegative = totalDelDia < 0;
  return (
    <View className="flex-row items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
      <Text className="text-xs font-semibold text-gray-500 uppercase">
        {formatSectionHeaderDate(fecha, todayISO)}
      </Text>
      <Text className={`text-xs font-semibold ${isNegative ? 'text-red-500' : 'text-green-600'}`}>
        {isNegative ? '-' : '+'}${Math.abs(totalDelDia).toLocaleString('es-CL')}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Switch `movimientos.tsx` from `FlatList` to `SectionList`**

In `app/(app)/movimientos.tsx`:

1. Change the import line:
```ts
import { View, Text, SectionList, RefreshControl } from 'react-native';
```
(remove `FlatList` from that import)

2. Change the ref type:
```ts
const listRef = useRef<SectionList<Movement>>(null);
```

3. Add imports:
```ts
import { groupMovementsByDate } from '../../features/movements/dateGrouping';
import { MovementDateSectionHeader } from '../../components/MovementDateSectionHeader';
```

4. Right after the existing `visibleMovements` computation, add:
```ts
const sections = visibleMovements ? groupMovementsByDate(visibleMovements) : [];
```

5. Replace the `<FlatList ... />` element with:
```tsx
<SectionList
  ref={listRef}
  className="flex-1"
  sections={sections}
  keyExtractor={(item) => item.id}
  stickySectionHeadersEnabled
  renderSectionHeader={({ section }) => (
    <MovementDateSectionHeader fecha={section.fecha} totalDelDia={section.totalDelDia} />
  )}
  ListHeaderComponent={
    <>
      <MonthSelector year={year} month={month} onChange={setMonth} />
      {categories && (
        <MovementSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onPressFilter={() => setFilterSheetOpen(true)}
          filterActive={filterActive}
        />
      )}
    </>
  }
  ListEmptyComponent={
    <View className="items-center justify-center py-16">
      <Text className="text-gray-400 text-center px-8">
        {movements && movements.length > 0
          ? 'Ningún movimiento coincide con la búsqueda o el filtro.'
          : 'No hay movimientos registrados para este mes.'}
      </Text>
    </View>
  }
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
  renderItem={({ item }) => (
    <Animated.View entering={FadeIn.duration(350)} exiting={FadeOut.duration(300)} layout={LinearTransition.duration(300)}>
      <MovementListItem
        movement={item}
        category={categories?.find((c) => c.id === item.category_id)}
        onToggleEstado={() => toggleEstado(item)}
        onEdit={() => openEdit(item)}
        onDelete={() => handleDelete(item.id)}
        isUpdating={updateMovement.isPending && updateMovement.variables?.id === item.id}
      />
    </Animated.View>
  )}
/>
```

`SectionList` (unlike `FlatList`) doesn't accept `data`/no-sections separately — `ListEmptyComponent` still renders correctly when `sections` is `[]` (React Native's `SectionList` supports this the same way `FlatList` does).

6. `listRef.current?.scrollToOffset(...)` in the existing `tabPress` listener (`useEffect`) does not exist on `SectionList` — replace that one call with:
```ts
listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: false, viewOffset: 0 });
```
Guard it since `scrollToLocation` throws if there are no sections yet:
```ts
if (sections.length > 0) {
  listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: false, viewOffset: 0 });
}
```
(`sections` must be in that `useEffect`'s dependency array alongside `navigation`/`handleRefresh` for this closure to see the current value.)

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file (pre-existing unrelated errors, if any, are out of scope).

- [ ] **Step 4: Manual verification (no automated RN component test in this repo)**

Covered in the closing report to the user (Task 11).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/movimientos.tsx" components/MovementDateSectionHeader.tsx
git commit -m "feat: group Movimientos list by date with daily totals (SectionList)"
```

---

## Task 6: Cuota lifecycle overrides indefinite fija replication

**Files:**
- Modify: `features/movements/fixedCategoryReplication.ts`
- Modify: `__tests__/fixedCategoryReplication.test.ts`

**Interfaces:**
- `NewFixedMovementRow` gains `cuota_numero: number | null` and `cuota_total: number | null`.
- `computeFixedCategoryReplications` signature unchanged (same 5 params, same return type shape plus the 2 new fields).

- [ ] **Step 1: Add the failing test cases**

Add to `__tests__/fixedCategoryReplication.test.ts`, inside the existing `describe('computeFixedCategoryReplications', ...)` block:

```ts
  it('replicates a cuota series that has not reached its last installment, incrementing cuota_numero', () => {
    const priorMovements = [
      movement({ id: 'm-5', fecha: '2026-08-05', concepto: 'Zapatillas', cuota_numero: 5, cuota_total: 6 }),
    ];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2026, 9, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ cuota_numero: 6, cuota_total: 6, fecha: '2026-09-05' });
  });

  it('does not replicate a cuota series that already reached its last installment', () => {
    const priorMovements = [
      movement({ id: 'm-6', fecha: '2026-09-05', concepto: 'Zapatillas', cuota_numero: 6, cuota_total: 6 }),
    ];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2026, 10, 'u1');

    expect(result).toHaveLength(0);
  });

  it('still replicates indefinitely for a series with no cuotas (cuota_numero/cuota_total both null)', () => {
    const priorMovements = [movement({ id: 'm-luz', fecha: '2026-08-05', concepto: 'Luz' })];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2026, 9, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ cuota_numero: null, cuota_total: null });
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest __tests__/fixedCategoryReplication.test.ts`
Expected: the 3 new tests FAIL (`cuota_numero`/`cuota_total` currently always `undefined` on the result, and no stop-condition exists yet), existing 5 tests still PASS.

- [ ] **Step 3: Implement the override in `computeFixedCategoryReplications`**

Replace the full file `features/movements/fixedCategoryReplication.ts` with:

```ts
import { shiftFechaToMonth } from './fixedCategoryDate';
import type { Movement } from './types';

export interface NewFixedMovementRow {
  user_id: string;
  category_id: string;
  tipo: Movement['tipo'];
  concepto: string;
  monto: number;
  notas: string | null;
  estado: 'pendiente';
  fecha: string;
  icono: string;
  fixed_series_id: string;
  cuota_numero: number | null;
  cuota_total: number | null;
}

/** True once a cuota series has already replicated its last installment -- the fija category's "replicate indefinitely" rule stops applying to it from that point on. */
function cuotasCompleted(m: Movement): boolean {
  return m.cuota_total !== null && m.cuota_numero !== null && m.cuota_numero >= m.cuota_total;
}

/**
 * Pure decision logic behind ensureFixedCategoryMovementsForMonth
 * (features/movements/fixedCategories.ts), split out so the "jump straight
 * to a month far in the future" case can be unit-tested without a Supabase
 * connection.
 *
 * `priorMovements` is every fixed-category movement dated strictly before
 * the viewed month, REGARDLESS of how far back -- there is no requirement
 * that every month in between already has its own replica, which is what
 * makes a direct jump (e.g. Agosto 2026 -> Enero 2027) work in one step:
 * the latest prior instance of each series, however old, is still the
 * template that gets copied into the viewed month.
 *
 * A series whose latest instance carries cuota_numero/cuota_total (an
 * installment purchase living inside an otherwise-indefinite fija category,
 * e.g. "Zapatillas (cuota)" under CMR Falabella) stops replicating once
 * cuota_numero reaches cuota_total -- the cuota lifecycle overrides the
 * category's own "replicate forever" rule. A series with no cuotas
 * (cuota_numero/cuota_total both null, e.g. Luz, Agua) is unaffected and
 * keeps replicating indefinitely exactly as before.
 */
export function computeFixedCategoryReplications(
  priorMovements: Movement[],
  currentMonthSeriesIds: ReadonlySet<string>,
  year: number,
  month: number,
  userId: string
): NewFixedMovementRow[] {
  // Latest instance of each series -- priorMovements is expected sorted by
  // fecha descending, so the first occurrence per series is the newest one.
  const latestPerSeries = new Map<string, Movement>();
  for (const m of priorMovements) {
    const seriesId = m.fixed_series_id;
    if (seriesId && !latestPerSeries.has(seriesId)) {
      latestPerSeries.set(seriesId, m);
    }
  }

  return [...latestPerSeries.values()]
    .filter((m) => !currentMonthSeriesIds.has(m.fixed_series_id as string))
    .filter((m) => !cuotasCompleted(m))
    .map((m) => ({
      user_id: userId,
      category_id: m.category_id,
      tipo: m.tipo,
      concepto: m.concepto,
      monto: m.monto,
      notas: m.notas,
      estado: 'pendiente' as const,
      fecha: shiftFechaToMonth(m.fecha, year, month),
      icono: m.icono,
      fixed_series_id: m.fixed_series_id as string,
      cuota_numero: m.cuota_numero === null ? null : m.cuota_numero + 1,
      cuota_total: m.cuota_total,
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/fixedCategoryReplication.test.ts`
Expected: PASS (8 tests: 5 existing + 3 new)

- [ ] **Step 5: Wire the 2 new fields into the actual insert**

`features/movements/fixedCategories.ts` inserts `computeFixedCategoryReplications`'s output directly via `supabase.from('movements').insert(toInsert)` (see its `ensureFixedCategoryMovementsForMonth`) — since `NewFixedMovementRow` now includes `cuota_numero`/`cuota_total`, and the insert already spreads every field of `toInsert` as-is (no field allowlist/mapping in between), **no change is needed in `fixedCategories.ts` itself.** Confirm this by reading `features/movements/fixedCategories.ts` lines 66-79 and checking `toInsert` (the direct return of `computeFixedCategoryReplications`) is passed straight into `.insert(toInsert)` with no intermediate `.map()` that would drop the 2 new fields.

- [ ] **Step 6: Commit**

```bash
git add features/movements/fixedCategoryReplication.ts __tests__/fixedCategoryReplication.test.ts
git commit -m "fix: cuota lifecycle overrides indefinite fija-category replication"
```

---

## Task 7: Rewrite `datos_presupuesto.json` with the reconciled Agosto 2026 data

**Files:**
- Modify: `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\datos_presupuesto.json`

This file lives in the root checkout (not the worktree) since `scripts/` and `.env` are untracked, root-only files (verified: the worktree has no `scripts/` directory). Tasks 7-9 all operate on the root checkout.

Reconciliation applied vs. the raw PDF figures (per the user's confirmed decisions):
- "Sueldo mensual" is **not** included in `ingresos` — it's driven by `recurring_income` instead (Task 8 upserts it and materializes August's movement directly), per the rule "no debe agregarse como movimiento común si ya está guardado en Ingreso Mensual Recurrente".
- 3 items whose real-world date falls in julio but that are part of the Agosto budget cycle — the $40.403 "Ingreso adicional" and "Agua" — are dated `2026-08-01` instead of their literal `2026-07-30`/`2026-07-31`, so the app's own calendar-month filter counts them in Agosto. ("Claude", also julio-dated but `pendiente`, is left as-is since pendiente movements never count toward `saldoDisponible` regardless of month.)
- "Zapatillas (cuota)" → concepto cleaned to `"Zapatillas"` (no `"(cuota)"` suffix) since `cuota_numero`/`cuota_total` now drive the `"(5/6)"` display automatically (see Task 2's `MovementListItem`/`MovementDetailSheet`, which already append `(${cuota_numero}/${cuota_total})`).
- New per-item fields `cuota_actual`/`cuotas_totales` on "Zapatillas" and "Crédito auto" feed the new `cuota_numero`/`cuota_total` + `fixed_series_id` logic in Task 8/6.

- [ ] **Step 1: Write the file**

```json
{
  "usuario_email": "basti.guzman29@gmail.com",
  "ingreso_mensual_recurrente": {
    "concepto": "Sueldo",
    "tipo": "fijo",
    "monto": 946833
  },
  "ingresos": [
    {"descripcion": "Ingreso adicional", "monto": 40403, "fecha": "2026-08-01", "estado": "pagado", "es_fijo": false, "notas": "Quedaba antes de la transferencia del sueldo"},
    {"descripcion": "Ingreso adicional", "monto": 15000, "fecha": "2026-08-02", "estado": "pagado", "es_fijo": false, "notas": "Transferencia de suegrita por desbloquear celular motorola"},
    {"descripcion": "Ingreso adicional", "monto": 16000, "fecha": "2026-08-04", "estado": "pagado", "es_fijo": false, "notas": "Transferencia de Alvarito por entradas cine"},
    {"descripcion": "Ingreso adicional", "monto": 16000, "fecha": "2026-08-04", "estado": "pagado", "es_fijo": false, "notas": "Transferencia de Luchito por entradas cine"}
  ],
  "gastos_fijos": [
    {"descripcion": "Luz (electricidad)", "monto": 55484, "categoria": "Gastos Fijos", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": true, "notas": "Promedio mensual"},
    {"descripcion": "Agua", "monto": 15810, "categoria": "Gastos Fijos", "fecha": "2026-08-01", "estado": "pagado", "es_fijo": true, "notas": "Estimado, no pasa de $16.000"},
    {"descripcion": "Plan móvil WOM", "monto": 1000, "categoria": "Gastos Fijos", "fecha": "2026-08-01", "estado": "pendiente", "es_fijo": true, "notas": "WOM Xiaomi 17"},
    {"descripcion": "Plan móvil ENTEL", "monto": 23324, "categoria": "Gastos Fijos", "fecha": "2026-08-01", "estado": "pendiente", "es_fijo": true, "notas": "ENTEL Xiaomi 17"},
    {"descripcion": "IPTV", "monto": 7500, "categoria": "Gastos Fijos", "fecha": "2026-08-04", "estado": "pendiente", "es_fijo": true, "notas": "Mensual fijo"},
    {"descripcion": "Polla", "monto": 30000, "categoria": "Gastos Fijos", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": true, "notas": "Mensual fijo"},
    {"descripcion": "Claude", "monto": 23000, "categoria": "Gastos Fijos", "fecha": "2026-07-29", "estado": "pendiente", "es_fijo": true, "notas": "Mensual fijo (lo pagué de la Santander este mes)"},
    {"descripcion": "Bupa Seguro (IntegraMedica)", "monto": 12622, "categoria": "Gastos Fijos", "fecha": "2026-08-03", "estado": "pagado", "es_fijo": true, "notas": "Mensual fijo"}
  ],
  "cmr_falabella": [
    {"descripcion": "Gimnasio", "monto": 27113, "categoria": "CMR Falabella", "fecha": "2026-08-05", "estado": "pendiente", "es_fijo": true, "notas": "Mensualidad"},
    {"descripcion": "Zapatillas", "monto": 21248, "categoria": "CMR Falabella", "fecha": "2026-08-05", "estado": "pendiente", "es_fijo": false, "cuota_actual": 5, "cuotas_totales": 6, "notas": "6 cuotas de $21.248 - pago desde el 5 de cada mes"},
    {"descripcion": "Falabella", "monto": 1089, "categoria": "CMR Falabella", "fecha": "2026-08-05", "estado": "pendiente", "es_fijo": true, "notas": "Cobro de nuevo impuesto de Falabella"},
    {"descripcion": "Servicio Administración", "monto": 5222, "categoria": "CMR Falabella", "fecha": "2026-08-05", "estado": "pendiente", "es_fijo": true, "notas": "Cobro por uso de tarjeta CMR"}
  ],
  "cuotas_credito": [
    {"descripcion": "Crédito auto", "monto": 257000, "categoria": "Cuotas/Crédito", "fecha": "2026-08-01", "estado": "pendiente", "es_fijo": false, "cuota_actual": 4, "cuotas_totales": 36, "notas": "Cuota 4/36"}
  ],
  "gastos_extras": [
    {"descripcion": "Transferencia a mamá", "monto": 200000, "categoria": "Gastos Extras", "fecha": "2026-08-01", "estado": "pagado", "es_fijo": false, "notas": "Feria"},
    {"descripcion": "Entradas Cinepolis", "monto": 49800, "categoria": "Gastos Extras", "fecha": "2026-08-03", "estado": "pagado", "es_fijo": false, "notas": "Spiderman Brand New Day 4D (Alvarito + Luchito + yo)"},
    {"descripcion": "Transferencia bb", "monto": 30000, "categoria": "Gastos Extras", "fecha": "2026-08-01", "estado": "pagado", "es_fijo": false, "notas": "Debía cine anterior + 15 de los capítulos de anime"},
    {"descripcion": "Supermercado", "monto": 18990, "categoria": "Gastos Extras", "fecha": "2026-08-01", "estado": "pagado", "es_fijo": false, "notas": "Lider Express (Yogurth + Cereal + 4 energéticas + Powerade)"},
    {"descripcion": "Doc Popcorn", "monto": 4400, "categoria": "Gastos Extras", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": false, "notas": "Cabritas medianas"},
    {"descripcion": "Tottus", "monto": 18716, "categoria": "Gastos Extras", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": false, "notas": "5 bebidas lata + 2 rolls + 2 twistos jamón + 2 kryspos + dulce + tictac + maní"},
    {"descripcion": "Transferencia bb", "monto": 20000, "categoria": "Gastos Extras", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": false, "notas": "BurguerKing"},
    {"descripcion": "Estacionamiento", "monto": 7300, "categoria": "Gastos Extras", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": false, "notas": "Mall Plaza Egaña, película Spiderman 4D"}
  ],
  "ahorro": [
    {"descripcion": "Transferencia a cuenta Santander", "monto": 200000, "categoria": "Ahorro", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": true, "notas": "Ahorro mensual del sueldo base"},
    {"descripcion": "Transferencia a Ahorro Santander", "monto": 100000, "categoria": "Ahorro", "fecha": "2026-08-04", "estado": "pagado", "es_fijo": true, "notas": "100 para la cuenta de ahorro"}
  ]
}
```

- [ ] **Step 2: Validate it's syntactically valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('datos_presupuesto.json', 'utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add datos_presupuesto.json
git commit -m "data: reconcile Agosto 2026 budget JSON (sueldo via recurring_income, cuota fields, date reconciliation)"
```

(This commits to whichever repo `datos_presupuesto.json` is tracked in — check with `git status datos_presupuesto.json` first; it showed as untracked in the root repo at the start of this session, so `git add` here adds it for the first time.)

---

## Task 8: Update `seed-presupuesto.js` for recurring income + cuota fields

**Files:**
- Modify: `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\scripts\seed-presupuesto.js`

- [ ] **Step 1: Replace the recurring-income handling block**

Find this block (currently around line 175-187):

```js
  // Any existing recurring-income config is soft-disabled (not deleted) so
  // it stops silently auto-generating its own "Sueldo" movement every month
  // -- that would double up with the real Sueldo mensual loaded below,
  // which isn't linked to it. Left recoverable via Cuenta if the user wants
  // the automated monthly prompt back later.
  console.log('Desactivando configuración de ingreso recurrente previa (si existe)...');
  const { error: incomeError, count: deactivated } = await supabase
    .from('recurring_income')
    .update({ activo: false }, { count: 'exact' })
    .eq('user_id', userId)
    .eq('activo', true);
  if (incomeError) throw incomeError;
  console.log(`  ${deactivated ?? 0} configuración(es) desactivada(s).`);
```

Replace it with:

```js
  // Sueldo is driven by recurring_income, not a plain movement (see
  // datos_presupuesto.json's `ingreso_mensual_recurrente` and the rule that
  // the monthly salary must never also appear as a regular Ingresos row --
  // that would double-count it). Upsert the user's recurring_income row to
  // match the real monto, then materialize August's own movement for it
  // directly here (rather than waiting for ensureRecurringIncomeForMonth to
  // do it lazily on first app view) so verify-presupuesto.js reports the
  // correct totals immediately after this script runs.
  console.log('\nConfigurando ingreso mensual recurrente (Sueldo)...');
  const recurring = data.ingreso_mensual_recurrente;
  const { data: existingRecurring, error: fetchRecurringError } = await supabase
    .from('recurring_income')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fetchRecurringError) throw fetchRecurringError;

  let recurringIncomeId;
  if (existingRecurring) {
    const { error: updateRecurringError } = await supabase
      .from('recurring_income')
      .update({ concepto: recurring.concepto, tipo: recurring.tipo, monto: recurring.monto, activo: true })
      .eq('id', existingRecurring.id);
    if (updateRecurringError) throw updateRecurringError;
    recurringIncomeId = existingRecurring.id;
    console.log(`  recurring_income actualizado (${existingRecurring.id}) -> monto $${recurring.monto.toLocaleString('es-CL')}`);
  } else {
    const { data: createdRecurring, error: createRecurringError } = await supabase
      .from('recurring_income')
      .insert({ user_id: userId, concepto: recurring.concepto, tipo: recurring.tipo, monto: recurring.monto, activo: true })
      .select('id')
      .single();
    if (createRecurringError) throw createRecurringError;
    recurringIncomeId = createdRecurring.id;
    console.log(`  recurring_income creado (${createdRecurring.id}) -> monto $${recurring.monto.toLocaleString('es-CL')}`);
  }
```

- [ ] **Step 2: Exclude Sueldo from `buildMovements`, since it's no longer in `data.ingresos`**

`buildMovements` already only reads `data.ingresos` for the `Ingresos` category — since Task 7's JSON no longer includes "Sueldo mensual" in that array, no code change is needed in `buildMovements` itself. Confirm this by re-reading the function (lines ~86-99) and checking it doesn't reference `data.ingreso_mensual_recurrente` — it shouldn't, that field is handled entirely by Step 1/Step 3 of this task instead.

- [ ] **Step 3: Insert August's materialized Sueldo movement alongside the other rows**

Find the `rowsToInsert` construction (currently around line 205-231, `const rowsToInsert = movementRows.map(...)`). Change it to also read `cuota_actual`/`cuotas_totales` when present, and prepend the recurring-income movement:

```js
  // 3. Insert movements.
  console.log('\nInsertando movimientos...');
  const rowsToInsert = movementRows.map((item) => {
    // A movement belongs to a fixed-category replication chain (gets a
    // fixed_series_id) whenever either: (a) it's marked es_fijo:true (an
    // indefinite recurring item -- Luz, Agua, Gimnasio...), or (b) it
    // carries cuota_actual/cuotas_totales inside a fija category (an
    // installment purchase whose monthly replication must still run, but
    // stops once the cuota lifecycle completes -- see
    // features/movements/fixedCategoryReplication.ts's cuotasCompleted).
    const hasCuotas = item.cuota_actual != null && item.cuotas_totales != null;
    const isReplicatingSeries = item.es_fijo === true || hasCuotas;
    return {
      user_id: userId,
      category_id: categoryIdByName[item.categoria],
      tipo: item.tipo,
      concepto: item.descripcion,
      monto: item.monto,
      notas: item.notas ?? null,
      estado: item.estado,
      fecha: item.fecha,
      installment_group_id: null,
      cuota_numero: hasCuotas ? item.cuota_actual : null,
      cuota_total: hasCuotas ? item.cuotas_totales : null,
      icono: suggestIcon(item.descripcion),
      recurring_income_id: null,
      fixed_series_id: isReplicatingSeries ? crypto.randomUUID() : null,
    };
  });

  // August's own Sueldo movement -- generated here (not left for the app to
  // lazily create on first view) so this script's own totals, and
  // verify-presupuesto.js right after it, already reflect the real number.
  rowsToInsert.push({
    user_id: userId,
    category_id: categoryIdByName['Ingresos'],
    tipo: 'ingreso',
    concepto: recurring.concepto,
    monto: recurring.monto,
    notas: null,
    estado: 'pagado',
    fecha: '2026-08-01',
    installment_group_id: null,
    cuota_numero: null,
    cuota_total: null,
    icono: suggestIcon(recurring.concepto),
    recurring_income_id: recurringIncomeId,
    fixed_series_id: null,
  });

  const { data: inserted, error: insertError } = await supabase.from('movements').insert(rowsToInsert).select();
  if (insertError) throw insertError;
  console.log(`  ${inserted.length} movimientos insertados.`);
```

This replaces the old comment block that explained *why* `cuota_numero`/`cuota_total` were deliberately left null — that reasoning no longer applies now that Zapatillas/Crédito auto's concepto no longer bakes the "(N/M)" text in (Task 7).

- [ ] **Step 4: Update the dry-run summary to also show the recurring income line**

Find the dry-run block (around line 139-154, right before `if (DRY_RUN)`), and add one line right after the existing `Total ingresos:` / `Total gastos:` console.logs, before the `if (DRY_RUN)` check:

```js
  console.log(`Ingreso mensual recurrente (Sueldo): $${recurring.monto.toLocaleString('es-CL')} (no cuenta en 'Total ingresos' de arriba -- se calcula aparte)`);
```

Note: this line must come after `const recurring = data.ingreso_mensual_recurrente;` — since that assignment happens in Step 1's block, which currently sits *after* the dry-run check in the original file's order. Move the `const recurring = data.ingreso_mensual_recurrente;` line up so it's defined before this dry-run summary block (right after `const data = JSON.parse(...)` is fine), independent of the rest of Step 1's block which stays under the `if (DRY_RUN) return;` guard as before.

- [ ] **Step 5: Dry-run and inspect the output**

Run: `node scripts/seed-presupuesto.js --dry-run`
Expected: no errors, prints category/movement counts and totals, ends with `--dry-run: no se modificó la base de datos.` Read the full output carefully — this is the last chance to catch a mistake before Task 10 touches real data.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-presupuesto.js
git commit -m "feat: seed script drives Sueldo via recurring_income, writes cuota fields for cuota-in-fija items"
```

---

## Task 9: Update `verify-presupuesto.js` to compute saldo the same way the app does

**Files:**
- Modify: `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\scripts\verify-presupuesto.js`

The script's current "Saldo disponible" sums **every** movement for the user regardless of `estado` or month — that doesn't match `calculateMonthSummary` (pagado-only) or `useMovements` (strict calendar-month filter), so it can't actually confirm the $271.114 target. Add a second, correctly-filtered calculation.

- [ ] **Step 1: Add the Agosto-specific, pagado-only calculation**

Find this block (currently around line 69-81):

```js
  const totalIngresos = movements.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const totalGastos = movements.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0);
  const pendientes = movements.filter((m) => m.estado === 'pendiente').length;
  const pagados = movements.filter((m) => m.estado === 'pagado').length;
  const fijos = movements.filter((m) => m.fixed_series_id).length;

  console.log('\n=== Resumen ===');
  console.log(`Total movimientos: ${movements.length}`);
  console.log(`Pagados: ${pagados} | Pendientes: ${pendientes}`);
  console.log(`Marcados como fijos (replicarán en Septiembre): ${fijos}`);
  console.log(`Total ingresos: $${totalIngresos.toLocaleString('es-CL')}`);
  console.log(`Total gastos: $${totalGastos.toLocaleString('es-CL')}`);
  console.log(`Saldo disponible (agosto): $${(totalIngresos - totalGastos).toLocaleString('es-CL')}`);
```

Replace it with:

```js
  const totalIngresos = movements.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const totalGastos = movements.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0);
  const pendientes = movements.filter((m) => m.estado === 'pendiente').length;
  const pagados = movements.filter((m) => m.estado === 'pagado').length;
  const fijos = movements.filter((m) => m.fixed_series_id).length;

  console.log('\n=== Resumen (todos los movimientos del usuario, cualquier mes) ===');
  console.log(`Total movimientos: ${movements.length}`);
  console.log(`Pagados: ${pagados} | Pendientes: ${pendientes}`);
  console.log(`Marcados como fijos (replicarán el mes siguiente): ${fijos}`);
  console.log(`Total ingresos: $${totalIngresos.toLocaleString('es-CL')}`);
  console.log(`Total gastos: $${totalGastos.toLocaleString('es-CL')}`);

  // This is the number the app itself would show for "Agosto 2026" --
  // calculateMonthSummary (features/movements/summary.ts) only sums
  // estado='pagado', and useMovements filters strictly by calendar month
  // (fecha >= '2026-08-01' AND fecha < '2026-09-01'). The unfiltered totals
  // above intentionally do NOT match this -- they're a raw sanity count
  // across every month currently in the table.
  const isAgosto2026 = (m) => m.fecha >= '2026-08-01' && m.fecha < '2026-09-01';
  const agostoPagados = movements.filter((m) => m.estado === 'pagado' && isAgosto2026(m));
  const agostoIngresos = agostoPagados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const agostoGastos = agostoPagados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0);
  const saldoAgosto = agostoIngresos - agostoGastos;

  console.log('\n=== Saldo disponible Agosto 2026 (fórmula real de la app: pagado + fecha en agosto) ===');
  console.log(`Ingresos pagados de agosto: $${agostoIngresos.toLocaleString('es-CL')}`);
  console.log(`Gastos pagados de agosto: $${agostoGastos.toLocaleString('es-CL')}`);
  console.log(`Saldo disponible (agosto): $${saldoAgosto.toLocaleString('es-CL')}`);
  const SALDO_ESPERADO = 271114;
  if (saldoAgosto !== SALDO_ESPERADO) {
    console.log(`\n*** ADVERTENCIA: saldo esperado $${SALDO_ESPERADO.toLocaleString('es-CL')}, pero se calculó $${saldoAgosto.toLocaleString('es-CL')} ***`);
  } else {
    console.log(`\nSaldo coincide exactamente con el objetivo de $${SALDO_ESPERADO.toLocaleString('es-CL')}.`);
  }
```

- [ ] **Step 2: Syntax-check the script**

Run: `node --check scripts/verify-presupuesto.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-presupuesto.js
git commit -m "feat: verify script computes Agosto saldo the same way the app does (pagado + calendar month)"
```

---

## Task 10: Dry-run review checkpoint — STOP for explicit user confirmation

This task has no code changes. It is a mandatory pause before Task 11 is allowed to run.

- [ ] **Step 1: Run the dry-run one more time against the final scripts**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app"
node scripts/seed-presupuesto.js --dry-run
```

- [ ] **Step 2: Present the full output to the user in Spanish**, along with:
  - How many movimientos/categorías will be deleted (existing counts from the last `verify-presupuesto.js` run).
  - The exact `recurring_income` change (950.000 → 946.833).
  - Confirmation that the computed Agosto saldo will be $271.114.

- [ ] **Step 3: Do not proceed to Task 11 until the user explicitly confirms** ("sí", "dale", "procede", or equivalent). If they ask for changes, go back to Task 7/8 and adjust `datos_presupuesto.json`/`seed-presupuesto.js`, then re-run this task from Step 1.

---

## Task 11: Real seed run, verification, and full test suite

**Only runs after Task 10's explicit user confirmation.**

- [ ] **Step 1: Run the real seed (no `--dry-run`)**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app"
node scripts/seed-presupuesto.js
```

Expected: ends with `Listo.` and no thrown error. If it throws, stop and report the exact error — do not retry blindly (the delete step already ran; investigate before re-running).

- [ ] **Step 2: Run verification**

```bash
node scripts/verify-presupuesto.js
```

Expected: ends with `Sin problemas estructurales detectados.` and prints `Saldo coincide exactamente con el objetivo de $271.114.` (not the `*** ADVERTENCIA ***` line). If the warning prints instead, stop and report the discrepancy — do not adjust data to force a match without understanding why the numbers diverged.

- [ ] **Step 3: Run the full Jest suite**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp"
npx jest
```

Expected: all suites PASS, including the new `dateGrouping.test.ts`, the updated `date.test.ts` and `fixedCategoryReplication.test.ts`, and every pre-existing test file untouched by this plan.

- [ ] **Step 4: TypeScript check across the worktree**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing ones unrelated to this plan's files — cross-check against `git stash` / `git diff` if any appear, to confirm they're not new).

- [ ] **Step 5: Report to the user in Spanish**, per `AGENTS.md`'s closing protocol — summarize every change (A/B/C/D + AGENTS.md instruction), what to test manually in the running app (open Movimientos for Agosto 2026, confirm the row shows only the switch, tap a row to see Editar/Eliminar in the sheet, confirm date-grouped sections with daily totals, confirm Zapatillas shows "(5/6)"), whether the Expo server needs a restart (data-only + pure-logic changes reload fine via Fast Refresh; **no restart needed** unless the developer notices otherwise), and remind that the dev server must point at this worktree's folder per point 5 of the protocol.
