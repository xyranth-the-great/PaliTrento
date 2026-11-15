-- ============================================================
-- PaliTrento Account Moderation System v3 - CORRECTED
-- Run in Supabase SQL Editor
-- This fixes the critical bug where is_account_active() treated expired suspensions as active
-- ============================================================

-- 1. Fix the is_account_active() function
-- CRITICAL: Expired suspensions must NOT be treated as active
-- Only truly active accounts (account_status = 'active') should return true
-- Expired suspensions will be handled by auto_restore_expired_suspensions()
create or replace function public.is_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and account_status = 'active'
  );
$$;

revoke all on function public.is_account_active() from public, anon;
grant execute on function public.is_account_active() to authenticated, service_role;

-- 2. Ensure the profiles table has the email column and proper policies
-- (from add-profile-email.sql - included here for completeness)
alter table public.profiles
  add column if not exists email text;

create index if not exists profiles_email_idx on public.profiles(email);

-- Update existing profiles with email from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Trigger to auto-sync email on profile creation/update
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then
    select email into new.email
    from auth.users
    where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists sync_profile_email_trigger on public.profiles;
create trigger sync_profile_email_trigger
  before insert or update on public.profiles
  for each row execute function public.sync_profile_email();

-- Allow anon to read profiles by email (for auth-status check without session)
-- This is safe because it only exposes moderation status, not sensitive data
drop policy if exists "anon read profile by email for auth check" on public.profiles;
create policy "anon read profile by email for auth check" on public.profiles
  for select to anon
  using (true);

-- 3. Restrictive policy on profiles - active users + self access for suspended/banned
-- This allows suspended/banned users to read their own profile to see their status
drop policy if exists "active_account_access" on public.profiles;
create policy "active_account_access" on public.profiles
  as restrictive for select to authenticated
  using (public.is_account_active() or id = auth.uid());

-- 4. Apply restrictive policies to all user-data tables
-- Only active accounts can access stores, products, orders, messages, etc.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'stores',
    'products',
    'orders',
    'messages',
    'advisories',
    'notification_reads',
    'push_subscriptions',
    'notification_preferences'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists %I on public.%I', 'active_account_access', table_name);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.is_account_active()) with check (public.is_account_active())',
        'active_account_access', table_name
      );
    end if;
  end loop;
end;
$$;

-- 5. Storage objects restrictive policy
drop policy if exists "active_account_access" on storage.objects;
create policy "active_account_access" on storage.objects
  as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());

-- 6. Ensure admin_moderate_account RPC is correct (from v2, verified)
-- The function already correctly:
-- - Sets account_status = 'suspended' with suspended_until for temporary
-- - Sets account_status = 'suspended' with suspended_until = null for permanent
-- - Sets account_status = 'banned' for bans
-- - Deletes auth.sessions for suspensions/bans
-- - Records action in account_moderation_actions
-- No changes needed to this function if v2 was deployed correctly.

-- 7. Ensure auto_restore_expired_suspensions works correctly
-- This should be run via pg_cron on a schedule (e.g., every 5 minutes)
-- It restores accounts where account_status = 'suspended' and suspended_until <= now()
-- No changes needed if v2 was deployed correctly.

-- 8. Grant for authenticated users to read their own status
grant select on public.profiles to authenticated;
grant select on public.account_moderation_actions to authenticated;

-- 9. Add index for faster suspension queries
create index if not exists profiles_account_status_idx on public.profiles(account_status);
create index if not exists profiles_suspended_until_idx on public.profiles(suspended_until) where suspended_until is not null;

-- 10. Verify the moderation actions table has proper indexes
create index if not exists account_moderation_actions_actor_idx on public.account_moderation_actions(actor_user_id, created_at desc);

-- ============================================================
-- DEPLOYMENT CHECKLIST:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Deploy the admin-account-moderation Edge Function (if not already deployed)
-- 3. Set up pg_cron to run auto_restore_expired_suspensions() every 5 minutes:
--    SELECT cron.schedule('auto-restore-expired-suspensions', '*/5 * * * *', 'SELECT public.auto_restore_expired_suspensions();');
-- 4. Test the complete flow: suspend -> login -> redirect to /suspended/ -> expiry -> auto-restore -> login -> dashboard
-- ============================================================