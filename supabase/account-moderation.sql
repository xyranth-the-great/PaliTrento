alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null;

create table if not exists public.account_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('warn', 'suspend_temporary', 'suspend_permanent', 'restore')),
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_moderation_actions_target_idx
  on public.account_moderation_actions (target_user_id, created_at desc);

alter table public.account_moderation_actions enable row level security;
drop policy if exists "users read own warnings" on public.account_moderation_actions;
create policy "users read own warnings" on public.account_moderation_actions
  for select to authenticated
  using (auth.uid() = target_user_id and action = 'warn');

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

-- Suspended users can still read their own status so the app can explain the lockout.
drop policy if exists "active_account_access" on public.profiles;
create policy "active_account_access" on public.profiles
  as restrictive for select to authenticated
  using (public.is_account_active() or id = auth.uid());

-- Restrictive policies are ANDed with existing policies, preserving their access rules.
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

drop policy if exists "active_account_access" on storage.objects;
create policy "active_account_access" on storage.objects
  as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());

create or replace function public.admin_moderate_account(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_reason text,
  p_duration_hours integer default null
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
begin
  perform pg_advisory_xact_lock(hashtext('palitrento-account-moderation'));

  if p_action not in ('warn', 'suspend_temporary', 'suspend_permanent', 'restore') then
    raise exception 'Unsupported moderation action';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required';
  end if;
  if p_actor_id = p_target_user_id then
    raise exception 'You cannot moderate your own account';
  end if;

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

  select * into target_profile
  from public.profiles
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'Account not found';
  end if;

  if p_action = 'suspend_temporary' and (p_duration_hours is null or p_duration_hours not in (24, 168, 720)) then
    raise exception 'Choose a supported temporary suspension duration';
  end if;
  if p_action <> 'suspend_temporary' and p_duration_hours is not null then
    raise exception 'Duration is only valid for a temporary suspension';
  end if;

  if target_profile.role = 'admin' and p_action in ('suspend_temporary', 'suspend_permanent') then
    select count(*) into active_admin_count
    from public.profiles
    where role = 'admin'
      and (
        account_status = 'active'
        or (account_status = 'suspended' and suspended_until is not null and suspended_until <= now())
      );
    if active_admin_count <= 1 then
      raise exception 'The last active administrator cannot be suspended';
    end if;
  end if;

  if p_action = 'suspend_temporary' then
    update public.profiles
    set account_status = 'suspended',
        suspended_until = now() + make_interval(hours => p_duration_hours),
        suspension_reason = trim(p_reason),
        suspended_by = p_actor_id
    where id = p_target_user_id;
  elsif p_action = 'suspend_permanent' then
    update public.profiles
    set account_status = 'suspended',
        suspended_until = null,
        suspension_reason = trim(p_reason),
        suspended_by = p_actor_id
    where id = p_target_user_id;
  elsif p_action = 'restore' then
    update public.profiles
    set account_status = 'active',
        suspended_until = null,
        suspension_reason = null,
        suspended_by = null
    where id = p_target_user_id;
  end if;

  insert into public.account_moderation_actions (target_user_id, actor_user_id, action, reason, expires_at)
  values (
    p_target_user_id,
    p_actor_id,
    p_action,
    trim(p_reason),
    case when p_action = 'suspend_temporary' then now() + make_interval(hours => p_duration_hours) else null end
  );

  if p_action in ('suspend_temporary', 'suspend_permanent') then
    delete from auth.sessions where user_id = p_target_user_id;
  end if;

  select * into target_profile from public.profiles where id = p_target_user_id;
  return jsonb_build_object(
    'target_user_id', p_target_user_id,
    'account_status', target_profile.account_status,
    'suspended_until', target_profile.suspended_until
  );
end;
$$;

revoke all on function public.admin_moderate_account(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.admin_moderate_account(uuid, uuid, text, text, integer) to service_role;