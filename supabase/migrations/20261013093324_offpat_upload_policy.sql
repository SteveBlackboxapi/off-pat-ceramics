-- Supabase Storage's preflight permission check supplies contentLength rather
-- than the final object's size. Older Storage versions may omit that metadata.
alter policy "Editor uploads new WebP derivatives" on storage.objects
with check (
  bucket_id = 'images' and (select offpat_private.is_editor())
  and name ~ '^editor/[0-9a-f-]{36}(-small)?[.]webp$'
  and coalesce(metadata->>'mimetype', 'image/webp') = 'image/webp'
  and coalesce((metadata->>'contentLength')::bigint, (metadata->>'size')::bigint, 0) between 0 and 6291456
);
-- Supabase's default privileges may grant anon explicitly as well as PUBLIC.
revoke all on function public.offpat_save_content(jsonb,bigint,boolean) from anon;
