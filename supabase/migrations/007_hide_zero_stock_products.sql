-- Hide products with a finite stock count of zero from public search.
create or replace function search_products_with_priority(
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
  v_where text := ' and (p.quantity is null or p.quantity > 0)';
  v_order text := '';
begin
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

  v_where := v_where || ' and exists (
    select 1 from stores s where s.id = p.store_id
      and (s.verification_status = ''VERIFIED'' or s.approval_status = ''APPROVED'')
      and not exists (
        select 1 from product_lock_states pls where pls.product_id = p.id and pls.is_locked = true
      )
  )';

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
end;
$$;
