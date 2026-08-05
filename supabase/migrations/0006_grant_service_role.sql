-- service_role bypasses RLS but still needs the base Postgres GRANT to
-- touch these tables -- the original migrations only granted to
-- `authenticated`, never to `service_role`, which is what admin scripts
-- (e.g. scripts/seed-presupuesto.js) authenticate as.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.categories to service_role;
grant select, insert, update, delete on public.movements to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.recurring_income to service_role;
