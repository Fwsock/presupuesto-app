-- Tracks (series, month) pairs a user explicitly deleted, so
-- ensureRecurringIncomeForMonth / ensureFixedCategoryMovementsForMonth
-- (features/income/api.ts, features/movements/fixedCategories.ts) never
-- regenerate that instance on a later pull-to-refresh or app restart.
--
-- Without this table, a hard delete loses all memory of "this month was
-- already handled": both ensure-functions' own existence check just sees
-- "no row for this series in this month" and recreates one from the latest
-- prior instance -- the "regeneración fantasma" bug. One shared table for
-- both replication engines (instead of two near-identical ones) via a
-- prefixed series_key: 'income:<recurring_income_id>' or
-- 'fixed:<fixed_series_id>' -- see features/movements/recurringSkips.ts.
create table recurring_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_key text not null,
  fecha date not null, -- first day of the skipped month
  created_at timestamptz not null default now(),
  unique (series_key, fecha)
);

alter table recurring_skips enable row level security;

-- Single "for all" policy, same shape as every other owner-scoped table in
-- this project (categories/movements/profiles/recurring_income/feedback) --
-- lets the existing static RLS test (rlsPolicies.test.ts) verify this table
-- the same way it verifies the others.
create policy "recurring_skips_owner_all" on recurring_skips
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.recurring_skips to authenticated;

create index recurring_skips_series_fecha_idx on recurring_skips (series_key, fecha);
