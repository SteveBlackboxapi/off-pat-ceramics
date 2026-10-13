-- The editor owns only these content records and images/editor/* uploads.
-- The original images bucket remains private; no existing objects are changed.
create schema if not exists offpat_private;
revoke all on schema offpat_private from public;
grant usage on schema offpat_private to anon, authenticated;

-- A definer is necessary solely for this private, fresh auth.users lookup.
-- Never authorize through editable user_metadata or an unverified email.
create function offpat_private.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u where u.id = auth.uid()
    and lower(u.email) = 'stevendavidlewis@gmail.com'
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
  );
$$;
revoke all on function offpat_private.is_editor() from public;
grant execute on function offpat_private.is_editor() to anon, authenticated;

create table public.offpat_content (
  id text primary key check (id in ('draft', 'published')),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 262144),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.offpat_content enable row level security;
revoke all on public.offpat_content from anon, authenticated;
grant select on public.offpat_content to anon, authenticated;
grant update on public.offpat_content to authenticated;
create policy "Published content is readable" on public.offpat_content for select
to anon, authenticated using (id = 'published');
create policy "Verified editor reads drafts" on public.offpat_content for select
to authenticated using ((select offpat_private.is_editor()));
create policy "Verified editor updates content" on public.offpat_content for update
to authenticated using ((select offpat_private.is_editor()))
with check ((select offpat_private.is_editor()));
insert into public.offpat_content (id) values ('draft'), ('published');

create table public.offpat_content_history (
  id bigint generated always as identity primary key,
  content jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.offpat_content_history enable row level security;
revoke all on public.offpat_content_history from anon, authenticated;
grant select, insert on public.offpat_content_history to authenticated;
grant usage on sequence public.offpat_content_history_id_seq to authenticated;
create policy "Verified editor reads history" on public.offpat_content_history
for select to authenticated using ((select offpat_private.is_editor()));
create policy "Verified editor records history" on public.offpat_content_history
for insert to authenticated with check ((select offpat_private.is_editor()));

create function public.offpat_save_content(new_content jsonb, expected_version bigint, publish boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_version bigint; result_version bigint;
begin
  if not offpat_private.is_editor() then raise exception 'Editor access required' using errcode = '42501'; end if;
  if jsonb_typeof(new_content) <> 'object' or octet_length(new_content::text) > 262144 then
    raise exception 'Invalid content document' using errcode = '22023';
  end if;
  select version into current_version from public.offpat_content where id = 'draft' for update;
  if current_version <> expected_version then
    raise exception 'Changes were saved in another tab. Reload before saving again.' using errcode = '40001';
  end if;
  update public.offpat_content set content = new_content, version = version + 1, updated_at = now()
    where id = 'draft' returning version into result_version;
  if publish then
    insert into public.offpat_content_history (content)
      select content from public.offpat_content where id = 'published';
    update public.offpat_content set content = new_content, version = version + 1, updated_at = now()
      where id = 'published';
  end if;
  return jsonb_build_object('version', result_version, 'published', publish);
end;
$$;
revoke all on function public.offpat_save_content(jsonb,bigint,boolean) from public;
grant execute on function public.offpat_save_content(jsonb,bigint,boolean) to authenticated;

create policy "Editor can browse existing images" on storage.objects
for select to authenticated using (bucket_id = 'images' and (select offpat_private.is_editor()));
create policy "Editor uploads new WebP derivatives" on storage.objects
for insert to authenticated with check (
  bucket_id = 'images' and (select offpat_private.is_editor())
  and name ~ '^editor/[0-9a-f-]{36}(-small)?[.]webp$'
  and (metadata->>'mimetype') = 'image/webp'
  and (metadata->>'size')::bigint <= 6291456
);
-- No UPDATE/DELETE policies: uploads get unique names and originals stay intact.
create policy "Only published editor images are readable" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'images' and name ~ '^editor/[0-9a-f-]{36}(-small)?[.]webp$'
  and exists (
    select 1 from public.offpat_content c where c.id = 'published'
    and jsonb_path_exists(c.content, '$.* ? (@.src == $path || @.thumbnail == $path)',
      jsonb_build_object('path', '/media/' || substring(name from 8)))
  )
);
