-- User profile: display name (used as the "Cuenta" tab label), phone, and a
-- one-shot flag so the income onboarding screen only ever shows once. Not
-- auto-created by a trigger (this project has no server-side functions) -
-- the app upserts a row the first time the user saves anything here.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  telefono text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_owner_all" on profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update, delete on public.profiles to authenticated;

-- Recurring monthly income config (e.g. "Sueldo"). One row per user by
-- convention (app-enforced via upsert-by-user_id, not a DB constraint,
-- since a user legitimately has zero rows before ever configuring one).
-- monto only applies to tipo='fijo' - a 'variable' income's amount lives on
-- the movement generated for each specific month instead, since it changes
-- month to month.
create table recurring_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concepto text not null,
  tipo text not null check (tipo in ('fijo', 'variable')),
  monto numeric check (monto is null or monto > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table recurring_income enable row level security;

create policy "recurring_income_owner_all" on recurring_income
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.recurring_income to authenticated;

-- Links a generated movement back to the recurring income it came from, so
-- "has this month already been generated/asked" is just an existence check
-- instead of a separate tracking table. Always inserted with fecha set to
-- the 1st of the month, so the partial unique index below is a real
-- duplicate guard (not just a client-side check) against generating the
-- same month twice if the user navigates back and forth quickly.
alter table movements
  add column recurring_income_id uuid references recurring_income(id) on delete set null;

create unique index recurring_income_movement_unique
  on movements (recurring_income_id, fecha)
  where recurring_income_id is not null;
