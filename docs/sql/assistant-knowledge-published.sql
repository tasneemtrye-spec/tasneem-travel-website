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
-- Keep the admin audit identity private from ordinary authenticated readers too.
grant select (id, content, version, published_at)
  on public.assistant_knowledge_published to anon, authenticated;

-- The publish RPC runs as SECURITY INVOKER, so grant only the columns it writes.
-- RLS still limits INSERT/UPDATE to the verified Tasneem admin identity.
grant insert (id, content, version, published_at, published_by)
  on public.assistant_knowledge_published to authenticated;
grant update (content, version, published_at, published_by)
  on public.assistant_knowledge_published to authenticated;

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

-- Atomic, version-checked publish. The row lock prevents a concurrent draft update
-- from slipping between the version check and publication.
create or replace function public.publish_assistant_knowledge(expected_version integer)
returns table(published_version integer, published_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  draft_row public.assistant_knowledge%rowtype;
begin
  if not public.is_tasneem_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into draft_row
  from public.assistant_knowledge
  where id = 'tasneem' and version = expected_version
  for update;

  if not found then
    raise exception 'draft_version_mismatch' using errcode = '40001';
  end if;

  -- Enforce the public knowledge contract at the database boundary too;
  -- browser-side validation is not a security boundary.
  if jsonb_typeof(draft_row.content->'agency') is distinct from 'object'
     or jsonb_typeof(draft_row.content->'services') is distinct from 'array'
     or jsonb_typeof(draft_row.content->'destinations') is distinct from 'array'
     or jsonb_typeof(draft_row.content->'faq') is distinct from 'array'
     or jsonb_typeof(draft_row.content->'booking_process') is distinct from 'object'
     or jsonb_typeof(draft_row.content->'privacy') is distinct from 'object'
     or jsonb_typeof(draft_row.content->'limitations') is distinct from 'array'
     or jsonb_typeof(draft_row.content#>'{agency,name}') is distinct from 'string'
     or length(btrim(draft_row.content#>>'{agency,name}')) = 0
     or jsonb_typeof(draft_row.content#>'{booking_process,form_fields}') is distinct from 'array'
     or jsonb_typeof(draft_row.content#>'{booking_process,disclaimer}') is distinct from 'string'
     or jsonb_typeof(draft_row.content#>'{privacy,collected_data}') is distinct from 'string'
     or jsonb_typeof(draft_row.content#>'{privacy,usage}') is distinct from 'string'
     or jsonb_typeof(draft_row.content#>'{privacy,sensitive}') is distinct from 'string'
     or jsonb_typeof(draft_row.content#>'{privacy,contact}') is distinct from 'string'
     or jsonb_array_length(draft_row.content->'services') > 30
     or jsonb_array_length(draft_row.content->'destinations') > 50
     or jsonb_array_length(draft_row.content->'faq') > 100
     or jsonb_array_length(draft_row.content#>'{booking_process,form_fields}') > 30
     or jsonb_array_length(draft_row.content->'limitations') > 30
     or exists (
       select 1 from jsonb_array_elements(draft_row.content->'services') item
       where jsonb_typeof(item) is distinct from 'object'
          or jsonb_typeof(item->'name') is distinct from 'string'
          or length(btrim(item->>'name')) = 0
          or jsonb_typeof(item->'scope') is distinct from 'string'
          or length(btrim(item->>'scope')) = 0
     )
     or exists (
       select 1 from jsonb_array_elements(draft_row.content->'destinations') item
       where jsonb_typeof(item) is distinct from 'object'
          or jsonb_typeof(item->'name') is distinct from 'string'
          or length(btrim(item->>'name')) = 0
          or jsonb_typeof(item->'description') is distinct from 'string'
          or length(btrim(item->>'description')) = 0
     )
     or exists (
       select 1 from jsonb_array_elements(draft_row.content->'faq') item
       where jsonb_typeof(item) is distinct from 'object'
          or jsonb_typeof(item->'q') is distinct from 'string'
          or length(btrim(item->>'q')) = 0
          or jsonb_typeof(item->'a') is distinct from 'string'
          or length(btrim(item->>'a')) = 0
     )
     or exists (
       select 1 from jsonb_array_elements(draft_row.content->'limitations') item
       where jsonb_typeof(item) is distinct from 'string'
          or length(btrim(item#>>'{}')) = 0
     ) then
    raise exception 'invalid_knowledge_schema' using errcode = '22023';
  end if;

  insert into public.assistant_knowledge_published
    (id, content, version, published_at, published_by)
  values
    ('tasneem', draft_row.content, draft_row.version, now(), auth.uid())
  on conflict (id) do update set
    content = excluded.content,
    version = excluded.version,
    published_at = excluded.published_at,
    published_by = excluded.published_by;

  return query
    select p.version, p.published_at
    from public.assistant_knowledge_published p
    where p.id = 'tasneem';
end;
$$;

revoke all on function public.publish_assistant_knowledge(integer) from public, anon;
grant execute on function public.publish_assistant_knowledge(integer) to authenticated;

comment on table public.assistant_knowledge_published is
  'Single active public knowledge snapshot. Public read-only; verified Tasneem admin can publish.';
comment on function public.publish_assistant_knowledge(integer) is
  'Atomically publishes the exact current private draft version for the verified Tasneem admin.';
