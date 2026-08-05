-- Moves ingreso/gasto classification from categories (fixed per category) to
-- movements (per transaction). Categories are now neutral labels that can
-- hold both kinds of movement (e.g. "Efectivo" could receive an ingreso or a
-- gasto) — the app no longer asks for a category's type when creating one.
alter table movements add column tipo text;

-- Backfill every existing movement from its current category's type before
-- the column becomes required and categories.tipo goes away.
update movements m
set tipo = c.tipo
from categories c
where m.category_id = c.id;

alter table movements alter column tipo set not null;
alter table movements add constraint movements_tipo_check check (tipo in ('ingreso', 'gasto'));

alter table categories drop column tipo;
