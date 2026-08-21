-- Feedback: bug reports and suggestions submitted from Cuenta -> "Reportar
-- un problema o sugerencia". image_url stores a private Storage object
-- PATH (e.g. "<user_id>/172xxxx.jpg"), not a public URL -- a bug screenshot
-- can show real account data, so the bucket below is private. View an
-- attachment from the Supabase dashboard's Storage browser (admin access
-- bypasses RLS) or generate a signed URL for it.
create table feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  title text not null,
  category text not null check (category in ('bug', 'suggestion')),
  description text not null,
  image_url text,
  device_info text
);

alter table feedback enable row level security;

-- Single "for all" policy, same shape as every other owner-scoped table in
-- this project (categories/movements/profiles/recurring_income) -- lets the
-- existing static RLS test (rlsPolicies.test.ts) verify this table the same
-- way it verifies the others, instead of a one-off split insert/select pair.
create policy "feedback_owner_all" on feedback
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;

-- Basic abuse guard: at most 10 feedback rows per user per rolling hour.
-- Runs as the calling user (no security definer) -- the count below is
-- already scoped to their own rows by the RLS policy above, so it needs no
-- elevated privilege.
create or replace function feedback_rate_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from feedback
    where user_id = new.user_id
      and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Demasiados envíos de feedback en la última hora. Intenta de nuevo más tarde.';
  end if;
  return new;
end;
$$;

create trigger feedback_rate_limit_check
  before insert on feedback
  for each row
  execute function feedback_rate_limit();

-- Private bucket for evidence photos, one folder per user
-- ("<user_id>/<file>.jpg") so the two policies below can check ownership
-- from the path itself, same convention as every other table's
-- `auth.uid() = user_id` policy in this project.
insert into storage.buckets (id, name, public)
values ('feedback-evidence', 'feedback-evidence', false)
on conflict (id) do nothing;

create policy "feedback_evidence_owner_insert" on storage.objects
  for insert
  with check (bucket_id = 'feedback-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "feedback_evidence_owner_select" on storage.objects
  for select
  using (bucket_id = 'feedback-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- Email notification on new feedback, via Resend's HTTP API called directly
-- from a trigger. No Edge Function involved on purpose -- this project has
-- no Supabase CLI/Edge Functions set up, and this keeps the whole thing
-- runnable from the SQL Editor like every other migration here.
--
-- ONE-TIME SETUP (run yourself, with your OWN real key -- never commit it):
--   1. Sign up free at https://resend.com.
--   2. Dashboard -> API Keys -> create one, copy it (starts with "re_").
--   3. Run once, replacing the placeholder:
--        select vault.create_secret('re_YOUR_REAL_KEY_HERE', 'resend_api_key');
--   4. Until you verify your own sending domain in Resend, their free-tier
--      sandbox only DELIVERS to the SAME email address you signed up to
--      Resend with, from "onboarding@resend.dev" -- change notify_email
--      below if that's not basti.guzman29@gmail.com.
--   5. If you skip step 3, inserts still work fine -- the trigger just
--      no-ops (no vault secret found), so feedback never gets lost waiting
--      on email setup.
create extension if not exists pg_net;

-- Minimal HTML-escaping so a title/description containing "<" or "&" can't
-- break the notification email's markup -- this is user-typed free text
-- landing directly in an HTML email body.
create or replace function feedback_html_escape(value text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(coalesce(value, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

create or replace function notify_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resend_key text;
  notify_email text := 'basti.guzman29@gmail.com'; -- cambia si tu cuenta Resend usa otro correo
begin
  select decrypted_secret into resend_key
  from vault.decrypted_secrets
  where name = 'resend_api_key';

  if resend_key is null then
    return new; -- vault secret not configured yet -- don't block the insert
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'FinanFlow <onboarding@resend.dev>',
      'to', jsonb_build_array(notify_email),
      'subject', '[FinanFlow] Nuevo feedback: ' || feedback_html_escape(new.title),
      'html',
        '<p><strong>Categoría:</strong> ' || feedback_html_escape(new.category) || '</p>' ||
        '<p><strong>De:</strong> ' || feedback_html_escape(new.user_email) || '</p>' ||
        '<p><strong>Descripción:</strong><br/>' || feedback_html_escape(new.description) || '</p>' ||
        '<p><strong>Dispositivo:</strong> ' || feedback_html_escape(coalesce(new.device_info, 'N/A')) || '</p>'
    )
  );

  return new;
end;
$$;

create trigger feedback_notify_on_insert
  after insert on feedback
  for each row
  execute function notify_new_feedback();
