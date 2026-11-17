-- Fix the featured stores RPC aggregate ordering and apply its requested limit.
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
      exists (
        select 1 from user_subscriptions us
        join subscription_plans sp on sp.id = us.plan_id
        where us.user_id = s.user_id
          and us.status = 'ACTIVE'
          and sp.code = 'PREMIUM'
      ) as is_premium
    from stores s
    join featured_promotions fp on fp.store_id = s.id
    where fp.status = 'ACTIVE'
      and fp.expires_at > now()
      and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
  ),
  limited_featured_stores as (
    select *
    from featured_stores
    order by case when is_premium then 0 else 1 end, started_at desc
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
      'featured_promo', jsonb_build_object(
        'id', fs.promo_id,
        'started_at', fs.started_at,
        'expires_at', fs.expires_at,
        'price_paid_cents', fs.price_paid_cents
      )
    )
    order by case when fs.is_premium then 0 else 1 end, fs.started_at desc
  ) into v_stores
  from limited_featured_stores fs;

  return coalesce(v_stores, '[]'::jsonb);
end; $$;
