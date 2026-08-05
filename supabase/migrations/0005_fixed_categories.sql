-- "Fixed/recurring" categories (Luz, Agua, Arriendo, Internet, etc): any
-- movement created under one of these gets replicated into each new month
-- automatically, unlike a plain category's movements which are one-offs.
alter table categories add column es_fija boolean not null default false;

-- Links a movement to the recurring "series" it belongs to, so
-- ensureFixedCategoryMovementsForMonth (features/movements/fixedCategories.ts)
-- can find "the latest instance of this recurring item" and check whether
-- the currently viewed month already has its own copy before replicating.
-- Set once, client-side, on the first movement of a series (a fresh uuid);
-- every later replica in the chain reuses that same value. Distinct from
-- installment_group_id (cuotas are a fixed N-count group with a shared
-- total, not an open-ended monthly repeat) -- unlike recurring_income_id
-- movements, these stay fully editable/togglable (see
-- features/movements/recurringLock.ts, which only checks recurring_income_id).
alter table movements add column fixed_series_id uuid;

create index movements_fixed_series_idx on movements (fixed_series_id) where fixed_series_id is not null;
