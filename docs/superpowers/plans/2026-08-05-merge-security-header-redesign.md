# Partial merge to master, realistic security hardening, blue header redesign, Seguridad consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Task 1 is a git merge to `master` and must be executed directly by the controller session, never dispatched to a subagent** — every other task runs in the worktree as usual.

**Goal:** Merge the 38 already-reviewed commits from this worktree into `master` (leaving the worktree's other 59 uncommitted files untouched for a future separate review), hardened the app's real (not theoretical) security gaps, give the 4 main tab screens a blue header with white text, and consolidate Cuenta's Seguridad section into one "Guardar cambios" button.

**Architecture:** Task 1 operates on the root checkout (`C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app`, branch `master`) and the worktree's branch (`worktree-movimientos-cuenta-tabbar-revamp`) as merge source. Tasks 2-8 operate on the worktree exactly as every prior task this session has. Task 9 verifies both.

**Tech Stack:** Expo/React Native (v57), TypeScript, NativeWind, `@tanstack/react-query`, Supabase (`@supabase/supabase-js`), Jest + ts-jest.

## Global Constraints

- Task 1 merges ONLY the 38 commits already on `worktree-movimientos-cuenta-tabbar-revamp` as of this plan's start — it must NOT commit or merge any of the worktree's remaining uncommitted files. Confirm this by checking `git status --short` in the worktree returns the same ~59-file list both before and after Task 1 (nothing should get swept in).
- Every "primary/active" blue introduced anywhere in this plan is `#2563eb` (Tailwind `blue-600`), matching the color already used everywhere else in this app.
- `PressableScale` gotcha (see prior plans' Global Constraints, still applies): never put `flex-1` directly in a `PressableScale`'s own `className` inside a `flex-row` parent — it must go on a wrapping plain `View` instead. This plan's Task 8 combines two previously-independent button blocks into one row-adjacent layout and must follow this pattern if any new flex-row button pairing is introduced.
- No live-database security tests are added (Jest runs in Node with no Supabase connection in this repo) — the "security test suite" in Tasks 4-6 is static/logic-level (source-scanning migrations and API files, testing pure functions), not integration testing against a real database.
- XSS-style HTML sanitization is explicitly OUT of scope — React Native's `Text`/`TextInput` don't render HTML, so there's no injection surface for it. Do not add a library or write code implying otherwise.

---

## Task 1: Merge to master (controller-executed, not a subagent task)

**This task has no subagent dispatch.** Execute these steps directly.

- [ ] **Step 1: Confirm master's working tree is clean**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app"
git status --short
```

Expected: only `$log` (a pre-existing Expo session log file, not code) or nothing else untracked/modified. If anything else appears, STOP and report it before proceeding — do not merge over unexpected local state.

- [ ] **Step 2: Record the worktree's uncommitted file list (for the before/after check required by Global Constraints)**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp"
git status --short > /tmp/before-merge-status.txt
wc -l /tmp/before-merge-status.txt
```

- [ ] **Step 3: Merge**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app"
git checkout master
git merge --no-ff worktree-movimientos-cuenta-tabbar-revamp -m "merge: movimientos row cleanup, date grouping, cuotas override, Agosto audit, UI polish (calendar/month-year picker/onboarding)"
```

- [ ] **Step 4: Confirm the worktree's uncommitted files are unaffected**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app\.claude\worktrees\movimientos-cuenta-tabbar-revamp"
git status --short > /tmp/after-merge-status.txt
diff /tmp/before-merge-status.txt /tmp/after-merge-status.txt
```

Expected: no diff (identical file lists) — the merge must not have touched the worktree's own working directory at all (merges into `master` from the root checkout don't touch a separate worktree's files, but this step verifies that assumption held).

- [ ] **Step 5: Verify master builds and tests pass post-merge**

```bash
cd "C:\Users\Bartolo\Documents\Proyectos-Dev\presupuesto-app"
npx jest
npx tsc --noEmit
```

Expected: both clean (same pass counts as the worktree had at the end of the prior plan — 98 tests). If either fails, do NOT force-fix by reverting the merge without investigating first — a clean merge of two independently-tested branches failing here would itself be a real finding to report.

- [ ] **Step 6: Report the merge commit hash and test/tsc results before continuing to Task 2.**

---

## Task 2: `sanitizeText` pure function + tests

**Files:**
- Create: `features/shared/sanitize.ts`
- Test: `__tests__/sanitizeText.test.ts`

**Interfaces:**
- Produces: `export function sanitizeText(value: string, maxLength: number): string` and `export function sanitizeNullableText(value: string | null, maxLength: number): string | null`. Consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/sanitizeText.test.ts`:

```ts
import { sanitizeText, sanitizeNullableText } from '../features/shared/sanitize';

describe('sanitizeText', () => {
  it('trims leading/trailing whitespace', () => {
    expect(sanitizeText('  Luz  ', 50)).toBe('Luz');
  });

  it('truncates to maxLength after trimming', () => {
    expect(sanitizeText('a'.repeat(60), 50)).toBe('a'.repeat(50));
  });

  it('strips non-printable control characters but keeps normal punctuation and accents', () => {
    expect(sanitizeText('Zapatillas\u0000\u0007 (cuota)', 50)).toBe('Zapatillas (cuota)');
    expect(sanitizeText('Café con leche — ¡rico!', 50)).toBe('Café con leche — ¡rico!');
  });

  it('collapses to an empty string when the input is only whitespace/control characters', () => {
    expect(sanitizeText('   \u0000\u0001  ', 50)).toBe('');
  });

  it('does not mutate a string that is already clean and under the limit', () => {
    expect(sanitizeText('Gastos Extras', 50)).toBe('Gastos Extras');
  });
});

describe('sanitizeNullableText', () => {
  it('returns null unchanged', () => {
    expect(sanitizeNullableText(null, 50)).toBeNull();
  });

  it('sanitizes a non-null value the same way as sanitizeText', () => {
    expect(sanitizeNullableText('  nota  ', 50)).toBe('nota');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/sanitizeText.test.ts`
Expected: FAIL — `Cannot find module '../features/shared/sanitize'`

- [ ] **Step 3: Implement `sanitizeText`/`sanitizeNullableText`**

Create `features/shared/sanitize.ts`:

```ts
// Matches C0 control characters (0x00-0x1F) except \t/\n/\r, plus DEL
// (0x7F) -- these have no legitimate place in a category name, movement
// concepto/notas, or profile nombre, and stripping them defends against
// malformed payloads reaching the database or a future export (CSV, email)
// where a raw control character could do something unexpected.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Normalizes free-text input before it reaches the database: trims
 * surrounding whitespace, strips non-printable control characters, and
 * truncates to `maxLength`. Does NOT do HTML/script sanitization -- React
 * Native's Text/TextInput never render raw HTML, so there is no injection
 * surface for that here.
 */
export function sanitizeText(value: string, maxLength: number): string {
  return value.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

/** Same as sanitizeText, but passes `null` through unchanged (for optional fields like `notas`). */
export function sanitizeNullableText(value: string | null, maxLength: number): string | null {
  return value === null ? null : sanitizeText(value, maxLength);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/sanitizeText.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add features/shared/sanitize.ts __tests__/sanitizeText.test.ts
git commit -m "feat: sanitizeText/sanitizeNullableText helpers for free-text inputs"
```

---

## Task 3: Apply `sanitizeText` at the API layer

**Files:**
- Modify: `features/categories/api.ts`
- Modify: `features/movements/api.ts`
- Modify: `features/profile/api.ts`

**Interfaces:** Consumes `sanitizeText`/`sanitizeNullableText` (Task 2). No public function signatures change — sanitization happens inside the existing `createCategory`/`updateCategory`/`createMovement`/`updateMovement`/`upsertProfile` bodies, transparent to every caller.

- [ ] **Step 1: `features/categories/api.ts`**

Add the import: `import { sanitizeText } from '../shared/sanitize';`

In `createCategory`, change:
```ts
  await assertNameNotTaken(input.nombre);

  const { data, error } = await supabase
    .from('categories')
    .insert({ nombre: input.nombre, es_fija: input.esFija, user_id: userId })
```
to:
```ts
  const nombre = sanitizeText(input.nombre, 60);
  await assertNameNotTaken(nombre);

  const { data, error } = await supabase
    .from('categories')
    .insert({ nombre, es_fija: input.esFija, user_id: userId })
```

In `updateCategory`, change:
```ts
export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  await assertNameNotTaken(input.nombre, input.id);

  const { data, error } = await supabase
    .from('categories')
    .update({ nombre: input.nombre, es_fija: input.esFija })
```
to:
```ts
export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  const nombre = sanitizeText(input.nombre, 60);
  await assertNameNotTaken(nombre, input.id);

  const { data, error } = await supabase
    .from('categories')
    .update({ nombre, es_fija: input.esFija })
```

(60 characters is a generous cap for a category name — every existing seeded category name is well under 20 characters.)

- [ ] **Step 2: `features/movements/api.ts`**

Add the import: `import { sanitizeText, sanitizeNullableText } from '../shared/sanitize';`

In `createMovement`, change:
```ts
      concepto: input.concepto,
      monto: input.monto,
      notas: input.notas,
```
(inside the `.insert({...})` call) to:
```ts
      concepto: sanitizeText(input.concepto, 120),
      monto: input.monto,
      notas: sanitizeNullableText(input.notas, 500),
```

In `updateMovement`, change:
```ts
      concepto: input.concepto,
      monto: input.monto,
      notas: input.notas,
```
(inside the `.update({...})` call) to the same:
```ts
      concepto: sanitizeText(input.concepto, 120),
      monto: input.monto,
      notas: sanitizeNullableText(input.notas, 500),
```

(120 chars for `concepto` comfortably fits real examples seen this session like "Zapatillas (cuota 5/6)"; 500 for `notas`, a free-text field, comfortably fits the longest real note seeded this session — "5 bebidas lata + 2 rolls + 2 twistos jamón + 2 kryspos + dulce + tictac + maní", ~78 chars.)

- [ ] **Step 3: `features/profile/api.ts`**

Add the import: `import { sanitizeText, sanitizeNullableText } from '../shared/sanitize';`

In `upsertProfile`, change:
```ts
  const merged = {
    id: userId,
    nombre: input.nombre !== undefined ? input.nombre : (existing?.nombre ?? null),
    telefono: input.telefono !== undefined ? input.telefono : (existing?.telefono ?? null),
```
to:
```ts
  const merged = {
    id: userId,
    nombre: input.nombre !== undefined ? sanitizeNullableText(input.nombre, 80) : (existing?.nombre ?? null),
    telefono: input.telefono !== undefined ? input.telefono : (existing?.telefono ?? null),
```

(`telefono` is intentionally NOT sanitized here — it already goes through `formatPhoneNumber`/`isValidPhoneNumber` in `features/shared/countries.ts` before reaching this call, a stricter format-specific validation than a generic text sanitizer would add.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. Confirm `UpsertProfileInput['nombre']`'s type is `string | null | undefined` (check `features/profile/types.ts`) so `sanitizeNullableText`'s `string | null` return type fits — if the type is narrower (e.g. `string | undefined` with no `null`), adjust to call `sanitizeText` instead and report this discrepancy in your task report rather than silently changing the type.

- [ ] **Step 5: Run the full test suite to confirm nothing that depends on exact stored text broke**

Run: `npx jest`
Expected: all suites still pass — no existing test asserts on a `concepto`/`nombre`/`notas` value that would be altered by trimming/truncation (every seeded/test value already lacks leading/trailing whitespace and is well under the new length caps).

- [ ] **Step 6: Commit**

```bash
git add features/categories/api.ts features/movements/api.ts features/profile/api.ts
git commit -m "feat: sanitize free-text fields (category nombre, movement concepto/notas, profile nombre) before they reach Supabase"
```

---

## Task 4: `__DEV__`-gated Supabase error logging + test

**Files:**
- Modify: `lib/supabase.ts`
- Test: `__tests__/secureLogging.test.ts`

**Interfaces:** `logSupabaseError(context: string, error: unknown): void` signature unchanged — every existing caller (every `api.ts` file) needs no edits.

- [ ] **Step 1: Write the failing test**

Create `__tests__/secureLogging.test.ts`:

```ts
import { logSupabaseError } from '../lib/supabase';

describe('logSupabaseError', () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('logs to console.error when __DEV__ is true', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    logSupabaseError('testContext', new Error('boom'));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('testContext');
  });

  it('does not log to console.error when __DEV__ is false (production build)', () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    logSupabaseError('testContext', new Error('boom'));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/secureLogging.test.ts`
Expected: the second test (`__DEV__` false) FAILS — today `logSupabaseError` always calls `console.error` regardless. (The first test, `__DEV__` true, may already pass if `__DEV__` defaults truthy in the Jest/Node environment — that's fine, both must pass after Step 3 either way.)

- [ ] **Step 3: Gate the implementation**

In `lib/supabase.ts`, change:
```ts
export function logSupabaseError(context: string, error: unknown) {
  console.error(`[supabase] ${context}`, error);
}
```
to:
```ts
export function logSupabaseError(context: string, error: unknown) {
  if (__DEV__) {
    console.error(`[supabase] ${context}`, error);
  }
}
```

(`__DEV__` is a React Native global, always available at runtime with no import needed — true in development, false in a release/production build. In the Jest/Node test environment it's not defined by default, which is exactly why the test above sets it explicitly via `global.__DEV__` in each case rather than relying on an ambient default.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/secureLogging.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. If TypeScript complains that `__DEV__` is not declared, check whether `@types/react-native` (a transitive dependency of `expo`/`react-native`, already installed) already ambient-declares it globally -- it does in every standard Expo/RN project, so this should need no new type declaration. If it somehow doesn't resolve, report this as a concern rather than adding an `any`-typed workaround.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase.ts __tests__/secureLogging.test.ts
git commit -m "fix: gate Supabase error logging behind __DEV__ so raw errors don't reach production console"
```

---

## Task 5: Static RLS policy test

**Files:**
- Test: `__tests__/rlsPolicies.test.ts`

**Interfaces:** None (reads `.sql` files directly as text, no code under test).

- [ ] **Step 1: Write the test**

Create `__tests__/rlsPolicies.test.ts`:

```ts
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

function readAllMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n');
}

// Every table that stores per-user data must both enable RLS and scope its
// policy to the owning user -- `ownerColumn` is `user_id` for tables with a
// separate id/user_id pair, `id` for `profiles` (whose primary key IS the
// user's auth id).
const USER_DATA_TABLES: { table: string; ownerColumn: string }[] = [
  { table: 'categories', ownerColumn: 'user_id' },
  { table: 'movements', ownerColumn: 'user_id' },
  { table: 'profiles', ownerColumn: 'id' },
  { table: 'recurring_income', ownerColumn: 'user_id' },
];

describe('Row Level Security policies (static check across all migrations)', () => {
  const sql = readAllMigrations();

  it.each(USER_DATA_TABLES)('$table has RLS enabled', ({ table }) => {
    const pattern = new RegExp(`alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security`, 'i');
    expect(sql).toMatch(pattern);
  });

  it.each(USER_DATA_TABLES)('$table has an owner-scoped policy (using + with check on auth.uid() = $ownerColumn)', ({ table, ownerColumn }) => {
    // Find this table's `create policy ... on <table> ... using (...) ... with check (...)` block
    // and confirm both clauses reference `auth.uid() = <ownerColumn>`. Matches loosely across
    // whitespace/newlines since the migrations format this multi-line.
    const policyBlockPattern = new RegExp(
      `create\\s+policy\\s+"[^"]+"\\s+on\\s+${table}[\\s\\S]*?using\\s*\\(\\s*auth\\.uid\\(\\)\\s*=\\s*${ownerColumn}\\s*\\)[\\s\\S]*?with\\s+check\\s*\\(\\s*auth\\.uid\\(\\)\\s*=\\s*${ownerColumn}\\s*\\)`,
      'i'
    );
    expect(sql).toMatch(policyBlockPattern);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest __tests__/rlsPolicies.test.ts`
Expected: PASS (8 tests: 4 tables × 2 checks each) — this exercises the CURRENT migrations, which already have correct RLS (verified by direct reading during this plan's design phase), so no production code changes are needed for this task; it's a pure regression-guard addition.

- [ ] **Step 3: Commit**

```bash
git add __tests__/rlsPolicies.test.ts
git commit -m "test: static regression guard that every user-data table keeps RLS enabled with an owner-scoped policy"
```

---

## Task 6: Static no-raw-SQL test

**Files:**
- Test: `__tests__/noRawSql.test.ts`

**Interfaces:** None (source-scans `.ts` files as text).

- [ ] **Step 1: Write the test**

Create `__tests__/noRawSql.test.ts`:

```ts
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Recursively collects every .ts file under `dir` (skips .test.ts and .d.ts). */
function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('No raw SQL / RPC calls in the app source (SQL-injection surface stays at zero)', () => {
  const targetDirs = [join(__dirname, '..', 'features'), join(__dirname, '..', 'lib')];
  const files = targetDirs.flatMap(collectTsFiles);

  it('scans at least the known API files (sanity check the scan itself works)', () => {
    expect(files.some((f) => f.endsWith('categories/api.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('movements/api.ts'))).toBe(true);
  });

  it.each(files.map((f) => [f] as const))('%s does not call supabase.rpc(...)', (file) => {
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(/\.rpc\s*\(/);
  });

  it.each(files.map((f) => [f] as const))('%s does not build a .from(...) table name via string concatenation', (file) => {
    const content = readFileSync(file, 'utf8');
    // Flags `.from(` followed by anything other than an immediate single- or
    // double-quoted literal -- e.g. `.from(userInput)` or `.from('x' + y)`
    // would match and fail; `.from('movements')` does not.
    const suspicious = /\.from\(\s*(?!['"][^'"]*['"]\s*\))/;
    expect(content).not.toMatch(suspicious);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest __tests__/noRawSql.test.ts`
Expected: PASS on every file — this codebase already has zero `.rpc()` calls and every `.from(...)` call uses a literal table name (verified during this plan's design phase). If any test fails, do NOT weaken the test to make it pass — read the flagged file and report what real `.rpc()`/dynamic-table-name usage exists; that would be a genuine finding, not a test bug.

- [ ] **Step 3: Commit**

```bash
git add __tests__/noRawSql.test.ts
git commit -m "test: static regression guard against raw SQL/RPC calls or dynamic table names in the app source"
```

---

## Task 7: Blue header with white text across the 4 main tabs

**Files:**
- Modify: `app/(app)/_layout.tsx`
- Modify: `app/(app)/categorias.tsx`

**Interfaces:** No prop/signature changes — this is `screenOptions` configuration plus one header button's styling.

- [ ] **Step 1: Add header styling to the shared `Tabs`**

In `app/(app)/_layout.tsx`, find:
```tsx
        <Tabs
          tabBar={(props) => <AnimatedTabBar {...props} />}
          screenOptions={{
            headerShown: true,
          }}
        >
```
Change to:
```tsx
        <Tabs
          tabBar={(props) => <AnimatedTabBar {...props} />}
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#2563eb' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { color: '#ffffff', fontWeight: '600' },
          }}
        >
```

This alone covers Resumen, Movimientos, Categorías, and Cuenta — none of the 4 screens override `headerStyle`/`headerTitleStyle` individually (verified: only `categorias.tsx` calls `navigation.setOptions`, and only for `headerRight`).

- [ ] **Step 2: Restyle Categorías' "+ Nueva categoría" header button for contrast on the new blue background**

In `app/(app)/categorias.tsx`, find the `headerRight` block (around line 59-63):
```tsx
      headerRight: () => (
        <PressableScale onPress={openCreate} className="px-4 py-2" accessibilityRole="button" accessibilityLabel="Nueva categoría">
          <Text className="text-blue-600 font-medium">+ Nueva categoría</Text>
        </PressableScale>
      ),
```
Change to:
```tsx
      headerRight: () => (
        <PressableScale
          onPress={openCreate}
          className="mr-3 px-3 py-1.5 rounded-full border border-white/70"
          accessibilityRole="button"
          accessibilityLabel="Nueva categoría"
        >
          <Text className="text-white font-medium text-sm">+ Nueva categoría</Text>
        </PressableScale>
      ),
```

(`text-blue-600` would be invisible against the new `#2563eb` header background — this switches to white text with a subtle white/70%-opacity border so the button reads as a distinct tappable pill instead of blending into the header. `PressableScale` already provides the standard press-scale animation used everywhere else in the app; no new animation code needed.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification note (no automated RN screenshot test in this repo)**

Not run automatically — covered in the closing report to the user (Task 9).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/_layout.tsx" "app/(app)/categorias.tsx"
git commit -m "feat: blue header with white title text across Resumen/Movimientos/Categorías/Cuenta"
```

---

## Task 8: Consolidate Cuenta's Seguridad section into one "Guardar cambios" button

**Files:**
- Modify: `app/(app)/cuenta.tsx`

**Interfaces:** No exported/public interface changes — this is entirely internal to the `CuentaScreen` component (`changeEmail`/`changePassword` and their per-field state are replaced by one combined handler and shared state).

- [ ] **Step 1: Replace the separate email/password state and handlers**

In `app/(app)/cuenta.tsx`, find this block (around lines 136-178):
```tsx
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
      setEmailError(translateAuthError(err));
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
      setPasswordError(translateAuthError(err));
    } finally {
      setPasswordPending(false);
    }
  };
```

Replace it with:

```tsx
  const [newPassword, setNewPassword] = useState('');
  const [securityPending, setSecurityPending] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  const guardarCambiosSeguridad = async () => {
    const emailTrimmed = newEmail.trim();
    const wantsEmailChange = emailTrimmed.length > 0;
    const wantsPasswordChange = newPassword.length > 0;
    if (!wantsEmailChange && !wantsPasswordChange) return;

    if (wantsPasswordChange && newPassword.length < 6) {
      setSecurityError('La contraseña debe tener al menos 6 caracteres');
      setSecurityMessage(null);
      return;
    }

    setSecurityError(null);
    setSecurityMessage(null);
    setSecurityPending(true);
    try {
      const results = await Promise.allSettled([
        wantsEmailChange ? updateEmail(emailTrimmed) : Promise.resolve(undefined),
        wantsPasswordChange ? updatePassword(newPassword) : Promise.resolve(undefined),
      ]);
      const [emailResult, passwordResult] = results;

      const messages: string[] = [];
      const errors: string[] = [];

      if (wantsEmailChange) {
        if (emailResult.status === 'fulfilled') {
          messages.push('Revisa tu correo para confirmar el cambio.');
          setNewEmail('');
        } else {
          errors.push(translateAuthError(emailResult.reason));
        }
      }
      if (wantsPasswordChange) {
        if (passwordResult.status === 'fulfilled') {
          messages.push('Contraseña actualizada.');
          setNewPassword('');
        } else {
          errors.push(translateAuthError(passwordResult.reason));
        }
      }

      if (messages.length > 0) setSecurityMessage(messages.join(' '));
      if (errors.length > 0) setSecurityError(errors.join(' '));
    } finally {
      setSecurityPending(false);
    }
  };
```

(`Promise.allSettled` so a failure in one operation doesn't cancel/skip the other — each field only clears itself on its OWN success, so a failed email change leaves the typed email in place for the user to retry, even if the password change in the same submit succeeded.)

- [ ] **Step 2: Replace the Seguridad modal's JSX**

Find the `FullScreenFormModal` block for `openSection === 'seguridad'` (around lines 275-308):

```tsx
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
```

Replace it with:

```tsx
      <FullScreenFormModal visible={openSection === 'seguridad'} title="Seguridad" onClose={() => setOpenSection(null)}>
        <Text className="text-base font-semibold mb-2">Correo electrónico</Text>
        <Text className="text-gray-500 mb-2">Actual: {session?.user.email}</Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-4"
          placeholder="Nuevo correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={newEmail}
          onChangeText={setNewEmail}
        />

        <Text className="text-base font-semibold mb-2">Contraseña</Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-4"
          placeholder="Nueva contraseña"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />

        {securityError && (
          <ErrorBanner message={securityError} onRetry={() => setSecurityError(null)} actionLabel="Descartar" />
        )}
        {securityMessage && <Text className="text-green-600 mb-3">{securityMessage}</Text>}

        <Button
          title="Guardar cambios"
          onPress={guardarCambiosSeguridad}
          loading={securityPending}
          disabled={securityPending || (!newEmail.trim() && !newPassword)}
        />
      </FullScreenFormModal>
```

(Both fields now use the same `mb-4` bottom margin for consistent, proportional spacing instead of the old asymmetric `mb-2`/`mt-6` mix; the section-label-then-field pattern stays the same as every other form in this app; one shared error/success area sits right above the single submit button.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean — confirm no leftover reference to `emailPending`/`emailError`/`emailMessage`/`passwordPending`/`passwordError`/`passwordMessage`/`changeEmail`/`changePassword` anywhere else in the file (there shouldn't be any; those names were only used in the block replaced above).

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all suites still pass (no test in this repo exercises `cuenta.tsx` directly — no RN component test harness — this is a sanity check that nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/cuenta.tsx"
git commit -m "feat: consolidate Cuenta's Seguridad section into one Guardar cambios button"
```

---

## Task 9: Final verification (worktree)

**Files:** None (verification only). Task 1 already verified `master` separately.

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: every suite passes, including the 4 new security tests from Tasks 2/4/5/6.

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Report to the user in Spanish**, per `AGENTS.md`'s closing protocol — summarize every change (merge to master, sanitización de inputs, logging condicionado a `__DEV__`, tests estáticos de RLS/no-SQL-crudo, header azul, consolidación de Seguridad), what to test manually in the running app for each (crear/editar una categoría o movimiento con texto normal para confirmar que nada se rompió; abrir Cuenta → Seguridad y guardar solo correo, solo contraseña, o ambos; revisar visualmente el header azul con texto blanco en las 4 pestañas y el botón "+ Nueva categoría" en Categorías), and confirm no Expo restart is needed (pure UI/logic/test changes, Fast Refresh reloads them) — reiterate that the dev server must stay pointed at this worktree's folder, and that `master` now has its own separately-verified state after Task 1's merge.
