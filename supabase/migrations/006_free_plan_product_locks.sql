-- Keep the first 15 products available when Premium ends. Products beyond the
-- Free Plan allowance stay locked until the seller pays the per-listing fee or
-- renews Premium.
alter table products
  add column if not exists is_paid_listing boolean not null default false;

-- Older lock calls could create duplicate rows because product_id was not
-- unique. Keep the newest state before making lock updates idempotent.
with ranked_locks as (
  select id, row_number() over (
    partition by product_id
    order by created_at desc, id desc
  ) as row_number
  from product_lock_states
)
delete from product_lock_states pls
using ranked_locks rl
where pls.id = rl.id and rl.row_number > 1;

create unique index if not exists product_lock_states_product_id_uidx
  on product_lock_states(product_id);

create or replace function lock_store_products(
  p_store_id uuid,
  p_user_id uuid,
  p_reason text default 'GRACE_PERIOD'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- Preserve the first 15 unpaid listings and any listing already paid for.
  -- This also clears old grace locks from products that fit the Free Plan.
  with ranked_products as (
    select p.id,
           row_number() over (order by p.created_at asc, p.id asc) as listing_number
    from products p
    where p.store_id = p_store_id
      and not p.is_paid_listing
  )
  update product_lock_states pls
  set is_locked = false,
      unlocked_at = now()
  where pls.store_id = p_store_id
    and pls.user_id = p_user_id
    and pls.is_locked = true
    and pls.lock_reason in ('GRACE_PERIOD', 'SUBSCRIPTION_EXPIRED', 'UNPAID_LISTING')
    and not exists (
      select 1
      from ranked_products rp
      where rp.id = pls.product_id
        and rp.listing_number > 15
    );

  with ranked_products as (
    select p.id,
           row_number() over (order by p.created_at asc, p.id asc) as listing_number
    from products p
    where p.store_id = p_store_id
      and not p.is_paid_listing
  )
  insert into product_lock_states (
    product_id, store_id, user_id, lock_reason, unlock_price_cents,
    is_locked, locked_at, unlocked_at, payment_reference, bulk_unlock_batch_id
  )
  select p.id, p_store_id, p_user_id, p_reason, 100,
         true, now(), null, null, null
  from ranked_products rp
  join products p on p.id = rp.id
  where rp.listing_number > 15
    and not p.is_paid_listing
  on conflict (product_id) do update
  set lock_reason = excluded.lock_reason,
      unlock_price_cents = excluded.unlock_price_cents,
      is_locked = true,
      locked_at = now(),
      unlocked_at = null,
      payment_reference = null,
      bulk_unlock_batch_id = null;

  get diagnostics v_count = row_count;

  insert into subscription_events (user_id, event_type, details)
  values (p_user_id, 'PRODUCTS_LOCKED', jsonb_build_object(
    'store_id', p_store_id,
    'reason', p_reason,
    'products_locked', v_count,
    'free_listing_allowance', 15
  ));

  if v_count > 0 then
    insert into notification_queue (
      user_id, type, title, message, priority, related_entity_type, related_entity_id
    )
    values (
      p_user_id,
      'PRODUCTS_LOCKED',
      'Products over the Free Plan limit are hidden',
      format('%s products beyond your first 15 listings are hidden. Unlock them for ₱1 each or renew Premium.', v_count),
      'HIGH',
      'PRODUCT_LOCK',
      p_store_id
    );
  end if;

  return v_count;
end;
$$;

create or replace function verify_payment_and_unlock_products(
  p_user_id uuid,
  p_product_ids uuid[],
  p_payment_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_total_price_cents integer;
begin
  if coalesce(array_length(p_product_ids, 1), 0) = 0 then
    return jsonb_build_object('success', false, 'error', 'No products specified');
  end if;

  v_count := bulk_unlock_products(p_product_ids, p_user_id, p_payment_reference);
  if v_count = 0 then
    return jsonb_build_object('success', false, 'error', 'No locked products were found');
  end if;

  update products p
  set is_paid_listing = true
  where p.id = any(p_product_ids)
    and exists (
      select 1
      from product_lock_states pls
      where pls.product_id = p.id
        and pls.user_id = p_user_id
        and pls.is_locked = false
        and pls.payment_reference = p_payment_reference
    );

  for i in 1..v_count loop
    perform record_product_listing(p_user_id, true);
  end loop;

  v_total_price_cents := v_count * 100;
  return jsonb_build_object(
    'success', true,
    'unlocked_count', v_count,
    'total_price_cents', v_total_price_cents,
    'payment_reference', p_payment_reference
  );
end;
$$;
