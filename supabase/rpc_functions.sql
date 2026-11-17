-- ============================================================
-- RPC Functions for Subscription System (UPDATED per Final Requirements)
-- Run in Supabase SQL Editor
-- ============================================================

-- Verify payment and activate subscription (called from frontend after demo payment)
create or replace function verify_payment_and_activate_subscription(
  p_user_id uuid,
  p_plan_code text,
  p_payment_reference text,
  p_period_days integer default 30
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_plan subscription_plans;
  v_sub user_subscriptions;
  v_period_start timestamptz := now();
  v_period_end timestamptz := now() + (p_period_days || ' days')::interval;
  v_free_quota integer;
  v_lifetime_free_used integer := 0;
  v_result jsonb;
begin
  -- Get plan
  select * into v_plan from subscription_plans where code = p_plan_code and is_active = true limit 1;
  if v_plan is null then
    return jsonb_build_object('success', false, 'error', 'Invalid plan');
  end if;

  -- Check for existing subscription
  select * into v_sub from user_subscriptions where user_id = p_user_id limit 1;

  if v_sub is null then
    -- Create new subscription
    insert into user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end, payment_reference)
    values (p_user_id, v_plan.id, 'ACTIVE', v_period_start, v_period_end, p_payment_reference)
    returning * into v_sub;
  else
    -- Update existing subscription
    update user_subscriptions
    set plan_id = v_plan.id,
        status = 'ACTIVE',
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        grace_period_ends_at = null,
        cancelled_at = null,
        payment_reference = p_payment_reference,
        updated_at = now()
    where id = v_sub.id
    returning * into v_sub;
  end if;

  -- Create entitlement for new period (preserve lifetime free listings used)
  v_free_quota := v_plan.free_listing_quota;

  -- Get current lifetime free listings used to preserve
  select coalesce(lifetime_free_listings_used, 0) into v_lifetime_free_used
  from product_listing_entitlements
  where user_id = p_user_id
  order by period_start desc
  limit 1;

  insert into product_listing_entitlements (user_id, subscription_id, period_start, period_end, total_listings_allowed, lifetime_free_listings_used)
  values (p_user_id, v_sub.id, v_period_start::date, v_period_end::date,
          case when v_free_quota = -1 then 999999 else v_free_quota end,
          v_lifetime_free_used)
  on conflict (user_id, period_start) do update set
    subscription_id = excluded.subscription_id,
    period_end = excluded.period_end,
    total_listings_allowed = excluded.total_listings_allowed,
    -- lifetime_free_listings_used is preserved (not reset)
    paid_listings_count = 0,
    updated_at = now();

  -- Log event
  insert into subscription_events (user_id, subscription_id, event_type, details)
  values (p_user_id, v_sub.id, 'CREATED', jsonb_build_object(
    'plan_code', p_plan_code,
    'payment_reference', p_payment_reference,
    'period_end', v_period_end
  ));

  -- Queue confirmation notification
  insert into notification_queue (user_id, type, title, message, priority, related_entity_type, related_entity_id)
  values (p_user_id, 'PAYMENT_CONFIRMED', 'Payment Confirmed',
          format('Your %s subscription is now active until %s', v_plan.name, to_char(v_period_end, 'Mon DD, YYYY')),
          'NORMAL', 'SUBSCRIPTION', v_sub.id);

  -- Unlock any locked products due to grace period
  update product_lock_states
  set is_locked = false, unlocked_at = now(), payment_reference = p_payment_reference
  where user_id = p_user_id and is_locked = true and lock_reason in ('GRACE_PERIOD', 'SUBSCRIPTION_EXPIRED');

  v_result := jsonb_build_object(
    'success', true,
    'subscription', jsonb_build_object(
      'id', v_sub.id,
      'plan_code', p_plan_code,
      'plan_name', v_plan.name,
      'status', 'ACTIVE',
      'current_period_start', v_period_start,
      'current_period_end', v_period_end,
      'free_listing_quota', v_free_quota
    )
  );

  return v_result;
end; $$;

-- Verify payment and create featured promotion (Featured Store)
create or replace function verify_payment_and_create_featured_promo(
  p_user_id uuid,
  p_store_id uuid,
  p_payment_reference text,
  p_duration_days integer default 7
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_plan subscription_plans;
  v_sub user_subscriptions;
  v_promo featured_promotions;
  v_price_cents integer;
  v_started_at timestamptz := now();
  v_expires_at timestamptz := now() + (p_duration_days || ' days')::interval;
  v_result jsonb;
begin
  -- Verify store ownership
  if not exists (select 1 from stores where id = p_store_id and user_id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'Store not found or not owned by user');
  end if;

  -- Get user's plan for pricing
  select * into v_sub from get_user_subscription(p_user_id) limit 1;
  if v_sub is not null then
    select * into v_plan from subscription_plans where id = v_sub.plan_id;
    v_price_cents := v_plan.featured_promo_price_cents;
  else
    select * into v_plan from subscription_plans where code = 'FREE' limit 1;
    v_price_cents := v_plan.featured_promo_price_cents;
  end if;

  -- Cancel any existing active promo for this store
  update featured_promotions
  set status = 'CANCELLED'
  where store_id = p_store_id and status = 'ACTIVE';

  -- Create new featured promotion
  insert into featured_promotions (store_id, user_id, subscription_id, status, price_paid_cents, started_at, expires_at, payment_reference)
  values (p_store_id, p_user_id, v_sub.id, 'ACTIVE', v_price_cents, v_started_at, v_expires_at, p_payment_reference)
  returning * into v_promo;

  -- Log event
  insert into subscription_events (user_id, subscription_id, event_type, details)
  values (p_user_id, v_sub.id, 'FEATURED_PROMO_STARTED', jsonb_build_object(
    'promo_id', v_promo.id,
    'store_id', p_store_id,
    'price_paid_cents', v_price_cents,
    'expires_at', v_expires_at
  ));

  -- Queue notification
  insert into notification_queue (user_id, type, title, message, priority, scheduled_for, related_entity_type, related_entity_id)
  values (p_user_id, 'FEATURED_PROMO_EXPIRING', 'Featured Promotion Active',
          format('Your store is now featured until %s', to_char(v_expires_at, 'Mon DD, YYYY')),
          'NORMAL', v_expires_at - interval '1 day', 'FEATURED_PROMO', v_promo.id);

  v_result := jsonb_build_object(
    'success', true,
    'promotion', jsonb_build_object(
      'id', v_promo.id,
      'store_id', p_store_id,
      'price_paid_cents', v_price_cents,
      'started_at', v_started_at,
      'expires_at', v_expires_at,
      'status', 'ACTIVE'
    )
  );

  return v_result;
end; $$;

-- Verify payment and unlock products (individual or bulk)
create or replace function verify_payment_and_unlock_products(
  p_user_id uuid,
  p_product_ids uuid[],
  p_payment_reference text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_total_price_cents integer;
  v_result jsonb;
begin
  if array_length(p_product_ids, 1) is null or array_length(p_product_ids, 1) = 0 then
    return jsonb_build_object('success', false, 'error', 'No products specified');
  end if;

  v_count := array_length(p_product_ids, 1);
  -- Bulk unlock and persist each paid product so it remains available if
  -- Premium is later cancelled or expires.
  v_count := bulk_unlock_products(p_product_ids, p_user_id, p_payment_reference);
  if v_count = 0 then
    return jsonb_build_object('success', false, 'error', 'No locked products were found');
  end if;

  update products p
  set is_paid_listing = true
  where p.id = any(p_product_ids)
    and exists (
      select 1 from product_lock_states pls
      where pls.product_id = p.id
        and pls.user_id = p_user_id
        and pls.is_locked = false
        and pls.payment_reference = p_payment_reference
    );

  for i in 1..v_count loop
    perform record_product_listing(p_user_id, true);
  end loop;

  v_total_price_cents := v_count * 100; -- ₱1 per product

  v_result := jsonb_build_object(
    'success', true,
    'unlocked_count', v_count,
    'total_price_cents', v_total_price_cents,
    'payment_reference', p_payment_reference
  );

  return v_result;
end; $$;

-- Get dashboard data for subscription management
create or replace function get_subscription_dashboard_data(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sub user_subscriptions;
  v_plan subscription_plans;
  v_entitlement product_listing_entitlements;
  v_locks record;
  v_promos featured_promotions[];
  v_stores jsonb;
  v_subscription jsonb;
  v_result jsonb;
begin
  -- Get subscription
  select * into v_sub from get_user_subscription(p_user_id) limit 1;

  if v_sub.id is not null then
    select * into v_plan from subscription_plans where id = v_sub.plan_id;
    v_subscription := jsonb_build_object(
      'id', v_sub.id,
      'plan_code', v_plan.code,
      'plan_name', v_plan.name,
      'price_monthly_cents', v_plan.price_monthly_cents,
      'status', v_sub.status,
      'current_period_start', v_sub.current_period_start,
      'current_period_end', v_sub.current_period_end,
      'grace_period_ends_at', v_sub.grace_period_ends_at,
      'is_premium', v_plan.code = 'PREMIUM'
    );
  else
    select * into v_plan from subscription_plans where code = 'FREE' limit 1;
  end if;

  -- Get current entitlement
  v_entitlement := get_or_create_entitlement(p_user_id);

  -- Get lock summary
  select * into v_locks from get_user_product_locks_summary(p_user_id);

  -- Get active featured promotions for user's stores
  select array_agg(fp) into v_promos
  from featured_promotions fp
  join stores s on s.id = fp.store_id
  where s.user_id = p_user_id
    and fp.status = 'ACTIVE'
    and fp.expires_at > now();

  -- Get user's stores
  select jsonb_agg(jsonb_build_object(
    'id', id,
    'business_name', business_name,
    'trn_code', trn_code,
    'verification_status', verification_status,
    'approval_status', approval_status,
    'has_featured_promo', store_has_active_featured_promo(id)
  )) into v_stores
  from stores where user_id = p_user_id;

  v_result := jsonb_build_object(
    'subscription', v_subscription,
    'plan_details', jsonb_build_object(
      'code', v_plan.code,
      'name', v_plan.name,
      'price_monthly_cents', v_plan.price_monthly_cents,
      'free_listing_quota', v_plan.free_listing_quota,
      'featured_promo_price_cents', v_plan.featured_promo_price_cents,
      'priority_search_boost', v_plan.priority_search_boost,
      'visual_badge', v_plan.visual_badge
    ),
    'entitlement', jsonb_build_object(
      'period_start', v_entitlement.period_start,
      'period_end', v_entitlement.period_end,
      'free_listings_used', v_entitlement.lifetime_free_listings_used,
      'paid_listings_count', v_entitlement.paid_listings_count,
      'total_listings_allowed', v_entitlement.total_listings_allowed,
      'remaining_free', greatest(0, case when v_plan.free_listing_quota = -1 then 999999 else v_plan.free_listing_quota end - v_entitlement.lifetime_free_listings_used),
      'can_add_free', case when v_plan.free_listing_quota = -1 then true else v_entitlement.lifetime_free_listings_used < v_plan.free_listing_quota end
    ),
    'locks', jsonb_build_object(
      'total_locked', v_locks.total_locked,
      'grace_period_locked', v_locks.grace_period_locked,
      'unpaid_listing_locked', v_locks.unpaid_listing_locked,
      'subscription_expired_locked', v_locks.subscription_expired_locked
    ),
    'featured_promotions', coalesce(v_promos, '{}'::featured_promotions[]),
    'stores', coalesce(v_stores, '[]'::jsonb)
  );

  return v_result;
end; $$;

-- Get public featured stores with store details (replaces featured products)
create or replace function get_public_featured_stores(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    from stores s
    cross join lateral (
      select exists (
        select 1 from user_subscriptions us
        join subscription_plans sp on sp.id = us.plan_id
        where us.user_id = s.user_id
          and us.status = 'ACTIVE'
          and sp.code = 'PREMIUM'
      ) as is_premium
    ) subscription_status
    left join lateral (
      select fp.id, fp.started_at, fp.expires_at, fp.price_paid_cents
      from featured_promotions fp
      where fp.store_id = s.id
        and fp.status = 'ACTIVE'
        and fp.expires_at > now()
      order by fp.started_at desc
      limit 1
    ) fp on true
    where (subscription_status.is_premium or fp.id is not null)
      and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
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
end; $$;

-- Search stores with premium priority boost
create or replace function search_stores_with_priority(
  p_query text default '',
  p_category text default '',
  p_barangay text default '',
  p_open_only boolean default false,
  p_verified_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stores jsonb;
  v_where text := '';
  v_order text := '';
begin
  -- Build WHERE clause
  if p_query <> '' then
    v_where := v_where || ' and (s.business_name ILIKE ' || quote_literal('%' || p_query || '%')
      || ' OR s.description ILIKE ' || quote_literal('%' || p_query || '%')
      || ' OR s.barangay ILIKE ' || quote_literal('%' || p_query || '%') || ')';
  end if;
  if p_category <> '' then
    v_where := v_where || ' and s.trade_category = ' || quote_literal(p_category);
  end if;
  if p_barangay <> '' then
    v_where := v_where || ' and s.barangay = ' || quote_literal(p_barangay);
  end if;
  if p_open_only then
    v_where := v_where || ' and is_store_open(s.id)';
  end if;
  if p_verified_only then
    v_where := v_where || ' and (s.verification_status = ''VERIFIED'' or s.approval_status = ''APPROVED'')';
  else
    v_where := v_where || ' and (s.verification_status = ''VERIFIED'' or s.approval_status = ''APPROVED'')';
  end if;

  -- Order: Premium stores first (with active featured promo), then by featured promo, then by name
  v_order := 'order by
    case when exists (
      select 1 from user_subscriptions us
      join subscription_plans sp on sp.id = us.plan_id
      where us.user_id = s.user_id
        and us.status = ''ACTIVE''
        and sp.code = ''PREMIUM''
    ) then 0 else 1 end,
    case when exists (
      select 1 from featured_promotions fp
      where fp.store_id = s.id
        and fp.status = ''ACTIVE''
        and fp.expires_at > now()
    ) then 0 else 1 end,
    s.business_name';

  execute format('
    select jsonb_agg(jsonb_build_object(
      ''id'', s.id,
      ''business_name'', s.business_name,
      ''trade_category'', s.trade_category,
      ''barangay'', s.barangay,
      ''storefront_image_url'', s.storefront_image_url,
      ''description'', s.description,
      ''verification_status'', s.verification_status,
      ''approval_status'', s.approval_status,
      ''trn_code'', s.trn_code,
      ''open_time'', s.open_time,
      ''close_time'', s.close_time,
      ''accepted_payments'', s.accepted_payments,
      ''is_premium'', exists (
        select 1 from user_subscriptions us
        join subscription_plans sp on sp.id = us.plan_id
        where us.user_id = s.user_id
          and us.status = ''ACTIVE''
          and sp.code = ''PREMIUM''
      ),
      ''has_featured_promo'', exists (
        select 1 from featured_promotions fp
        where fp.store_id = s.id
          and fp.status = ''ACTIVE''
          and fp.expires_at > now()
      )
    ))
    from stores s
    where 1=1 %s
    %s
    limit %s offset %s', v_where, v_order, p_limit, p_offset) into v_stores;

  return coalesce(v_stores, '[]'::jsonb);
end; $$;

-- Search products with premium priority boost
create or replace function search_products_with_priority(
  p_query text default '',
  p_category text default '',
  p_capped_only boolean default false,
  p_in_stock_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_products jsonb;
  v_where text := ' and (p.quantity is null or p.quantity > 0)';
  v_order text := '';
begin
  -- Build WHERE clause
  if p_query <> '' then
    v_where := v_where || ' and (p.name ILIKE ' || quote_literal('%' || p_query || '%')
      || ' OR p.category ILIKE ' || quote_literal('%' || p_query || '%') || ')';
  end if;
  if p_category <> '' then
    v_where := v_where || ' and p.category = ' || quote_literal(p_category);
  end if;
  if p_capped_only then
    v_where := v_where || ' and p.lgu_srp_ceiling is not null';
  end if;
  if p_in_stock_only then
    v_where := v_where || ' and p.in_stock = true';
  end if;

  -- Only products from verified/approved stores that are not locked
  v_where := v_where || ' and exists (
    select 1 from stores s where s.id = p.store_id
      and (s.verification_status = ''VERIFIED'' or s.approval_status = ''APPROVED'')
      and not exists (
        select 1 from product_lock_states pls where pls.product_id = p.id and pls.is_locked = true
      )
  )';

  -- Order: Premium store products first, then by featured promo, then by name
  v_order := 'order by
    case when exists (
      select 1 from user_subscriptions us
      join subscription_plans sp on sp.id = us.plan_id
      where us.user_id = s.user_id
        and us.status = ''ACTIVE''
        and sp.code = ''PREMIUM''
    ) then 0 else 1 end,
    p.name';

  execute format('
    select jsonb_agg(jsonb_build_object(
      ''id'', p.id,
      ''store_id'', p.store_id,
      ''name'', p.name,
      ''category'', p.category,
      ''unit'', p.unit,
      ''current_price'', p.current_price,
      ''lgu_srp_ceiling'', p.lgu_srp_ceiling,
      ''in_stock'', p.in_stock,
      ''quantity'', p.quantity,
      ''image_url'', p.image_url,
      ''featured_until'', p.featured_until,
      ''created_at'', p.created_at,
      ''store_business_name'', s.business_name,
      ''store_trn_code'', s.trn_code,
      ''store_barangay'', s.barangay,
      ''store_image_url'', s.storefront_image_url,
      ''is_premium_store'', exists (
        select 1 from user_subscriptions us2
        join subscription_plans sp2 on sp2.id = us2.plan_id
        where us2.user_id = s.user_id
          and us2.status = ''ACTIVE''
          and sp2.code = ''PREMIUM''
      )
    ))
    from products p
    join stores s on s.id = p.store_id
    where 1=1 %s
    %s
    limit %s offset %s', v_where, v_order, p_limit, p_offset) into v_products;

  return coalesce(v_products, '[]'::jsonb);
end; $$;

-- Helper function to check if store is open
create or replace function is_store_open(p_store_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_store stores;
  v_now time := now()::time;
begin
  select * into v_store from stores where id = p_store_id limit 1;
  if v_store is null then return false; end if;
  if v_store.open_time is null or v_store.close_time is null then return true; end if;
  if v_store.open_time <= v_store.close_time then
    return v_now >= v_store.open_time and v_now <= v_store.close_time;
  else
    -- Overnight hours (e.g., 20:00 - 04:00)
    return v_now >= v_store.open_time or v_now <= v_store.close_time;
  end if;
end; $$;

-- Get subscription dashboard data for a specific store (for business owner dashboard)
create or replace function get_store_subscription_data(p_store_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_store stores;
  v_user_id uuid;
  v_result jsonb;
begin
  select * into v_store from stores where id = p_store_id limit 1;
  if v_store is null then
    return jsonb_build_object('success', false, 'error', 'Store not found');
  end if;

  v_user_id := v_store.user_id;
  v_result := get_subscription_dashboard_data(v_user_id);

  return jsonb_build_object('success', true, 'data', v_result);
end; $$;

-- Get all stores with active Premium subscription (for efficient premium status lookup)
create or replace function get_premium_stores()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stores jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', s.id))
  into v_stores
  from stores s
  where exists (
    select 1 from user_subscriptions us
    join subscription_plans sp on sp.id = us.plan_id
    where us.user_id = s.user_id
      and us.status = 'ACTIVE'
      and sp.code = 'PREMIUM'
  )
    and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED');

  return coalesce(v_stores, '[]'::jsonb);
end; $$;
