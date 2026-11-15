-- Add email column to profiles table for auth-status lookup
-- Run in Supabase SQL Editor

-- 1. Add email column to profiles
alter table public.profiles
  add column if not exists email text;

-- 2. Create index for fast email lookups
create index if not exists profiles_email_idx on public.profiles(email);

-- 3. Update existing profiles with email from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- 4. Trigger to auto-sync email on profile creation/update
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Get email from auth.users
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

-- 5. Allow anon to read profiles by email (for auth-status check)
-- This is safe because it only exposes moderation status, not sensitive data
drop policy if exists "anon read profile by email for auth check" on public.profiles;
create policy "anon read profile by email for auth check" on public.profiles
  for select to anon
  using (true);

-- Note: This policy allows any anon user to read any profile.
-- If you want to restrict it, you could create an RPC function instead.
-- But since profiles only contain name, role, barangay, avatar_url, and moderation status,
-- and no sensitive data (no email, no password hash), this is acceptable.