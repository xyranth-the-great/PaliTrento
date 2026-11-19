-- Hide stores and products owned by suspended or banned accounts from public
-- marketplace reads. Admin and owner policies remain separate.

drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores
  for select to anon, authenticated
  using (
    (verification_status = 'VERIFIED' or approval_status = 'APPROVED')
    and exists (
      select 1
      from public.profiles p
      where p.id = stores.user_id
        and p.account_status = 'active'
    )
  );

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.stores s
      join public.profiles p on p.id = s.user_id
      where s.id = products.store_id
        and (s.verification_status = 'VERIFIED' or s.approval_status = 'APPROVED')
        and p.account_status = 'active'
    )
  );

-- This RPC is SECURITY DEFINER, so its result must apply the same owner
-- eligibility check explicitly instead of relying on table RLS.
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
    join public.profiles owner_profile
      on owner_profile.id = s.user_id
      and owner_profile.account_status = 'active'
    cross join lateral (
      select exists (
        select 1
        from public.user_subscriptions us
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

notify pgrst, 'reload schema';
