-- APPLIED ON LIVE SUPABASE: migration 20261116111732_create_assistant_knowledge_admin_drafts.
-- Retained as the reviewed SQL record; do not re-run manually or treat this file as an automated migration.
create table if not exists public.assistant_knowledge (
  id text primary key check (id = 'tasneem'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null
);

alter table public.assistant_knowledge enable row level security;

revoke all on table public.assistant_knowledge from anon, authenticated;
grant select, insert, update on table public.assistant_knowledge to authenticated;

drop policy if exists "Tasneem admin can read assistant knowledge" on public.assistant_knowledge;
create policy "Tasneem admin can read assistant knowledge"
on public.assistant_knowledge
for select
to authenticated
using ((select public.is_tasneem_admin()));

drop policy if exists "Tasneem admin can insert assistant knowledge" on public.assistant_knowledge;
create policy "Tasneem admin can insert assistant knowledge"
on public.assistant_knowledge
for insert
to authenticated
with check (
  (select public.is_tasneem_admin())
  and updated_by = (select auth.uid())
);

drop policy if exists "Tasneem admin can update assistant knowledge" on public.assistant_knowledge;
create policy "Tasneem admin can update assistant knowledge"
on public.assistant_knowledge
for update
to authenticated
using ((select public.is_tasneem_admin()))
with check (
  (select public.is_tasneem_admin())
  and updated_by = (select auth.uid())
);

comment on table public.assistant_knowledge is
  'Private editable draft for Tasneem AI assistant knowledge. Not published to visitors automatically.';
