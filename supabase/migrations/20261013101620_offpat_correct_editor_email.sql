-- Correct the editor identity to the email explicitly confirmed by the owner.
-- Keep the verified-email requirement and existing draft / Storage policies.
create or replace function offpat_private.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u where u.id = auth.uid()
    and lower(u.email) = 'stevendavidlewis80@gmail.com'
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
  );
$$;
revoke all on function offpat_private.is_editor() from public;
grant execute on function offpat_private.is_editor() to anon, authenticated;
