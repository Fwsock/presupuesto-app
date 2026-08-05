# Detail-sheet button fix, custom calendar, month/year picker, and onboarding polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken Editar/Eliminar button layout in the movement detail sheet, replace the native date picker with a fully custom-styled calendar everywhere a date is picked, add a two-tap month/year quick-picker to the shared month header, and polish the registration/onboarding flow (transitions, back navigation, skeleton loading).

**Architecture:** All work happens in the worktree at `C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp`. Two new pure-logic/presentational component pairs (`CalendarPickerModal` + `buildCalendarGrid`, `MonthYearPickerModal`) replace/extend two existing single-instance components (`DateField`, `MonthSelector`) — both consumers (`MovementFormModal`, and `movimientos.tsx`/`index.tsx` respectively) need zero changes since the public prop contracts stay the same. The onboarding/registration polish touches `app/_layout.tsx`, `app/verify-otp.tsx`, `app/onboarding.tsx`.

**Tech Stack:** Expo/React Native (v57), TypeScript, NativeWind (Tailwind classNames), Jest + ts-jest for pure-logic tests.

## Global Constraints

- App's primary blue is Tailwind `blue-600` (`#2563eb`) — use it for every "selected/active/primary action" state introduced in this plan (selected calendar day, active month, Guardar button), matching `ConfirmDialog`'s existing `default`/blue-600 button styling.
- Every new modal (`CalendarPickerModal`, `MonthYearPickerModal`) uses the same fade+scale center-card chrome as `components/ConfirmDialog.tsx` (rounded-2xl white card, backdrop `bg-black/40`, tap-outside-to-dismiss `Pressable` behind the card, `mounted` state that keeps the `Modal` alive through the exit animation) — do not invent a different modal shell.
- **`PressableScale` gotcha (read before writing any `flex-1` sibling row of `PressableScale`s):** `PressableScale` puts `style`/`className` on its *inner* `Pressable`, not on the outer `Animated.View` that is the actual flex child of its parent row. Putting `flex-1` directly in a `PressableScale`'s `className` inside a `flex-row` parent does nothing — it must go on a plain wrapping `View` instead (`<View style={{flex:1}}><PressableScale className="...">`). This exact mistake is what Task 1 below fixes, and every later task that builds a `flex-row` of equal-width `PressableScale` buttons (Task 3, Task 5) must use the wrapping-`View` pattern from the start.
- No new dependencies: `react-native-safe-area-context` is installed but has no `SafeAreaProvider` mounted anywhere in this app — do not introduce one. Any "stay clear of the status bar" positioning uses a fixed offset, matching the existing `pt-16` constant `app/onboarding.tsx` already uses for its own content start.
- `@react-native-community/datetimepicker` stops being imported by `DateField.tsx` in this plan but is NOT removed from `package.json` — out of scope.

---

## Task 1: Fix MovementDetailSheet's Editar/Eliminar button layout bug

**Files:**
- Modify: `components/MovementDetailSheet.tsx`

**Interfaces:** No prop/signature changes — this is a pure JSX layout fix.

- [ ] **Step 1: Read the current file and locate the actions block**

Read `components/MovementDetailSheet.tsx` in full. Find the block that currently reads (near the bottom, inside `{!isLocked && (...)}`):

```tsx
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
```

**Step 2: Explain the bug** (context for your own understanding, not a step to skip): `PressableScale` (see `components/PressableScale.tsx`) forwards `className`/`style` to its *inner* `Pressable`, one level below the `Animated.View` wrapper that is the actual flex child of this row. So `className="flex-1 ..."` sets `flex: 1` on the inner `Pressable`, which has zero effect on how much width the outer `Animated.View` claims from the `flex-row` parent — both buttons collapse to their content's shrink-to-fit width instead of sharing the row 50/50, which is what makes them look cut off/misaligned. `components/MovementListItem.tsx` already documents and works around this exact issue with a comment right above its own flex-1 wrapper — read that comment for the precedent.

- [ ] **Step 3: Apply the fix**

Replace the block from Step 1 with:

```tsx
      {!isLocked && (
        <View className="border-t border-gray-100 mt-6 pt-4 flex-row" style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PressableScale
              onPress={onEdit}
              className="flex-row items-center justify-center py-3 px-3 rounded-lg border border-gray-300"
              accessibilityRole="button"
              accessibilityLabel="Editar movimiento"
            >
              <Ionicons name="pencil-outline" size={18} color="#374151" style={{ marginRight: 6 }} />
              <Text className="font-semibold text-gray-700">Editar</Text>
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <PressableScale
              onPress={onDelete}
              className="flex-row items-center justify-center py-3 px-3 rounded-lg bg-red-600"
              accessibilityRole="button"
              accessibilityLabel="Eliminar movimiento"
            >
              <Ionicons name="trash-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text className="font-semibold text-white">Eliminar</Text>
            </PressableScale>
          </View>
        </View>
      )}
```

(The only changes: each `PressableScale` is now wrapped in a `<View style={{flex:1}}>`, `flex-1` is removed from each `PressableScale`'s own `className`, and `px-3` is added so the icon+text never touches the button's own edge.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean, no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/MovementDetailSheet.tsx
git commit -m "fix: Editar/Eliminar buttons in MovementDetailSheet now actually share the row 50/50"
```

---

## Task 2: `buildCalendarGrid` pure function + tests

**Files:**
- Create: `features/movements/calendarGrid.ts`
- Test: `__tests__/calendarGrid.test.ts`

**Interfaces:**
- Produces: `export interface CalendarDay { year: number; month: number; day: number; isCurrentMonth: boolean }`, `export function buildCalendarGrid(year: number, month: number): CalendarDay[]` — always returns exactly 42 cells (6 Monday-start weeks), padded with adjacent months' real day numbers. Consumed by Task 3 (`CalendarPickerModal`).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/calendarGrid.test.ts`:

```ts
import { buildCalendarGrid } from '../features/movements/calendarGrid';

describe('buildCalendarGrid', () => {
  it('always returns exactly 42 cells (6 Monday-start weeks)', () => {
    expect(buildCalendarGrid(2026, 2)).toHaveLength(42);
    expect(buildCalendarGrid(2024, 1)).toHaveLength(42);
    expect(buildCalendarGrid(2024, 2)).toHaveLength(42);
  });

  it('has zero leading padding when the month starts on a Monday (January 2024)', () => {
    const cells = buildCalendarGrid(2024, 1);
    expect(cells[0]).toEqual({ year: 2024, month: 1, day: 1, isCurrentMonth: true });
    expect(cells[30]).toEqual({ year: 2024, month: 1, day: 31, isCurrentMonth: true });
    // 31 days used, 11 trailing padding cells from February to reach 42.
    expect(cells[31]).toEqual({ year: 2024, month: 2, day: 1, isCurrentMonth: false });
    expect(cells[41]).toEqual({ year: 2024, month: 2, day: 11, isCurrentMonth: false });
  });

  it('pads a month that starts mid-week with real prior/next month day numbers (February 2026, starts on Sunday)', () => {
    const cells = buildCalendarGrid(2026, 2);
    // Monday-start week, Sunday start -> 6 leading padding days from January (26-31).
    expect(cells.slice(0, 6)).toEqual([
      { year: 2026, month: 1, day: 26, isCurrentMonth: false },
      { year: 2026, month: 1, day: 27, isCurrentMonth: false },
      { year: 2026, month: 1, day: 28, isCurrentMonth: false },
      { year: 2026, month: 1, day: 29, isCurrentMonth: false },
      { year: 2026, month: 1, day: 30, isCurrentMonth: false },
      { year: 2026, month: 1, day: 31, isCurrentMonth: false },
    ]);
    expect(cells[6]).toEqual({ year: 2026, month: 2, day: 1, isCurrentMonth: true });
    expect(cells[33]).toEqual({ year: 2026, month: 2, day: 28, isCurrentMonth: true });
    // 6 leading + 28 days = 34 cells used, 8 trailing padding cells from March.
    expect(cells[34]).toEqual({ year: 2026, month: 3, day: 1, isCurrentMonth: false });
    expect(cells[41]).toEqual({ year: 2026, month: 3, day: 8, isCurrentMonth: false });
  });

  it('handles a leap-year February correctly (2024, starts on Thursday)', () => {
    const cells = buildCalendarGrid(2024, 2);
    // Thursday start -> 3 leading padding days from January (29-31).
    expect(cells.slice(0, 3)).toEqual([
      { year: 2024, month: 1, day: 29, isCurrentMonth: false },
      { year: 2024, month: 1, day: 30, isCurrentMonth: false },
      { year: 2024, month: 1, day: 31, isCurrentMonth: false },
    ]);
    expect(cells[3]).toEqual({ year: 2024, month: 2, day: 1, isCurrentMonth: true });
    expect(cells[31]).toEqual({ year: 2024, month: 2, day: 29, isCurrentMonth: true });
    // 3 leading + 29 days = 32 cells used, 10 trailing padding cells from March.
    expect(cells[32]).toEqual({ year: 2024, month: 3, day: 1, isCurrentMonth: false });
    expect(cells[41]).toEqual({ year: 2024, month: 3, day: 10, isCurrentMonth: false });
  });

  it('rolls year boundaries correctly: December padding trails into next-year January, January padding leads from prior-year December', () => {
    // December 2026 starts on a Tuesday -> 1 leading padding cell from
    // November 30, 2026; 31 real days; 10 trailing cells from January 2027.
    const decCells = buildCalendarGrid(2026, 12);
    expect(decCells[0]).toEqual({ year: 2026, month: 11, day: 30, isCurrentMonth: false });
    expect(decCells[1]).toEqual({ year: 2026, month: 12, day: 1, isCurrentMonth: true });
    expect(decCells[31]).toEqual({ year: 2026, month: 12, day: 31, isCurrentMonth: true });
    expect(decCells[32]).toEqual({ year: 2027, month: 1, day: 1, isCurrentMonth: false });
    expect(decCells[41]).toEqual({ year: 2027, month: 1, day: 10, isCurrentMonth: false });

    // January 2027 starts on a Friday -> 4 leading padding cells from
    // December 28-31, 2026; 31 real days; 7 trailing cells from February 2027.
    const janCells = buildCalendarGrid(2027, 1);
    expect(janCells.slice(0, 4)).toEqual([
      { year: 2026, month: 12, day: 28, isCurrentMonth: false },
      { year: 2026, month: 12, day: 29, isCurrentMonth: false },
      { year: 2026, month: 12, day: 30, isCurrentMonth: false },
      { year: 2026, month: 12, day: 31, isCurrentMonth: false },
    ]);
    expect(janCells[4]).toEqual({ year: 2027, month: 1, day: 1, isCurrentMonth: true });
    expect(janCells[34]).toEqual({ year: 2027, month: 1, day: 31, isCurrentMonth: true });
    expect(janCells[35]).toEqual({ year: 2027, month: 2, day: 1, isCurrentMonth: false });
    expect(janCells[41]).toEqual({ year: 2027, month: 2, day: 7, isCurrentMonth: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/calendarGrid.test.ts`
Expected: FAIL — `Cannot find module '../features/movements/calendarGrid'`

- [ ] **Step 3: Implement `buildCalendarGrid`**

Create `features/movements/calendarGrid.ts`:

```ts
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export interface CalendarDay {
  year: number;
  /** 1-12. This is the DAY's own month, which may differ from the grid's target month for leading/trailing padding cells. */
  month: number;
  day: number;
  isCurrentMonth: boolean;
}

/**
 * Monday-start, 6-week (42-cell) calendar grid for `month` (1-12) of `year`,
 * padded with real day numbers from the adjacent months so every month
 * renders the same height (no layout jump switching between a 4-week and a
 * 6-week month) and so a padding cell can still show a real day number
 * instead of blank space.
 */
export function buildCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  // JS getDay(): Sunday=0..Saturday=6. Convert to Monday-start: Monday=0..Sunday=6.
  const leadingCount = (firstOfMonth.getDay() + 6) % 7;
  const totalDaysThisMonth = daysInMonth(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthDays = daysInMonth(prevYear, prevMonth);

  const cells: CalendarDay[] = [];

  for (let i = leadingCount - 1; i >= 0; i--) {
    cells.push({ year: prevYear, month: prevMonth, day: prevMonthDays - i, isCurrentMonth: false });
  }

  for (let d = 1; d <= totalDaysThisMonth; d++) {
    cells.push({ year, month, day: d, isCurrentMonth: true });
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ year: nextYear, month: nextMonth, day: nextDay, isCurrentMonth: false });
    nextDay += 1;
  }

  return cells;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/calendarGrid.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add features/movements/calendarGrid.ts __tests__/calendarGrid.test.ts
git commit -m "feat: pure buildCalendarGrid helper for the custom calendar picker"
```

---

## Task 3: `CalendarPickerModal` component

**Files:**
- Create: `components/CalendarPickerModal.tsx`

**Interfaces:**
- Consumes: `buildCalendarGrid` (Task 2), `formatISODate`/`isValidISODate`/`parseISODate` (existing, `features/movements/date.ts`), `MONTH_NAMES` (existing, `features/shared/monthNames.ts`).
- Produces: `interface CalendarPickerModalProps { visible: boolean; value: string; onSave: (value: string) => void; onCancel: () => void }`. `value`/`onSave` use the same `'YYYY-MM-DD'` ISO string convention as `DateField`. Consumed by Task 4 (`DateField`).

- [ ] **Step 1: Create the component**

Create `components/CalendarPickerModal.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { buildCalendarGrid } from '../features/movements/calendarGrid';
import { formatISODate, isValidISODate, parseISODate } from '../features/movements/date';
import { MONTH_NAMES } from '../features/shared/monthNames';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const CELL_SIZE = 36;

interface CalendarPickerModalProps {
  visible: boolean;
  /** 'YYYY-MM-DD', or '' if nothing is selected yet. */
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/**
 * Fully custom month-grid date picker, replacing the platform's native
 * DateTimePicker everywhere a date is chosen in this app -- Android's native
 * picker is a system dialog that can't be restyled with the app's own
 * colors, so this renders its own grid instead. Same fade+scale center-card
 * chrome as ConfirmDialog.
 */
export function CalendarPickerModal({ visible, value, onSave, onCancel }: CalendarPickerModalProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [mounted, setMounted] = useState(visible);
  const [viewYear, setViewYear] = useState(() => (isValidISODate(value) ? parseISODate(value)!.getFullYear() : new Date().getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (isValidISODate(value) ? parseISODate(value)!.getMonth() + 1 : new Date().getMonth() + 1));
  const [selected, setSelected] = useState(isValidISODate(value) ? value : '');

  useEffect(() => {
    if (visible) {
      const base = isValidISODate(value) ? parseISODate(value)! : new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth() + 1);
      setSelected(isValidISODate(value) ? value : '');
      setMounted(true);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const todayISO = formatISODate(new Date());
  const cells = buildCalendarGrid(viewYear, viewMonth);

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View className="flex-1 justify-center items-center bg-black/40 px-8" style={{ opacity }}>
        <Pressable
          onPress={onCancel}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View className="bg-white rounded-2xl p-5 w-full" style={{ transform: [{ scale }], maxWidth: 360 }}>
          <View className="flex-row items-center justify-between mb-4">
            <PressableScale
              onPress={goPrevMonth}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </PressableScale>
            <Text className="text-base font-semibold">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </Text>
            <PressableScale
              onPress={goNextMonth}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
            >
              <Ionicons name="chevron-forward" size={22} color="#111827" />
            </PressableScale>
          </View>

          <View className="flex-row justify-between mb-2">
            {WEEKDAY_LABELS.map((label, i) => (
              <Text key={i} className="text-xs text-gray-400 font-medium" style={{ width: CELL_SIZE, textAlign: 'center' }}>
                {label}
              </Text>
            ))}
          </View>

          {/* Explicit 6 rows of 7, not a single flex-wrap container -- with
              fixed-width cells, flex-wrap's line breaks depend on the
              container's actual pixel width, which could fit an 8th cell
              per row and silently break the 7-column grid. */}
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <View key={row} className="flex-row justify-between mb-1">
              {cells.slice(row * 7, row * 7 + 7).map((cell) => {
                const iso = `${cell.year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                const isSelected = iso === selected;
                const isToday = iso === todayISO;
                return (
                  <PressableScale
                    key={iso}
                    onPress={() => cell.isCurrentMonth && setSelected(iso)}
                    disabled={!cell.isCurrentMonth}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    className={`items-center justify-center rounded-full ${
                      isSelected ? 'bg-blue-600' : isToday ? 'border border-blue-600' : ''
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.day} de ${MONTH_NAMES[cell.month - 1]}`}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected ? 'text-white font-semibold' : cell.isCurrentMonth ? 'text-gray-900' : 'text-gray-300'
                      }`}
                    >
                      {cell.day}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          ))}

          <View className="flex-row mt-4" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PressableScale
                onPress={onCancel}
                className="py-3 rounded-lg items-center border border-gray-300"
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
              >
                <Text className="font-semibold text-gray-700">Cancelar</Text>
              </PressableScale>
            </View>
            <View style={{ flex: 1 }}>
              <PressableScale
                onPress={() => selected && onSave(selected)}
                disabled={!selected}
                className={`py-3 rounded-lg items-center ${selected ? 'bg-blue-600' : 'bg-blue-200'}`}
                accessibilityRole="button"
                accessibilityLabel="Guardar"
              >
                <Text className="font-semibold text-white">Guardar</Text>
              </PressableScale>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean, no new errors. (No RN component test exists in this repo — `jest.config.js`'s `testMatch` only covers `__tests__/**/*.test.ts`, no component rendering harness is set up. This component is verified by type-checking plus manual verification once wired into `DateField` in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add components/CalendarPickerModal.tsx
git commit -m "feat: fully custom calendar picker modal, app-styled on both platforms"
```

---

## Task 4: Rewire `DateField` to use `CalendarPickerModal`

**Files:**
- Modify: `components/DateField.tsx`

**Interfaces:** `DateField`'s public props (`value: string`, `onChange: (value: string) => void`) are unchanged — `components/MovementFormModal.tsx` (the only consumer) needs zero edits.

- [ ] **Step 1: Replace the file**

Replace the full contents of `components/DateField.tsx` with:

```tsx
import { useState } from 'react';
import { Text } from 'react-native';
import { formatDisplayDate } from '../features/movements/date';
import { PressableScale } from './PressableScale';
import { CalendarPickerModal } from './CalendarPickerModal';

interface DateFieldProps {
  /** Stored value, always 'YYYY-MM-DD'. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Date input that displays DD-MM-AAAA and opens the app's own custom
 * calendar (CalendarPickerModal) on tap -- same modal on both platforms, no
 * Platform.OS branching, since it replaces the native DateTimePicker
 * entirely instead of wrapping it.
 */
export function DateField({ value, onChange }: DateFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <PressableScale
        onPress={() => setVisible(true)}
        className="border border-gray-300 rounded-md px-3 py-3 mb-1"
        accessibilityRole="button"
        accessibilityLabel="Seleccionar fecha"
      >
        <Text className={value ? 'text-black' : 'text-gray-400'}>{value ? formatDisplayDate(value) : 'Selecciona la fecha'}</Text>
      </PressableScale>

      <CalendarPickerModal
        visible={visible}
        value={value}
        onSave={(v) => {
          onChange(v);
          setVisible(false);
        }}
        onCancel={() => setVisible(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. Confirm `components/MovementFormModal.tsx` (which renders `<DateField value={value} onChange={onChange} />` inside a `Controller`) shows no new errors — its usage doesn't change.

- [ ] **Step 3: Commit**

```bash
git add components/DateField.tsx
git commit -m "feat: DateField uses the custom CalendarPickerModal on both platforms"
```

---

## Task 5: `MonthYearPickerModal` component

**Files:**
- Create: `components/MonthYearPickerModal.tsx`

**Interfaces:**
- Produces: `interface MonthYearPickerModalProps { visible: boolean; year: number; month: number; onSelect: (year: number, month: number) => void; onClose: () => void }`. Consumed by Task 6 (`MonthSelector`).

- [ ] **Step 1: Create the component**

Create `components/MonthYearPickerModal.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { MONTH_NAMES } from '../features/shared/monthNames';

const MONTH_ABBR = MONTH_NAMES.map((name) => name.slice(0, 3));

interface MonthYearPickerModalProps {
  visible: boolean;
  year: number;
  month: number; // 1-12
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}

/**
 * Two-tap month/year picker (pick the year with the arrows, then tap a
 * month) -- opened from MonthSelector so jumping to any month of any year
 * doesn't require stepping through every month in between with the
 * prev/next arrows. Same fade+scale center-card chrome as ConfirmDialog.
 */
export function MonthYearPickerModal({ visible, year, month, onSelect, onClose }: MonthYearPickerModalProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [mounted, setMounted] = useState(visible);
  const [viewYear, setViewYear] = useState(year);

  useEffect(() => {
    if (visible) {
      setViewYear(year);
      setMounted(true);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, year]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View className="flex-1 justify-center items-center bg-black/40 px-8" style={{ opacity }}>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View className="bg-white rounded-2xl p-5 w-full" style={{ transform: [{ scale }], maxWidth: 340 }}>
          <View className="flex-row items-center justify-between mb-4">
            <PressableScale
              onPress={() => setViewYear(viewYear - 1)}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Año anterior"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </PressableScale>
            <Text className="text-base font-semibold">{viewYear}</Text>
            <PressableScale
              onPress={() => setViewYear(viewYear + 1)}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Año siguiente"
            >
              <Ionicons name="chevron-forward" size={22} color="#111827" />
            </PressableScale>
          </View>

          {[0, 1, 2, 3].map((row) => (
            <View key={row} className="flex-row justify-between mb-2">
              {MONTH_ABBR.slice(row * 3, row * 3 + 3).map((label, col) => {
                const m = row * 3 + col + 1;
                const isActive = viewYear === year && m === month;
                return (
                  <PressableScale
                    key={m}
                    onPress={() => onSelect(viewYear, m)}
                    style={{ width: 92, height: 44 }}
                    className={`items-center justify-center rounded-lg ${isActive ? 'bg-blue-600' : 'bg-gray-50'}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${MONTH_NAMES[m - 1]} ${viewYear}`}
                  >
                    <Text className={`font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/MonthYearPickerModal.tsx
git commit -m "feat: two-tap month/year picker modal"
```

---

## Task 6: Wire `MonthYearPickerModal` into `MonthSelector`

**Files:**
- Modify: `components/MonthSelector.tsx`

**Interfaces:** `MonthSelector`'s public props (`year`, `month`, `onChange`) are unchanged — both consumers (`app/(app)/movimientos.tsx`, `app/(app)/index.tsx`) need zero edits.

- [ ] **Step 1: Replace the file**

Replace the full contents of `components/MonthSelector.tsx` with:

```tsx
import { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { MonthYearPickerModal } from './MonthYearPickerModal';
import { MONTH_NAMES } from '../features/shared/monthNames';

interface MonthSelectorProps {
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
}

export function MonthSelector({ year, month, onChange }: MonthSelectorProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const goPrev = () => (month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1));
  const goNext = () => (month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1));

  return (
    <View className="flex-row items-center justify-center py-2">
      <PressableScale
        onPress={goPrev}
        style={{ minWidth: 48, minHeight: 48 }}
        className="items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
      >
        <Ionicons name="chevron-back" size={28} color="#111827" />
      </PressableScale>

      <PressableScale
        onPress={() => setPickerVisible(true)}
        className="flex-row items-center px-2 py-1 rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Elegir mes y año"
      >
        <Text className="text-base font-semibold mr-1">
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6b7280" />
      </PressableScale>

      <PressableScale
        onPress={goNext}
        style={{ minWidth: 48, minHeight: 48 }}
        className="items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
      >
        <Ionicons name="chevron-forward" size={28} color="#111827" />
      </PressableScale>

      <MonthYearPickerModal
        visible={pickerVisible}
        year={year}
        month={month}
        onSelect={(y, m) => {
          onChange(y, m);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. Confirm `app/(app)/movimientos.tsx` and `app/(app)/index.tsx` (both render `<MonthSelector year={year} month={month} onChange={setMonth} />`) show no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/MonthSelector.tsx
git commit -m "feat: MonthSelector's month/year label opens the two-tap quick picker"
```

---

## Task 7: `BackButton` component + Stack transition animation

**Files:**
- Create: `components/BackButton.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: `interface BackButtonProps { onPress: () => void }`, `export function BackButton({ onPress }: BackButtonProps)`. Consumed by Task 8 (`verify-otp.tsx`, `onboarding.tsx`).

- [ ] **Step 1: Create `BackButton`**

Create `components/BackButton.tsx`:

```tsx
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';

interface BackButtonProps {
  onPress: () => void;
}

/**
 * Fixed-position back arrow for the top-left corner of a full-screen
 * auth/onboarding step. Uses a fixed pixel offset rather than
 * react-native-safe-area-context (installed but has no SafeAreaProvider
 * mounted anywhere in this app) -- same fixed-offset convention
 * app/onboarding.tsx already uses via its own `pt-16` content padding.
 */
export function BackButton({ onPress }: BackButtonProps) {
  return (
    <View style={{ position: 'absolute', top: 50, left: 12, zIndex: 10 }}>
      <PressableScale
        onPress={onPress}
        style={{ width: 40, height: 40 }}
        className="items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </PressableScale>
    </View>
  );
}
```

- [ ] **Step 2: Add the Stack transition animation**

In `app/_layout.tsx`, change:

```tsx
    <Stack screenOptions={{ headerShown: false }}>
```

to:

```tsx
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/BackButton.tsx app/_layout.tsx
git commit -m "feat: BackButton component, explicit slide_from_right stack transition"
```

---

## Task 8: Wire `BackButton` into verify-otp and onboarding's second step

**Files:**
- Modify: `app/verify-otp.tsx`
- Modify: `app/onboarding.tsx`

**Interfaces:** Consumes `BackButton` (Task 7).

- [ ] **Step 1: `verify-otp.tsx` — back to register**

In `app/verify-otp.tsx`:

1. Change the import line `import { useLocalSearchParams } from 'expo-router';` to `import { useLocalSearchParams, useRouter } from 'expo-router';`.
2. Add the import: `import { BackButton } from '../components/BackButton';`.
3. Inside `VerifyOtpScreen`, right after `const { email } = useLocalSearchParams<{ email: string }>();`, add: `const router = useRouter();`.
4. In the JSX, the component currently returns a single `<KeyboardAvoidingView>` as the outermost element. Add `<BackButton onPress={() => router.back()} />` as the FIRST child inside that `<KeyboardAvoidingView>`, immediately before the `<ScrollView>`:

```tsx
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackButton onPress={() => router.back()} />
      <ScrollView
        ...
```

(The rest of the file is unchanged.)

- [ ] **Step 2: `onboarding.tsx` — back from Ingreso Mensual to Nombre/Celular**

In `app/onboarding.tsx`:

1. Add the import: `import { BackButton } from '../components/BackButton';`.
2. The `'ingreso'` step is the second `return` statement (after the `if (step === 'perfil') { return (...) }` block) — it currently starts with a bare `<ScrollView className="flex-1 bg-white" contentContainerClassName="p-6 pt-16">`. Wrap it in a `<View style={{ flex: 1 }}>` that also hosts the `BackButton`, changing:

```tsx
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-6 pt-16">
      <Text className="text-2xl font-bold mb-2">¿Cuál es tu ingreso mensual?</Text>
```

to:

```tsx
  return (
    <View style={{ flex: 1 }} className="bg-white">
      <BackButton onPress={() => setStep('perfil')} />
      <ScrollView contentContainerClassName="p-6 pt-16">
        <Text className="text-2xl font-bold mb-2">¿Cuál es tu ingreso mensual?</Text>
```

...and correspondingly close the new outer `<View>` at the end of that same `return` block: find the final `</ScrollView>\n    </>\n  );\n}` (or however the file's actual closing tags read for this second return) and change the ScrollView's own closing tag plus add the `</View>` — concretely, the end of this step currently reads:

```tsx
      <Button title="Ahora no" variant="ghost" onPress={finish} disabled={upsertProfile.isPending} />
    </ScrollView>
  );
}
```

change it to:

```tsx
        <Button title="Ahora no" variant="ghost" onPress={finish} disabled={upsertProfile.isPending} />
      </ScrollView>
    </View>
  );
}
```

(Re-indent the lines between the two `ScrollView` tags by one extra level to reflect the new wrapping `View` — this is a pure formatting change, not a logic change; double check with `npx tsc --noEmit` and a full read-through that every JSX tag still closes correctly.)

3. The `'perfil'` step (the first `return`, `if (step === 'perfil')`) is NOT touched — no `BackButton` there, per the confirmed design decision (going back to `verify-otp.tsx` isn't structurally reachable once a session exists).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean, no new errors, no unclosed-JSX-tag errors.

- [ ] **Step 4: Commit**

```bash
git add app/verify-otp.tsx app/onboarding.tsx
git commit -m "feat: back navigation for verify-otp and onboarding's second step"
```

---

## Task 9: Replace "Cargando..." with `ScreenSkeleton`

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:** Consumes `ScreenSkeleton` (existing, `components/Skeleton.tsx`).

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, add: `import { ScreenSkeleton } from '../components/Skeleton';`

- [ ] **Step 2: Replace the loading block**

Change:

```tsx
  if (loading || (!!session && profileLoading)) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }
```

to:

```tsx
  if (loading || (!!session && profileLoading)) {
    return (
      <View className="flex-1 bg-white">
        <ScreenSkeleton />
      </View>
    );
  }
```

(`View` and `Text` are both still imported and used elsewhere in this file/component — do not remove the `import { View, Text } from 'react-native';` line; only drop `Text` from that import if a check shows it has no other remaining usage in the file. Read the whole file after this change to confirm.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean, no unused-import errors.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: replace root loading gate's Cargando... text with ScreenSkeleton"
```

---

## Task 10: Final verification

**Files:** None (verification only).

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: every suite passes, including the new `calendarGrid.test.ts` and every pre-existing test file untouched by this plan.

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Report to the user in Spanish**, per `AGENTS.md`'s closing protocol — summarize every change (button-layout fix, custom calendar, month/year quick-picker, onboarding back-navigation/transitions/skeleton), what to test manually in the running app for each (open a movement form and tap the date field to see the new calendar; tap "Agosto 2026" in Movimientos/Resumen to see the quick month/year picker; go through Registro → Código → Onboarding to see the back arrows and slide transition; force the root loading gate by reloading the app to see the skeleton instead of "Cargando..."), and confirm no Expo restart is needed (pure UI/logic changes, Fast Refresh reloads them) — reiterate that the dev server must stay pointed at this worktree's folder.
