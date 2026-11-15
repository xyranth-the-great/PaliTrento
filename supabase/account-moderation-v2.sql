-- ============================================================
-- PaliTrento Account Moderation System v2
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Enhanced profiles table with suspension/ban fields
alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'banned')),
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid references auth.users(id) on delete set null,
  add column if not exists ban_reason text;

-- 2. Moderation actions table (enhanced)
create table if not exists public.account_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('warn', 'suspend_temporary', 'suspend_permanent', 'ban', 'restore', 'unban')),
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_moderation_actions_target_idx
  on public.account_moderation_actions (target_user_id, created_at desc);

alter table public.account_moderation_actions enable row level security;

-- Users can read their own warnings
drop policy if exists "users read own warnings" on public.account_moderation_actions;
create policy "users read own warnings" on public.account_moderation_actions
  for select to authenticated
  using (auth.uid() = target_user_id and action = 'warn');

-- Users can read their own suspension/ban history
drop policy if exists "users read own moderation" on public.account_moderation_actions;
create policy "users read own moderation" on public.account_moderation_actions
  for select to authenticated
  using (auth.uid() = target_user_id);

-- 3. Warning notifications - extend advisories or create dedicated table
-- Using existing advisories table with WARNING category
-- Add WARNING category to advisories if not exists (handled by app layer)

-- 4. Function to check if account is active (not suspended/banned, or suspension expired)
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
      and (
        account_status = 'active'
        or (account_status = 'suspended' and suspended_until is not null and suspended_until <= now())
      )
  );
$$;

revoke all on function public.is_account_active() from public, anon;
grant execute on function public.is_account_active() to authenticated, service_role;

-- 5. Function to get account status details (for suspended/banned pages)
create or replace function public.get_account_status(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'account_status', account_status,
    'suspended_until', suspended_until,
    'suspension_reason', suspension_reason,
    'suspended_at', suspended_at,
    'banned_at', banned_at,
    'ban_reason', ban_reason,
    'is_suspended', account_status = 'suspended' and (suspended_until is null or suspended_until > now()),
    'is_banned', account_status = 'banned',
    'suspension_expired', account_status = 'suspended' and suspended_until is not null and suspended_until <= now()
  ) into result
  from public.profiles
  where id = p_user_id;

  return coalesce(result, jsonb_build_object('account_status', 'not_found'));
end;
$$;

revoke all on function public.get_account_status(uuid) from public, anon;
grant execute on function public.get_account_status(uuid) to authenticated, service_role;

-- 6. Restrictive policy on profiles - active users + self access for suspended/banned
drop policy if exists "active_account_access" on public.profiles;
create policy "active_account_access" on public.profiles
  as restrictive for select to authenticated
  using (public.is_account_active() or id = auth.uid());

-- 7. Apply restrictive policies to all user-data tables
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

-- 8. Storage objects restrictive policy
drop policy if exists "active_account_access" on storage.objects;
create policy "active_account_access" on storage.objects
  as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());

-- 9. Admin moderation function (enhanced)
create or replace function public.admin_moderate_account(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_reason text,
  p_duration_hours integer default null,
  p_custom_duration_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  active_admin_count integer;
  expires_at timestamptz := null;
  duration_hours_final integer;
begin
  perform pg_advisory_xact_lock(hashtext('palitrento-account-moderation'));

  -- Validate action
  if p_action not in ('warn', 'suspend_temporary', 'suspend_permanent', 'ban', 'restore', 'unban') then
    raise exception 'Unsupported moderation action';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required';
  end if;
  if p_actor_id = p_target_user_id then
    raise exception 'You cannot moderate your own account';
  end if;

  -- Verify actor is active admin
  select * into actor_profile
  from public.profiles
  where id = p_actor_id
  for update;

  if not found or actor_profile.role <> 'admin' or not (
    actor_profile.account_status = 'active'
    or (actor_profile.suspended_until is not null and actor_profile.suspended_until <= now())
  ) then
    raise exception 'Only an active administrator can moderate accounts';
  end if;

  -- Verify target exists
  select * into target_profile
  from public.profiles
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'Account not found';
  end if;

  -- Validate duration for temporary suspension
  if p_action = 'suspend_temporary' then
    -- Support durations: 1d(24), 3d(72), 7d(168), 14d(336), 30d(720), custom
    if p_custom_duration_days is not null and p_custom_duration_days > 0 then
      duration_hours_final := p_custom_duration_days * 24;
    elsif p_duration_hours is not null and p_duration_hours in (24, 72, 168, 336, 720) then
      duration_hours_final := p_duration_hours;
    else
      raise exception 'Choose a supported temporary suspension duration (1, 3, 7, 14, 30 days, or custom)';
    end if;
    expires_at := now() + make_interval(hours => duration_hours_final);
  end if;

  if p_action <> 'suspend_temporary' and p_duration_hours is not null then
    raise exception 'Duration is only valid for a temporary suspension';
  end if;

  -- Protect last active admin
  if target_profile.role = 'admin' and p_action in ('suspend_temporary', 'suspend_permanent', 'ban') then
    select count(*) into active_admin_count
    from public.profiles
    where role = 'admin'
      and (
        account_status = 'active'
        or (account_status = 'suspended' and suspended_until is not null and suspended_until <= now())
      );
    if active_admin_count <= 1 then
      raise exception 'The last active administrator cannot be suspended or banned';
    end if;
  end if;

  -- Execute action
  if p_action = 'suspend_temporary' then
    update public.profiles
    set account_status = 'suspended',
        suspended_until = expires_at,
        suspension_reason = trim(p_reason),
        suspended_by = p_actor_id,
        suspended_at = now()
    where id = p_target_user_id;

  elsif p_action = 'suspend_permanent' then
    update public.profiles
    set account_status = 'suspended',
        suspended_until = null,
        suspension_reason = trim(p_reason),
        suspended_by = p_actor_id,
        suspended_at = now()
    where id = p_target_user_id;

  elsif p_action = 'ban' then
    update public.profiles
    set account_status = 'banned',
        banned_at = now(),
        banned_by = p_actor_id,
        ban_reason = trim(p_reason)
    where id = p_target_user_id;

  elsif p_action = 'restore' then
    -- Restore from temporary or permanent suspension
    update public.profiles
    set account_status = 'active',
        suspended_until = null,
        suspension_reason = null,
        suspended_by = null,
        suspended_at = null
    where id = p_target_user_id;

  elsif p_action = 'unban' then
    -- Restore from permanent ban
    update public.profiles
    set account_status = 'active',
        banned_at = null,
        banned_by = null,
        ban_reason = null
    where id = p_target_user_id;

  elsif p_action = 'warn' then
    -- Warning doesn't change account status
    null;
  end if;

  -- Record moderation action
  insert into public.account_moderation_actions (target_user_id, actor_user_id, action, reason, expires_at)
  values (
    p_target_user_id,
    p_actor_id,
    p_action,
    trim(p_reason),
    expires_at
  );

  -- Invalidate sessions for suspensions and bans
  if p_action in ('suspend_temporary', 'suspend_permanent', 'ban') then
    delete from auth.sessions where user_id = p_target_user_id;
  end if;

  -- Return updated status
  select * into target_profile from public.profiles where id = p_target_user_id;
  return jsonb_build_object(
    'target_user_id', p_target_user_id,
    'account_status', target_profile.account_status,
    'suspended_until', target_profile.suspended_until,
    'suspended_at', target_profile.suspended_at,
    'banned_at', target_profile.banned_at,
    'expires_at', expires_at
  );
end;
$$;

revoke all on function public.admin_moderate_account(uuid, uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_moderate_account(uuid, uuid, text, text, integer, integer) to service_role;

-- 10. Function to auto-restore expired suspensions (can be run via cron or pg_cron)
create or replace function public.auto_restore_expired_suspensions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  restored_count integer := 0;
  rec record;
begin
  for rec in
    select id from public.profiles
    where account_status = 'suspended'
      and suspended_until is not null
      and suspended_until <= now()
  loop
    update public.profiles
    set account_status = 'active',
        suspended_until = null,
        suspension_reason = null,
        suspended_by = null,
        suspended_at = null
    where id = rec.id;

    insert into public.account_moderation_actions (target_user_id, actor_user_id, action, reason)
    values (rec.id, rec.id, 'restore', 'Automatic restoration: temporary suspension expired');

    restored_count := restored_count + 1;
  end loop;
  return restored_count;
end;
$$;

revoke all on function public.auto_restore_expired_suspensions() from public, anon, authenticated;
grant execute on function public.auto_restore_expired_suspensions() to service_role;

-- 11. Grant for authenticated users to read their own status
grant select on public.profiles to authenticated;
grant select on public.account_moderation_actions to authenticated;