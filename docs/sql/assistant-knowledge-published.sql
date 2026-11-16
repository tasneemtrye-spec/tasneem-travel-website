-- Proposed migration only. Do not apply until the preview rollout is approved.
create table if not exists public.assistant_knowledge_published (
  id text primary key check (id = 'tasneem'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  version integer not null check (version > 0),
  published_at timestamptz not null default now(),
  published_by uuid not null references auth.users(id)
);
alter table public.assistant_knowledge_published enable row level security;
revoke all on table public.assistant_knowledge_published from anon, authenticated;
grant select (id, content, version, published_at) on public.assistant_knowledge_published to anon;
grant select, insert, update on public.assistant_knowledge_published to authenticated;

drop policy if exists "Public can read published Tasneem knowledge" on public.assistant_knowledge_published;
create policy "Public can read published Tasneem knowledge"
on public.assistant_knowledge_published for select to anon, authenticated
using (id = 'tasneem');

drop policy if exists "Tasneem admin can publish knowledge" on public.assistant_knowledge_published;
create policy "Tasneem admin can publish knowledge"
on public.assistant_knowledge_published for insert to authenticated
with check ((select public.is_tasneem_admin()) and published_by = (select auth.uid()));

drop policy if exists "Tasneem admin can update published knowledge" on public.assistant_knowledge_published;
create policy "Tasneem admin can update published knowledge"
on public.assistant_knowledge_published for update to authenticated
using ((select public.is_tasneem_admin()))
with check ((select public.is_tasneem_admin()) and published_by = (select auth.uid()));

comment on table public.assistant_knowledge_published is
  'Single active public knowledge snapshot. Public read-only; verified Tasneem admin can publish.';
