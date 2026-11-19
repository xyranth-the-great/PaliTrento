-- Depends on 015_hide_blocked_owner_stores.sql.
-- Marketplace removals are reversible and preserve store/product records.

alter table public.stores
  add column if not exists marketplace_removed_at timestamptz,
  add column if not exists marketplace_removed_by uuid references auth.users(id) on delete set null;

alter table public.products
  add column if not exists marketplace_removed_at timestamptz,
  add column if not exists marketplace_removed_by uuid references auth.users(id) on delete set null;

create index if not exists stores_marketplace_removed_idx
  on public.stores (marketplace_removed_at)
  where marketplace_removed_at is not null;
create index if not exists products_marketplace_removed_idx
  on public.products (marketplace_removed_at)
  where marketplace_removed_at is not null;

-- Removed stores remain readable by their owner and admins, but not by the public.
drop policy if exists "hide removed marketplace stores" on public.stores;
create policy "hide removed marketplace stores" on public.stores
  as restrictive for select to anon, authenticated
  using (
    marketplace_removed_at is null
    or auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- A removed product remains readable by its store owner and admins.
drop policy if exists "hide removed marketplace products" on public.products;
create policy "hide removed marketplace products" on public.products
  as restrictive for select to anon, authenticated
  using (
    (
      marketplace_removed_at is null
      and exists (
        select 1 from public.stores s
        where s.id = products.store_id
          and s.marketplace_removed_at is null
      )
    )
    or exists (
      select 1 from public.stores s
      where s.id = products.store_id
        and auth.uid() = s.user_id
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- The public listing RPCs are SECURITY DEFINER and need the removal checks
-- explicitly. Their filters run before LIMIT so hidden listings do not consume
-- result slots.

create or replace function public.get_public_featured_stores(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stores jsonb;
begin
  with featured_stores as (
    select
      s.id,
      s.business_name,
      s.trade_category,
      s.barangay,
      s.storefront_image_url,
      s.description,
      s.verification_status,
      s.approval_status,
      s.trn_code,
      s.open_time,
      s.close_time,
      s.accepted_payments,
      fp.id as promo_id,
      fp.started_at,
      fp.expires_at,
      fp.price_paid_cents,
      subscription_status.is_premium
    from public.stores s
    cross join lateral (
      select exists (
        select 1 from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where us.user_id = s.user_id
          and us.status = 'ACTIVE'
          and sp.code = 'PREMIUM'
      ) as is_premium
    ) subscription_status
    left join lateral (
      select fp.id, fp.started_at, fp.expires_at, fp.price_paid_cents
      from public.featured_promotions fp
      where fp.store_id = s.id
        and fp.status = 'ACTIVE'
        and fp.expires_at > now()
      order by fp.started_at desc
      limit 1
    ) fp on true
    where (subscription_status.is_premium or fp.id is not null)
      and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
      and s.marketplace_removed_at is null
      and not public.is_owner_blocked(s.user_id)
  ),
  limited_featured_stores as (
    select *
    from featured_stores
    order by case when is_premium then 0 else 1 end, started_at desc nulls last
    limit greatest(coalesce(p_limit, 10), 0)
  )
  select jsonb_agg(
    jsonb_build_object(
      'id', fs.id,
      'business_name', fs.business_name,
      'trade_category', fs.trade_category,
      'barangay', fs.barangay,
      'storefront_image_url', fs.storefront_image_url,
      'description', fs.description,
      'verification_status', fs.verification_status,
      'approval_status', fs.approval_status,
      'trn_code', fs.trn_code,
      'open_time', fs.open_time,
      'close_time', fs.close_time,
      'accepted_payments', fs.accepted_payments,
      'is_premium', fs.is_premium,
      'featured_promo', case
        when fs.promo_id is null then null
        else jsonb_build_object(
          'id', fs.promo_id,
          'started_at', fs.started_at,
          'expires_at', fs.expires_at,
          'price_paid_cents', fs.price_paid_cents
        )
      end
    )
    order by case when fs.is_premium then 0 else 1 end, fs.started_at desc nulls last
  ) into v_stores
  from limited_featured_stores fs;

  return coalesce(v_stores, '[]'::jsonb);
end;
$$;

create or replace function public.search_stores_with_priority(
  p_query text default '',
  p_category text default '',
  p_barangay text default '',
  p_open_only boolean default false,
  p_verified_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stores jsonb;
begin
  select coalesce(jsonb_agg(result.store_json order by result.premium_rank, result.promo_rank, result.business_name), '[]'::jsonb)
  into v_stores
  from (
    select
      s.business_name,
      case when exists (
        select 1 from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where us.user_id = s.user_id and us.status = 'ACTIVE' and sp.code = 'PREMIUM'
      ) then 0 else 1 end as premium_rank,
      case when exists (
        select 1 from public.featured_promotions fp
        where fp.store_id = s.id and fp.status = 'ACTIVE' and fp.expires_at > now()
      ) then 0 else 1 end as promo_rank,
      jsonb_build_object(
        'id', s.id,
        'business_name', s.business_name,
        'trade_category', s.trade_category,
        'barangay', s.barangay,
        'storefront_image_url', s.storefront_image_url,
        'description', s.description,
        'verification_status', s.verification_status,
        'approval_status', s.approval_status,
        'trn_code', s.trn_code,
        'open_time', s.open_time,
        'close_time', s.close_time,
        'accepted_payments', s.accepted_payments,
        'is_premium', exists (
          select 1 from public.user_subscriptions us
          join public.subscription_plans sp on sp.id = us.plan_id
          where us.user_id = s.user_id and us.status = 'ACTIVE' and sp.code = 'PREMIUM'
        ),
        'has_featured_promo', exists (
          select 1 from public.featured_promotions fp
          where fp.store_id = s.id and fp.status = 'ACTIVE' and fp.expires_at > now()
        )
      ) as store_json
    from public.stores s
    where (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
      and s.marketplace_removed_at is null
      and not public.is_owner_blocked(s.user_id)
      and (coalesce(p_query, '') = '' or s.business_name ilike '%' || p_query || '%'
        or s.description ilike '%' || p_query || '%' or s.barangay ilike '%' || p_query || '%')
      and (coalesce(p_category, '') = '' or s.trade_category = p_category)
      and (coalesce(p_barangay, '') = '' or s.barangay = p_barangay)
      and (not coalesce(p_open_only, false) or public.is_store_open(s.id))
      and (not coalesce(p_verified_only, false)
        or s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
    order by premium_rank, promo_rank, s.business_name
    limit greatest(coalesce(p_limit, 50), 0)
    offset greatest(coalesce(p_offset, 0), 0)
  ) result;

  return coalesce(v_stores, '[]'::jsonb);
end;
$$;

create or replace function public.search_products_with_priority(
  p_query text default '',
  p_category text default '',
  p_capped_only boolean default false,
  p_in_stock_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_products jsonb;
begin
  select coalesce(jsonb_agg(result.product_json order by result.premium_rank, result.product_name), '[]'::jsonb)
  into v_products
  from (
    select
      p.name as product_name,
      case when exists (
        select 1 from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where us.user_id = s.user_id and us.status = 'ACTIVE' and sp.code = 'PREMIUM'
      ) then 0 else 1 end as premium_rank,
      jsonb_build_object(
        'id', p.id,
        'store_id', p.store_id,
        'name', p.name,
        'category', p.category,
        'unit', p.unit,
        'current_price', p.current_price,
        'lgu_srp_ceiling', p.lgu_srp_ceiling,
        'in_stock', p.in_stock,
        'quantity', p.quantity,
        'image_url', p.image_url,
        'featured_until', p.featured_until,
        'created_at', p.created_at,
        'store_business_name', s.business_name,
        'store_trn_code', s.trn_code,
        'store_barangay', s.barangay,
        'store_image_url', s.storefront_image_url,
        'is_premium_store', exists (
          select 1 from public.user_subscriptions us
          join public.subscription_plans sp on sp.id = us.plan_id
          where us.user_id = s.user_id and us.status = 'ACTIVE' and sp.code = 'PREMIUM'
        )
      ) as product_json
    from public.products p
    join public.stores s on s.id = p.store_id
    where (p.quantity is null or p.quantity > 0)
      and p.marketplace_removed_at is null
      and s.marketplace_removed_at is null
      and not public.is_owner_blocked(s.user_id)
      and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
      and (coalesce(p_query, '') = '' or p.name ilike '%' || p_query || '%'
        or p.category ilike '%' || p_query || '%')
      and (coalesce(p_category, '') = '' or p.category = p_category)
      and (not coalesce(p_capped_only, false) or p.lgu_srp_ceiling is not null)
      and (not coalesce(p_in_stock_only, false) or p.in_stock = true)
      and not exists (
        select 1 from public.product_lock_states pls
        where pls.product_id = p.id and pls.is_locked = true
      )
    order by premium_rank, p.name
    limit greatest(coalesce(p_limit, 50), 0)
    offset greatest(coalesce(p_offset, 0), 0)
  ) result;

  return coalesce(v_products, '[]'::jsonb);
end;
$$;

create or replace function public.get_premium_stores()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stores jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', s.id))
  into v_stores
  from public.stores s
  where exists (
    select 1 from public.user_subscriptions us
    join public.subscription_plans sp on sp.id = us.plan_id
    where us.user_id = s.user_id and us.status = 'ACTIVE' and sp.code = 'PREMIUM'
  )
    and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
    and s.marketplace_removed_at is null
    and not public.is_owner_blocked(s.user_id);

  return coalesce(v_stores, '[]'::jsonb);
end;
$$;

notify pgrst, 'reload schema';
