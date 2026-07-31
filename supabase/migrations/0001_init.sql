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
