-- ============================================================
-- PaliTrento User Reporting System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Business Reports table
create table if not exists public.business_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  reason text not null check (reason in (
    'INAPPROPRIATE_CONTENT',
    'MISLEADING_INFORMATION',
    'SUSPECTED_FRAUD',
    'FAKE_IDENTITY',
    'PROHIBITED_PRODUCTS',
    'HARASSMENT',
    'OTHER'
  )),
  description text,
  status text not null default 'OPEN' check (status in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  admin_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_reports_reporter_idx on public.business_reports(reporter_id);
create index if not exists business_reports_store_idx on public.business_reports(store_id);
create index if not exists business_reports_status_idx on public.business_reports(status);
create index if not exists business_reports_reason_idx on public.business_reports(reason);

-- Add FK to profiles for PostgREST relationship resolution (profiles.id = auth.users.id)
-- Drop existing FK to auth.users if it exists, then add FK to profiles with the standard name
alter table public.business_reports
  drop constraint if exists business_reports_reporter_id_fkey;
alter table public.business_reports
  add constraint business_reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete cascade;

alter table public.business_reports enable row level security;

-- Reporters can read their own reports
drop policy if exists "reporter read own business reports" on public.business_reports;
create policy "reporter read own business reports" on public.business_reports
  for select to authenticated
  using (auth.uid() = reporter_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Authenticated users can create reports
drop policy if exists "users create business reports" on public.business_reports;
create policy "users create business reports" on public.business_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- 2. Product Reports table
create table if not exists public.product_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  reason text not null check (reason in (
    'INAPPROPRIATE_PRODUCT',
    'PROHIBITED_PRODUCT',
    'MISLEADING_DESCRIPTION',
    'FRAUDULENT_LISTING',
    'INCORRECT_PRICING',
    'COPYRIGHT_CONCERN',
    'OTHER'
  )),
  description text,
  status text not null default 'OPEN' check (status in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  admin_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_reports_reporter_idx on public.product_reports(reporter_id);
create index if not exists product_reports_product_idx on public.product_reports(product_id);
create index if not exists product_reports_store_idx on public.product_reports(store_id);
create index if not exists product_reports_status_idx on public.product_reports(status);
create index if not exists product_reports_reason_idx on public.product_reports(reason);

-- Add FK to profiles for PostgREST relationship resolution (profiles.id = auth.users.id)
-- Drop existing FK to auth.users if it exists, then add FK to profiles with the standard name
alter table public.product_reports
  drop constraint if exists product_reports_reporter_id_fkey;
alter table public.product_reports
  add constraint product_reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete cascade;

alter table public.product_reports enable row level security;

-- Reporters can read their own reports
drop policy if exists "reporter read own product reports" on public.product_reports;
create policy "reporter read own product reports" on public.product_reports
  for select to authenticated
  using (auth.uid() = reporter_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Authenticated users can create reports
drop policy if exists "users create product reports" on public.product_reports;
create policy "users create product reports" on public.product_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- 3. Function to create business report
create or replace function public.create_business_report(
  p_store_id uuid,
  p_reason text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid := auth.uid();
  v_store public.stores%rowtype;
  v_existing_report boolean := false;
  v_report_id uuid;
begin
  if v_reporter_id is null then
    raise exception 'Must be authenticated to report';
  end if;

  -- Verify store exists and is verified
  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Store not found';
  end if;

  if v_store.verification_status <> 'VERIFIED' then
    raise exception 'Cannot report unverified store';
  end if;

  if v_store.user_id = v_reporter_id then
    raise exception 'You cannot report your own business';
  end if;

  -- Check for duplicate report (same reporter, same store, same reason within 24h)
  select exists (
    select 1 from public.business_reports
    where reporter_id = v_reporter_id
      and store_id = p_store_id
      and reason = p_reason
      and created_at >= now() - interval '24 hours'
  ) into v_existing_report;

  if v_existing_report then
    raise exception 'You have already reported this store for this reason recently';
  end if;

  -- Create report
  insert into public.business_reports (reporter_id, store_id, reason, description)
  values (v_reporter_id, p_store_id, p_reason, p_description)
  returning id into v_report_id;

  -- Create one private notification per administrator.
  insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only, action_url, action_label)
  select
    'New Business Report',
    'A report has been submitted for "' || v_store.business_name || '" (TRN: ' || v_store.trn_code || '). Reason: ' || p_reason || '.',
    'ANNOUNCEMENT',
    'normal',
    now(),
    v_reporter_id,
    admin_profile.id,
    true,
    '/admin-reports-management/?tab=business',
    'Review business report'
  from public.profiles admin_profile
  where admin_profile.role = 'admin';

  return jsonb_build_object('success', true, 'report_id', v_report_id);
end;
$$;

revoke all on function public.create_business_report(uuid, text, text) from public, anon;
grant execute on function public.create_business_report(uuid, text, text) to authenticated;

-- 4. Function to create product report
create or replace function public.create_product_report(
  p_product_id uuid,
  p_reason text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_store public.stores%rowtype;
  v_existing_report boolean := false;
  v_report_id uuid;
begin
  if v_reporter_id is null then
    raise exception 'Must be authenticated to report';
  end if;

  -- Verify product exists
  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;

  -- Verify store is verified
  select * into v_store from public.stores where id = v_product.store_id;
  if not found or v_store.verification_status <> 'VERIFIED' then
    raise exception 'Cannot report product from unverified store';
  end if;

  if v_store.user_id = v_reporter_id then
    raise exception 'You cannot report your own product';
  end if;

  -- Check for duplicate report
  select exists (
    select 1 from public.product_reports
    where reporter_id = v_reporter_id
      and product_id = p_product_id
      and reason = p_reason
      and created_at >= now() - interval '24 hours'
  ) into v_existing_report;

  if v_existing_report then
    raise exception 'You have already reported this product for this reason recently';
  end if;

  -- Create report
  insert into public.product_reports (reporter_id, product_id, store_id, reason, description)
  values (v_reporter_id, p_product_id, v_product.store_id, p_reason, p_description)
  returning id into v_report_id;

  -- Create one private notification per administrator.
  insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only, action_url, action_label)
  select
    'New Product Report',
    'A report has been submitted for product "' || v_product.name || '" from store "' || v_store.business_name || '". Reason: ' || p_reason || '.',
    'ANNOUNCEMENT',
    'normal',
    now(),
    v_reporter_id,
    admin_profile.id,
    true,
    '/admin-reports-management/?tab=product',
    'Review product report'
  from public.profiles admin_profile
  where admin_profile.role = 'admin';

  return jsonb_build_object('success', true, 'report_id', v_report_id);
end;
$$;

revoke all on function public.create_product_report(uuid, text, text) from public, anon;
grant execute on function public.create_product_report(uuid, text, text) to authenticated;

-- 5. Admin function to update report status
create or replace function public.admin_update_report_status(
  p_actor_id uuid,
  p_report_type text, -- 'BUSINESS' or 'PRODUCT'
  p_report_id uuid,
  p_status text, -- 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
  p_admin_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_table text;
  v_updated_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'Actor does not match authenticated user';
  end if;

  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Only administrators can update report status';
  end if;

  if p_report_type = 'BUSINESS' then
    v_table := 'business_reports';
  elsif p_report_type = 'PRODUCT' then
    v_table := 'product_reports';
  else
    raise exception 'Invalid report type. Use BUSINESS or PRODUCT';
  end if;

  if p_status not in ('UNDER_REVIEW', 'RESOLVED', 'DISMISSED') then
    raise exception 'Invalid status';
  end if;

  -- Update report
  execute format('
    update public.%I
    set status = %L,
        admin_notes = %L,
        resolved_by = %L,
        resolved_at = %L,
        updated_at = %L
    where id = %L
  ', v_table, p_status, p_admin_notes, p_actor_id, now(), now(), p_report_id);
  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    raise exception 'Report not found';
  end if;

  return jsonb_build_object('success', true, 'report_id', p_report_id, 'status', p_status);
end;
$$;

revoke all on function public.admin_update_report_status(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_report_status(uuid, text, uuid, text, text) to authenticated, service_role;

-- 6. Grant for authenticated users
grant select on public.business_reports to authenticated;
grant select on public.product_reports to authenticated;
grant insert on public.business_reports to authenticated;
grant insert on public.product_reports to authenticated;

-- ============================================================
-- DEPLOYMENT CHECKLIST:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Frontend will call create_business_report and create_product_report RPCs
-- 3. Admin dashboard will use admin_update_report_status RPC
-- ============================================================