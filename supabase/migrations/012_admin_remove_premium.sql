create or replace function public.admin_remove_premium(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.user_subscriptions;
  v_plan_code text;
  v_free_period_start date := date_trunc('month', now())::date;
  v_product_count integer := 0;
begin
  if p_actor_id is null or p_target_user_id is null or p_actor_id = p_target_user_id then
    raise exception 'A different target account is required';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin'
      and (account_status = 'active' or
        (account_status = 'suspended' and suspended_until <= now()))
  ) then
    raise exception 'Only an active administrator can remove Premium';
  end if;

  select us.* into v_subscription
  from public.user_subscriptions us
  where us.user_id = p_target_user_id
    and us.status in ('ACTIVE', 'PAST_DUE')
  for update of us;

  if not found then
    raise exception 'This account does not have active Premium';
  end if;

  select sp.code into v_plan_code
  from public.subscription_plans sp
  where sp.id = v_subscription.plan_id;

  if v_plan_code <> 'PREMIUM' then
    raise exception 'This account does not have active Premium';
  end if;

  update public.user_subscriptions
  set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
  where id = v_subscription.id;

  -- Ensure the current Free period uses the standard 15-listing lifetime limit
  -- and that existing listings cannot be used to reset that allowance.
  perform public.get_or_create_entitlement(p_target_user_id);
  select count(*)::integer into v_product_count
  from public.products p
  join public.stores s on s.id = p.store_id
  where s.user_id = p_target_user_id;

  update public.product_listing_entitlements
  set subscription_id = null,
      period_end = (v_free_period_start + interval '1 month - 1 day')::date,
      total_listings_allowed = 15,
      lifetime_free_listings_used = greatest(
        coalesce(lifetime_free_listings_used, 0), least(15, v_product_count)
      ),
      updated_at = now()
  where user_id = p_target_user_id and period_start = v_free_period_start;

  insert into public.subscription_events (user_id, subscription_id, event_type, details)
  values (
    p_target_user_id,
    v_subscription.id,
    'CANCELLED',
    jsonb_build_object(
      'source', 'admin',
      'actor_user_id', p_actor_id,
      'reason', btrim(p_reason),
      'effective_at', now()
    )
  );

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'subscription_id', v_subscription.id,
    'status', 'CANCELLED',
    'effective_at', now()
  );
end;
$$;

revoke all on function public.admin_remove_premium(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_remove_premium(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
