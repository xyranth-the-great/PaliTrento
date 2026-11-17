-- Immutable, admin-readable activity records for important user and admin changes.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_role text not null default 'system',
  target_user_id uuid references auth.users(id) on delete set null,
  target_name text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  resource_type text not null,
  resource_id text,
  summary text,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);
create index if not exists audit_logs_resource_idx on public.audit_logs(resource_type, created_at desc);

alter table public.audit_logs enable row level security;
drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs" on public.audit_logs
  for select to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));
revoke all on public.audit_logs from public, anon, authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.capture_user_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_before jsonb;
  v_after jsonb;
  v_actor_id uuid;
  v_target_id uuid;
  v_actor_name text;
  v_target_name text;
  v_actor_role text := 'system';
  v_resource_id text;
  v_summary text;
  v_fields text[] := '{}';
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_before := v_row;
  elsif tg_op = 'UPDATE' then
    v_row := to_jsonb(new);
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_row := to_jsonb(new);
    v_after := v_row;
  end if;

  v_actor_id := coalesce(
    auth.uid(),
    nullif(v_row ->> 'actor_user_id', '')::uuid,
    nullif(v_row ->> 'created_by', '')::uuid,
    nullif(v_row ->> 'sender_id', '')::uuid
  );
  v_target_id := coalesce(
    nullif(v_row ->> 'user_id', '')::uuid,
    nullif(v_row ->> 'target_user_id', '')::uuid,
    nullif(v_row ->> 'buyer_id', '')::uuid,
    nullif(v_row ->> 'reporter_id', '')::uuid,
    nullif(v_row ->> 'recipient_id', '')::uuid
  );
  if tg_table_name = 'profiles' then
    v_target_id := coalesce(v_target_id, nullif(v_row ->> 'id', '')::uuid);
  elsif tg_table_name = 'products' and v_target_id is null then
    select s.user_id into v_target_id
    from public.stores s
    where s.id = nullif(v_row ->> 'store_id', '')::uuid;
  end if;

  if v_actor_id is not null then
    select p.role, p.full_name into v_actor_role, v_actor_name
    from public.profiles p
    where p.id = v_actor_id;
    v_actor_role := coalesce(v_actor_role, 'user');
  end if;
  if v_target_id is not null then
    select p.full_name into v_target_name
    from public.profiles p
    where p.id = v_target_id;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(changed.key order by changed.key), '{}') into v_fields
    from jsonb_each(v_after) as changed(key, value)
    where v_before -> changed.key is distinct from changed.value;
    if cardinality(v_fields) = 0 then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    select coalesce(array_agg(fields.key order by fields.key), '{}') into v_fields
    from jsonb_each(v_before) as fields(key, value);
  else
    select coalesce(array_agg(fields.key order by fields.key), '{}') into v_fields
    from jsonb_each(v_after) as fields(key, value);
  end if;

  v_resource_id := coalesce(
    v_row ->> 'id',
    v_row ->> 'product_id',
    v_row ->> 'store_id',
    v_row ->> 'target_user_id'
  );
  v_summary := coalesce(
    nullif(v_row ->> 'business_name', ''),
    nullif(v_row ->> 'name', ''),
    nullif(v_row ->> 'title', ''),
    nullif(v_row ->> 'action', ''),
    nullif(v_row ->> 'status', ''),
    tg_table_name
  );

  insert into public.audit_logs (
    actor_user_id, actor_name, actor_role, target_user_id, target_name, action,
    resource_type, resource_id, summary, changed_fields
  ) values (
    v_actor_id, v_actor_name, v_actor_role, v_target_id, v_target_name, tg_op,
    tg_table_name, v_resource_id, v_summary, v_fields
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Attach audit capture wherever the optional feature table is installed.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'stores', 'products', 'orders', 'messages',
    'business_reports', 'product_reports', 'business_compliance',
    'store_permit_reviews', 'user_subscriptions', 'subscription_events',
    'product_listing_entitlements', 'featured_promotions', 'product_lock_states',
    'advisories', 'account_moderation_actions', 'support_messages'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('drop trigger if exists audit_user_actions on public.%I', v_table);
      execute format(
        'create trigger audit_user_actions after insert or update or delete on public.%I for each row execute function public.capture_user_action()',
        v_table
      );
    end if;
  end loop;
end;
$$;
