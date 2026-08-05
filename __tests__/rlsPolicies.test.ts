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
