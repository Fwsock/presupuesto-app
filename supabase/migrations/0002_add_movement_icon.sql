-- Decorative icon shown next to a movement in the list. Auto-suggested from
-- the concepto (client-side, see features/movements/iconSuggestion.ts) or
-- picked manually; purely visual, doesn't affect category or any totals.
alter table movements
  add column icono text not null default 'receipt-outline';
