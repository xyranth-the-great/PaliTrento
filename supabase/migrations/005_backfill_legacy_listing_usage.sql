-- Seed free listing usage for products created before the entitlement counter
-- existed. This is performed once per user's first entitlement, then normal
-- product creation continues to use record_product_listing().
alter table product_listing_entitlements
  add column if not exists legacy_listings_synced boolean not null default false;

create or replace function get_or_create_entitlement(p_user_id uuid)
returns product_listing_entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub user_subscriptions;
  v_plan subscription_plans;
  v_entitlement product_listing_entitlements;
  v_period_start date;
  v_period_end date;
  v_free_quota integer;
  v_lifetime_free_used integer := 0;
  v_has_prior_entitlement boolean := false;
  v_existing_product_count integer := 0;
begin
  select * into v_sub from get_user_subscription(p_user_id) limit 1;

  if v_sub is null then
    v_period_start := date_trunc('month', now())::date;
    v_period_end := (v_period_start + interval '1 month - 1 day')::date;
    v_free_quota := 15;
  else
    v_period_start := v_sub.current_period_start::date;
    v_period_end := v_sub.current_period_end::date;
    select * into v_plan from subscription_plans where id = v_sub.plan_id;
    v_free_quota := v_plan.free_listing_quota;
  end if;

  select * into v_entitlement
  from product_listing_entitlements
  where user_id = p_user_id and period_start = v_period_start
  limit 1;

  if v_entitlement is null then
    select exists (
      select 1 from product_listing_entitlements where user_id = p_user_id
    ) into v_has_prior_entitlement;

    if v_has_prior_entitlement then
      select coalesce(lifetime_free_listings_used, 0) into v_lifetime_free_used
      from product_listing_entitlements
      where user_id = p_user_id
      order by period_start desc
      limit 1;
    else
      select count(*)::integer into v_existing_product_count
      from products p
      join stores s on s.id = p.store_id
      where s.user_id = p_user_id;
      v_lifetime_free_used := least(15, v_existing_product_count);
    end if;

    insert into product_listing_entitlements (
      user_id, subscription_id, period_start, period_end,
      total_listings_allowed, lifetime_free_listings_used, legacy_listings_synced
    ) values (
      p_user_id, v_sub.id, v_period_start, v_period_end,
      case when v_free_quota = -1 then 999999 else v_free_quota end,
      coalesce(v_lifetime_free_used, 0), true
    )
    returning * into v_entitlement;
  elsif not v_entitlement.legacy_listings_synced then
    select exists (
      select 1 from product_listing_entitlements
      where user_id = p_user_id and id <> v_entitlement.id
    ) into v_has_prior_entitlement;

    if not v_has_prior_entitlement then
      select count(*)::integer into v_existing_product_count
      from products p
      join stores s on s.id = p.store_id
      where s.user_id = p_user_id;

      update product_listing_entitlements
      set lifetime_free_listings_used = greatest(
            coalesce(lifetime_free_listings_used, 0),
            least(15, v_existing_product_count)
          ),
          legacy_listings_synced = true,
          updated_at = now()
      where id = v_entitlement.id
      returning * into v_entitlement;
    else
      update product_listing_entitlements
      set legacy_listings_synced = true,
          updated_at = now()
      where id = v_entitlement.id
      returning * into v_entitlement;
    end if;
  end if;

  return v_entitlement;
end;
$$;
