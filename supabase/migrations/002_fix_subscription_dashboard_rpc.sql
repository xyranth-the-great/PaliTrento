-- Keep the dashboard RPC's subscription value consistently JSONB.
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

  v_entitlement := get_or_create_entitlement(p_user_id);
  select * into v_locks from get_user_product_locks_summary(p_user_id);

  select array_agg(fp) into v_promos
  from featured_promotions fp
  join stores s on s.id = fp.store_id
  where s.user_id = p_user_id
    and fp.status = 'ACTIVE'
    and fp.expires_at > now();

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
