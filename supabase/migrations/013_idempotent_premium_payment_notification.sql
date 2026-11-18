-- Make Premium renewals safe when the subscription already has a
-- PAYMENT_CONFIRMED notification. The notification uniqueness constraint
-- must not prevent the payment activation transaction from completing.
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

  -- Queue confirmation notification. A duplicate should not roll back activation.
  insert into notification_queue (user_id, type, title, message, priority, related_entity_type, related_entity_id)
  values (p_user_id, 'PAYMENT_CONFIRMED', 'Payment Confirmed',
          format('Your %s subscription is now active until %s', v_plan.name, to_char(v_period_end, 'Mon DD, YYYY')),
          'NORMAL', 'SUBSCRIPTION', v_sub.id)
  on conflict do nothing;

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

notify pgrst, 'reload schema';
