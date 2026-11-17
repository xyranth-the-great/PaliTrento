-- ============================================================
-- Subscription & Product Listing System (UPDATED per Final Requirements)
-- Run in Supabase: SQL Editor > New query > paste > Run
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. SUBSCRIPTION PLANS
-- ============================================================
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                    -- 'FREE', 'PREMIUM'
  name text not null,
  price_monthly_cents integer not null default 0,  -- 0 for FREE, 4900 for PREMIUM (₱49)
  free_listing_quota integer not null default 15,  -- 15 for FREE, -1 for unlimited (PREMIUM)
  featured_promo_price_cents integer not null default 1000,  -- ₱10/week for FREE, 0 for PREMIUM (included)
  priority_search_boost integer not null default 0,  -- 0 for FREE, 10 for PREMIUM
  visual_badge text not null default 'FREE',    -- 'FREE', 'PREMIUM'
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Insert default plans (UPDATED per Final Requirements)
insert into subscription_plans (code, name, price_monthly_cents, free_listing_quota, featured_promo_price_cents, priority_search_boost, visual_badge)
values
  ('FREE', 'Free Plan', 0, 15, 1000, 0, 'FREE'),
  ('PREMIUM', 'Premium Plan', 4900, -1, 0, 10, 'PREMIUM')
on conflict (code) do update set
  name = excluded.name,
  price_monthly_cents = excluded.price_monthly_cents,
  free_listing_quota = excluded.free_listing_quota,
  featured_promo_price_cents = excluded.featured_promo_price_cents,
  priority_search_boost = excluded.priority_search_boost,
  visual_badge = excluded.visual_badge,
  is_active = excluded.is_active;

-- ============================================================
-- 2. USER SUBSCRIPTIONS
-- ============================================================
create table if not exists user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  grace_period_ends_at timestamptz,
  cancelled_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)  -- one active subscription per user
);

create index if not exists user_subscriptions_user_id_idx on user_subscriptions(user_id);
create index if not exists user_subscriptions_status_idx on user_subscriptions(status);
create index if not exists user_subscriptions_period_end_idx on user_subscriptions(current_period_end);

-- ============================================================
-- 3. PRODUCT LISTING ENTITLEMENTS (lifetime free allowance + per-period paid unlocks)
-- ============================================================
-- Free listings: 15 lifetime allowance per business account
-- Paid listings: tracked per subscription period (reset on renewal)
-- Premium: unlimited (free_listing_quota = -1)
-- subscription_id is NULL for Free plan users (no subscription)
create table if not exists product_listing_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references user_subscriptions(id) on delete set null,
  period_start date not null,
  period_end date not null,
  lifetime_free_listings_used integer not null default 0,  -- lifetime counter (never resets)
  paid_listings_count integer not null default 0,         -- resets each period
  total_listings_allowed integer not null,  -- computed: free_quota + paid_unlocks for current period
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index if not exists product_listing_entitlements_user_idx on product_listing_entitlements(user_id);
create index if not exists product_listing_entitlements_subscription_idx on product_listing_entitlements(subscription_id);
create index if not exists product_listing_entitlements_period_idx on product_listing_entitlements(period_start, period_end);

-- ============================================================
-- 4. FEATURED PROMOTIONS (Featured Store promotions)
-- ============================================================
create table if not exists featured_promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references user_subscriptions(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'CANCELLED')),
  price_paid_cents integer not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  payment_reference text,
  created_at timestamptz not null default now()
);

create index if not exists featured_promotions_store_status_idx on featured_promotions(store_id, status);
create index if not exists featured_promotions_user_status_idx on featured_promotions(user_id, status);
create index if not exists featured_promotions_expires_idx on featured_promotions(expires_at) where status = 'ACTIVE';
create index if not exists featured_promotions_subscription_idx on featured_promotions(subscription_id);

-- ============================================================
-- 5. PRODUCT LOCK STATES (for grace period locking)
-- ============================================================
create table if not exists product_lock_states (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lock_reason text not null check (lock_reason in ('GRACE_PERIOD', 'UNPAID_LISTING', 'SUBSCRIPTION_EXPIRED')),
  locked_at timestamptz not null default now(),
  unlock_price_cents integer not null default 100,  -- ₱1 per product
  bulk_unlock_batch_id uuid,
  is_locked boolean not null default true,
  unlocked_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now()
);

create index if not exists product_lock_states_store_locked_idx on product_lock_states(store_id, is_locked);
create index if not exists product_lock_states_product_locked_idx on product_lock_states(product_id, is_locked);
create index if not exists product_lock_states_user_locked_idx on product_lock_states(user_id, is_locked);
create index if not exists product_lock_states_batch_idx on product_lock_states(bulk_unlock_batch_id);

-- ============================================================
-- 6. SUBSCRIPTION EVENTS (audit log)
-- ============================================================
create table if not exists subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references user_subscriptions(id) on delete set null,
  event_type text not null check (event_type in (
    'CREATED', 'RENEWED', 'EXPIRED', 'GRACE_STARTED', 'GRACE_ENDED',
    'CANCELLED', 'PLAN_CHANGED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED',
    'FEATURED_PROMO_STARTED', 'FEATURED_PROMO_EXPIRED', 'FEATURED_PROMO_CANCELLED',
    'PRODUCTS_LOCKED', 'PRODUCTS_UNLOCKED', 'BULK_UNLOCK'
  )),
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_user_idx on subscription_events(user_id, created_at desc);
create index if not exists subscription_events_subscription_idx on subscription_events(subscription_id, created_at desc);
create index if not exists subscription_events_type_idx on subscription_events(event_type, created_at desc);

-- ============================================================
-- 7. NOTIFICATION QUEUE
-- ============================================================
create table if not exists notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'SUBSCRIPTION_EXPIRING', 'GRACE_PERIOD_STARTED', 'GRACE_PERIOD_ENDING',
    'PRODUCTS_LOCKED', 'FEATURED_PROMO_EXPIRING', 'FEATURED_PROMO_EXPIRED',
    'SUBSCRIPTION_RENEWED', 'PAYMENT_CONFIRMED'
  )),
  title text not null,
  message text not null,
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED', 'READ')),
  related_entity_type text check (related_entity_type in ('SUBSCRIPTION', 'FEATURED_PROMO', 'PRODUCT_LOCK')),
  related_entity_id uuid,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, type, related_entity_type, related_entity_id)
);

create index if not exists notification_queue_user_status_idx on notification_queue(user_id, status, scheduled_for);
create index if not exists notification_queue_scheduled_idx on notification_queue(scheduled_for) where status = 'PENDING';
create index if not exists notification_queue_entity_idx on notification_queue(related_entity_type, related_entity_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- subscription_plans: public read (for pricing display)
alter table subscription_plans enable row level security;
drop policy if exists "public read subscription plans" on subscription_plans;
create policy "public read subscription plans" on subscription_plans
  for select to anon, authenticated
  using (is_active = true);

-- user_subscriptions: owner read/write
alter table user_subscriptions enable row level security;
drop policy if exists "owner read own subscription" on user_subscriptions;
create policy "owner read own subscription" on user_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "owner insert own subscription" on user_subscriptions;
create policy "owner insert own subscription" on user_subscriptions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "owner update own subscription" on user_subscriptions;
create policy "owner update own subscription" on user_subscriptions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- product_listing_entitlements: owner read
alter table product_listing_entitlements enable row level security;
drop policy if exists "owner read own entitlements" on product_listing_entitlements;
create policy "owner read own entitlements" on product_listing_entitlements
  for select to authenticated
  using (auth.uid() = user_id);

-- featured_promotions: owner read, public read active for store display
alter table featured_promotions enable row level security;
drop policy if exists "owner read own featured promos" on featured_promotions;
create policy "owner read own featured promos" on featured_promotions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "public read active featured promos" on featured_promotions;
create policy "public read active featured promos" on featured_promotions
  for select to anon, authenticated
  using (status = 'ACTIVE' and expires_at > now());

-- product_lock_states: owner read
alter table product_lock_states enable row level security;
drop policy if exists "owner read own product locks" on product_lock_states;
create policy "owner read own product locks" on product_lock_states
  for select to authenticated
  using (auth.uid() = user_id);

-- subscription_events: owner read
alter table subscription_events enable row level security;
drop policy if exists "owner read own subscription events" on subscription_events;
create policy "owner read own subscription events" on subscription_events
  for select to authenticated
  using (auth.uid() = user_id);

-- notification_queue: owner read/update
alter table notification_queue enable row level security;
drop policy if exists "owner read own notifications" on notification_queue;
create policy "owner read own notifications" on notification_queue
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "owner update own notifications" on notification_queue;
create policy "owner update own notifications" on notification_queue
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get user's current active subscription
create or replace function get_user_subscription(p_user_id uuid)
returns setof user_subscriptions language plpgsql security definer set search_path = public as $$
begin
  return query
  select * from user_subscriptions
  where user_id = p_user_id
    and status in ('ACTIVE', 'PAST_DUE')
  order by current_period_end desc
  limit 1;
end; $$;

-- Get user's current plan
create or replace function get_user_plan(p_user_id uuid)
returns subscription_plans language plpgsql security definer set search_path = public as $$
declare
  v_plan subscription_plans;
  v_sub user_subscriptions;
begin
  select * into v_sub from get_user_subscription(p_user_id) limit 1;
  if v_sub is not null then
    select * into v_plan from subscription_plans where id = v_sub.plan_id;
    return v_plan;
  end if;
  -- Default to FREE plan
  select * into v_plan from subscription_plans where code = 'FREE' limit 1;
  return v_plan;
end; $$;

-- Get current entitlement for user (creates if not exists for current period)
-- Lifetime free listings tracked separately from per-period paid listings
create or replace function get_or_create_entitlement(p_user_id uuid)
returns product_listing_entitlements language plpgsql security definer set search_path = public as $$
declare
  v_sub user_subscriptions;
  v_plan subscription_plans;
  v_entitlement product_listing_entitlements;
  v_period_start date;
  v_period_end date;
  v_free_quota integer;
  v_lifetime_free_used integer;
begin
  select * into v_sub from get_user_subscription(p_user_id) limit 1;

  if v_sub is null then
    -- No subscription, use FREE plan defaults
    v_period_start := date_trunc('month', now())::date;
    v_period_end := (v_period_start + interval '1 month - 1 day')::date;
    v_free_quota := 15;
  else
    v_period_start := v_sub.current_period_start::date;
    v_period_end := v_sub.current_period_end::date;
    select * into v_plan from subscription_plans where id = v_sub.plan_id;
    v_free_quota := v_plan.free_listing_quota;
  end if;

  -- Try to get existing entitlement for current period
  select * into v_entitlement
  from product_listing_entitlements
  where user_id = p_user_id and period_start = v_period_start
  limit 1;

  if v_entitlement is null then
    -- Create new entitlement: get lifetime free used from most recent entitlement
    select coalesce(lifetime_free_listings_used, 0) into v_lifetime_free_used
    from product_listing_entitlements
    where user_id = p_user_id
    order by period_start desc
    limit 1;

    -- Create new entitlement for current period
    -- subscription_id can be NULL for Free plan users
    insert into product_listing_entitlements (user_id, subscription_id, period_start, period_end, total_listings_allowed, lifetime_free_listings_used)
    values (p_user_id, v_sub.id, v_period_start, v_period_end,
            case when v_free_quota = -1 then 999999 else v_free_quota end,
            v_lifetime_free_used)
    returning * into v_entitlement;
  end if;

  return v_entitlement;
end; $$;

-- Check if user can add a product (has free quota or paid unlocks available)
-- Free tier: 15 lifetime free listings, then ₱1 each
-- Premium: unlimited
create or replace function can_user_add_product(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_entitlement product_listing_entitlements;
  v_plan subscription_plans;
  v_sub user_subscriptions;
  v_lifetime_free_used integer;
  v_paid_this_period integer;
  v_total_allowed integer;
begin
  select * into v_sub from get_user_subscription(p_user_id) limit 1;

  if v_sub is null then
    -- No subscription, check free tier (lifetime free listings)
    v_entitlement := get_or_create_entitlement(p_user_id);
    return v_entitlement.lifetime_free_listings_used < 15;
  end if;

  select * into v_plan from subscription_plans where id = v_sub.plan_id;

  if v_plan.free_listing_quota = -1 then
    -- Premium: unlimited
    return true;
  end if;

  v_entitlement := get_or_create_entitlement(p_user_id);
  v_lifetime_free_used := v_entitlement.lifetime_free_listings_used;
  v_paid_this_period := v_entitlement.paid_listings_count;
  v_total_allowed := v_entitlement.total_listings_allowed;

  -- Can add if: still has lifetime free listings remaining, or has paid unlocks available
  return (v_lifetime_free_used < 15) or (v_paid_this_period < v_total_allowed - 15);
end; $$;

-- Record a product listing (consumes lifetime free quota or paid unlock)
create or replace function record_product_listing(p_user_id uuid, p_is_paid boolean default false)
returns product_listing_entitlements language plpgsql security definer set search_path = public as $$
declare
  v_entitlement product_listing_entitlements;
begin
  v_entitlement := get_or_create_entitlement(p_user_id);

  if p_is_paid then
    update product_listing_entitlements
    set paid_listings_count = paid_listings_count + 1,
        total_listings_allowed = total_listings_allowed + 1,
        updated_at = now()
    where id = v_entitlement.id
    returning * into v_entitlement;
  else
    update product_listing_entitlements
    set lifetime_free_listings_used = lifetime_free_listings_used + 1,
        updated_at = now()
    where id = v_entitlement.id
    returning * into v_entitlement;
  end if;

  return v_entitlement;
end; $$;

-- Lock all products for a store (called when subscription expires/grace period starts)
create or replace function lock_store_products(p_store_id uuid, p_user_id uuid, p_reason text default 'GRACE_PERIOD')
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  v_lock_id uuid;
begin
  for v_lock_id in
    select id from products where store_id = p_store_id and in_stock = true
  loop
    insert into product_lock_states (product_id, store_id, user_id, lock_reason, unlock_price_cents)
    values (v_lock_id, p_store_id, p_user_id, p_reason, 100)  -- ₱1 per product
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;

  -- Log event
  insert into subscription_events (user_id, event_type, details)
  values (p_user_id, 'PRODUCTS_LOCKED', jsonb_build_object(
    'store_id', p_store_id,
    'reason', p_reason,
    'products_locked', v_count
  ));

  -- Queue notification
  insert into notification_queue (user_id, type, title, message, priority, related_entity_type, related_entity_id)
  values (p_user_id, 'PRODUCTS_LOCKED', 'Products Locked',
          format('%s products have been locked due to %s', v_count, p_reason),
          'HIGH', 'PRODUCT_LOCK', p_store_id);

  return v_count;
end; $$;

-- Unlock a single product (₱1 per product)
create or replace function unlock_product(p_product_id uuid, p_user_id uuid, p_payment_reference text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_lock product_lock_states;
begin
  select * into v_lock
  from product_lock_states
  where product_id = p_product_id and user_id = p_user_id and is_locked = true
  limit 1;

  if v_lock is null then
    return false;
  end if;

  update product_lock_states
  set is_locked = false,
      unlocked_at = now(),
      payment_reference = p_payment_reference
  where id = v_lock.id;

  -- Log event
  insert into subscription_events (user_id, event_type, details)
  values (p_user_id, 'PRODUCTS_UNLOCKED', jsonb_build_object(
    'product_id', p_product_id,
    'lock_id', v_lock.id,
    'payment_reference', p_payment_reference
  ));

  return true;
end; $$;

-- Bulk unlock products (₱1 per product)
create or replace function bulk_unlock_products(p_product_ids uuid[], p_user_id uuid, p_payment_reference text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_count integer := 0;
begin
  update product_lock_states
  set is_locked = false,
      unlocked_at = now(),
      payment_reference = p_payment_reference,
      bulk_unlock_batch_id = v_batch_id
  where product_id = any(p_product_ids)
    and user_id = p_user_id
    and is_locked = true;

  get diagnostics v_count = row_count;

  -- Log event
  insert into subscription_events (user_id, event_type, details)
  values (p_user_id, 'BULK_UNLOCK', jsonb_build_object(
    'product_ids', p_product_ids,
    'batch_id', v_batch_id,
    'count', v_count,
    'payment_reference', p_payment_reference
  ));

  return v_count;
end; $$;

-- Process subscription expiration (called by cron)
create or replace function process_subscription_expirations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_sub record;
  v_count integer := 0;
  v_store record;
begin
  -- Find expired subscriptions that haven't entered grace period
  for v_sub in
    select * from user_subscriptions
    where status = 'ACTIVE'
      and current_period_end < now()
      and (grace_period_ends_at is null or grace_period_ends_at < now())
  loop
    -- Start 5-day grace period
    update user_subscriptions
    set status = 'PAST_DUE',
        grace_period_ends_at = now() + interval '5 days',
        updated_at = now()
    where id = v_sub.id;

    -- Lock products for all user's stores
    for v_store in
      select id from stores where user_id = v_sub.user_id
    loop
      perform lock_store_products(v_store.id, v_sub.user_id, 'GRACE_PERIOD');
    end loop;

    -- Log event
    insert into subscription_events (user_id, subscription_id, event_type, details)
    values (v_sub.user_id, v_sub.id, 'GRACE_STARTED', jsonb_build_object(
      'grace_ends_at', now() + interval '5 days'
    ));

    -- Queue notification
    insert into notification_queue (user_id, type, title, message, priority, scheduled_for, related_entity_type, related_entity_id)
    values (v_sub.user_id, 'GRACE_PERIOD_STARTED', 'Grace Period Started',
            'Your subscription has expired. You have 5 days to renew before your products are permanently locked.',
            'URGENT', now() + interval '1 hour', 'SUBSCRIPTION', v_sub.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

-- Process grace period endings (called by cron)
create or replace function process_grace_period_endings()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_sub record;
  v_count integer := 0;
  v_store record;
begin
  -- Find subscriptions where grace period has ended
  for v_sub in
    select * from user_subscriptions
    where status = 'PAST_DUE'
      and grace_period_ends_at < now()
  loop
    -- Mark as expired
    update user_subscriptions
    set status = 'EXPIRED',
        updated_at = now()
    where id = v_sub.id;

    -- Lock products with SUBSCRIPTION_EXPIRED reason (permanent lock until renewed)
    for v_store in
      select id from stores where user_id = v_sub.user_id
    loop
      perform lock_store_products(v_store.id, v_sub.user_id, 'SUBSCRIPTION_EXPIRED');
    end loop;

    -- Log event
    insert into subscription_events (user_id, subscription_id, event_type, details)
    values (v_sub.user_id, v_sub.id, 'GRACE_ENDED', jsonb_build_object(
      'expired_at', now()
    ));

    -- Queue notification
    insert into notification_queue (user_id, type, title, message, priority, related_entity_type, related_entity_id)
    values (v_sub.user_id, 'GRACE_PERIOD_ENDING', 'Grace Period Ended',
            'Your grace period has ended. Your products are now locked. Renew your subscription to unlock them.',
            'URGENT', 'SUBSCRIPTION', v_sub.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

-- Process featured promotion expirations (called by cron)
create or replace function process_featured_promo_expirations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_promo record;
  v_count integer := 0;
begin
  -- Find expired featured promotions
  for v_promo in
    select * from featured_promotions
    where status = 'ACTIVE'
      and expires_at < now()
  loop
    update featured_promotions
    set status = 'EXPIRED'
    where id = v_promo.id;

    -- Log event
    insert into subscription_events (user_id, subscription_id, event_type, details)
    values (v_promo.user_id, v_promo.subscription_id, 'FEATURED_PROMO_EXPIRED', jsonb_build_object(
      'promo_id', v_promo.id,
      'store_id', v_promo.store_id
    ));

    -- Queue notification
    insert into notification_queue (user_id, type, title, message, priority, related_entity_type, related_entity_id)
    values (v_promo.user_id, 'FEATURED_PROMO_EXPIRED', 'Featured Promotion Ended',
            'Your Featured Store promotion has expired. Renew to maintain premium placement.',
            'NORMAL', 'FEATURED_PROMO', v_promo.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

-- Send pending notifications (called by cron)
create or replace function send_pending_notifications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_notif record;
  v_count integer := 0;
  v_advisory_id uuid;
  v_category text;
  v_priority text;
begin
  for v_notif in
    select * from notification_queue
    where status = 'PENDING'
      and scheduled_for <= now()
    order by priority desc, scheduled_for
    limit 100
  loop
    -- Map notification type to advisory category and priority
    v_category := case v_notif.type
      when 'SUBSCRIPTION_EXPIRING' then 'PRICE_CAP'
      when 'GRACE_PERIOD_STARTED' then 'ANNOUNCEMENT'
      when 'GRACE_PERIOD_ENDING' then 'ANNOUNCEMENT'
      when 'PRODUCTS_LOCKED' then 'ANNOUNCEMENT'
      when 'FEATURED_PROMO_EXPIRING' then 'ANNOUNCEMENT'
      when 'FEATURED_PROMO_EXPIRED' then 'ANNOUNCEMENT'
      when 'SUBSCRIPTION_RENEWED' then 'ANNOUNCEMENT'
      when 'PAYMENT_CONFIRMED' then 'ANNOUNCEMENT'
      else 'GENERAL'
    end;

    v_priority := case v_notif.priority
      when 'URGENT' then 'critical'
      when 'HIGH' then 'high'
      when 'NORMAL' then 'normal'
      when 'LOW' then 'low'
      else 'normal'
    end;

    -- Create advisory for in-app real-time notification
    -- recipient_id ensures only the target user receives it
    insert into advisories (title, body, category, priority, recipient_id, published_at, created_by)
    values (v_notif.title, v_notif.message, v_category, v_priority, v_notif.user_id, now(), v_notif.user_id)
    returning id into v_advisory_id;

    -- Mark notification as sent
    update notification_queue
    set status = 'SENT', sent_at = now()
    where id = v_notif.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

-- Send upcoming expiration warnings (called by cron daily)
create or replace function send_expiration_warnings()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_sub record;
  v_promo record;
  v_count integer := 0;
begin
  -- Subscriptions expiring in 3 days
  for v_sub in
    select * from user_subscriptions
    where status = 'ACTIVE'
      and current_period_end between now() + interval '2 days' and now() + interval '4 days'
  loop
    insert into notification_queue (user_id, type, title, message, priority, scheduled_for, related_entity_type, related_entity_id)
    values (v_sub.user_id, 'SUBSCRIPTION_EXPIRING', 'Subscription Expiring Soon',
            'Your Premium subscription expires in 3 days. Renew now to keep unlimited listings and premium benefits.',
            'HIGH', now(), 'SUBSCRIPTION', v_sub.id)
    on conflict do nothing;

    v_count := v_count + 1;
  end loop;

  -- Featured promos expiring in 1 day
  for v_promo in
    select * from featured_promotions
    where status = 'ACTIVE'
      and expires_at between now() + interval '20 hours' and now() + interval '28 hours'
  loop
    insert into notification_queue (user_id, type, title, message, priority, scheduled_for, related_entity_type, related_entity_id)
    values (v_promo.user_id, 'FEATURED_PROMO_EXPIRING', 'Featured Promotion Expiring Soon',
            'Your Featured Store promotion expires tomorrow. Renew to maintain premium placement.',
            'NORMAL', now(), 'FEATURED_PROMO', v_promo.id)
    on conflict do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

-- Get featured stores for public display (with priority boost for premium)
create or replace function get_featured_stores(p_limit integer default 10)
returns setof stores language plpgsql security definer set search_path = public as $$
begin
  return query
  select s.* from stores s
  join featured_promotions fp on fp.store_id = s.id
  where fp.status = 'ACTIVE'
    and fp.expires_at > now()
    and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
  order by
    case
      when exists (
        select 1 from user_subscriptions us
        join subscription_plans sp on sp.id = us.plan_id
        where us.user_id = s.user_id
          and us.status = 'ACTIVE'
          and sp.code = 'PREMIUM'
      ) then 0 else 1 end,
    fp.started_at desc
  limit p_limit;
end; $$;

-- Check if store has active featured promotion
create or replace function store_has_active_featured_promo(p_store_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from featured_promotions
  where store_id = p_store_id
    and status = 'ACTIVE'
    and expires_at > now();
  return v_count > 0;
end; $$;

-- Get user's product lock summary
create or replace function get_user_product_locks_summary(p_user_id uuid)
returns table (
  total_locked integer,
  grace_period_locked integer,
  unpaid_listing_locked integer,
  subscription_expired_locked integer
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    count(*)::integer as total_locked,
    count(*) filter (where lock_reason = 'GRACE_PERIOD')::integer as grace_period_locked,
    count(*) filter (where lock_reason = 'UNPAID_LISTING')::integer as unpaid_listing_locked,
    count(*) filter (where lock_reason = 'SUBSCRIPTION_EXPIRED')::integer as subscription_expired_locked
  from product_lock_states
  where user_id = p_user_id and is_locked = true;
end; $$;

-- Check if product is locked (for public visibility)
create or replace function is_product_locked(p_product_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_locked boolean;
begin
  select is_locked into v_locked
  from product_lock_states
  where product_id = p_product_id and is_locked = true
  limit 1;
  return coalesce(v_locked, false);
end; $$;