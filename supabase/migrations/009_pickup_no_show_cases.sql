-- Preserve automatic pickup expiry as a durable admin-review case.
create table if not exists public.pickup_no_show_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null default 'Customer',
  store_id uuid,
  store_name text not null default 'Store',
  product_name text not null default 'Product',
  quantity integer not null default 0,
  ready_at timestamptz not null,
  expired_at timestamptz not null default now(),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists pickup_no_show_cases_created_idx
  on public.pickup_no_show_cases (created_at desc);
create index if not exists pickup_no_show_cases_customer_idx
  on public.pickup_no_show_cases (customer_id, created_at desc);

alter table public.pickup_no_show_cases enable row level security;
drop policy if exists "Admins read pickup no-show cases" on public.pickup_no_show_cases;
create policy "Admins read pickup no-show cases" on public.pickup_no_show_cases
  for select to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));
revoke all on public.pickup_no_show_cases from public, anon, authenticated;
grant select on public.pickup_no_show_cases to authenticated;

create or replace function public.record_pickup_no_show_case()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_label text;
  store_label text;
  product_label text;
begin
  if new.status <> 'EXPIRED'
     or old.status is not distinct from new.status
     or new.cancellation_actor is distinct from 'SYSTEM'
     or coalesce(new.cancellation_reason, '') not ilike '%not picked up within 72 hours%' then
    return new;
  end if;

  select coalesce(nullif(profile.full_name, ''), 'Customer')
    into customer_label
  from public.profiles as profile
  where profile.id = new.buyer_id;

  select coalesce(nullif(store.business_name, ''), 'Store')
    into store_label
  from public.stores as store
  where store.id = new.store_id;

  select coalesce(nullif(product.name, ''), 'Product')
    into product_label
  from public.products as product
  where product.id = new.product_id;

  insert into public.pickup_no_show_cases (
    order_id, customer_id, customer_name, store_id, store_name,
    product_name, quantity, ready_at, expired_at, reason
  ) values (
    new.id, new.buyer_id, coalesce(customer_label, 'Customer'), new.store_id,
    coalesce(store_label, 'Store'), coalesce(product_label, 'Product'),
    new.quantity, coalesce(new.ready_at, new.cancelled_at, now()),
    coalesce(new.cancelled_at, now()), coalesce(new.cancellation_reason, 'Not picked up within 72 hours after being marked ready.')
  ) on conflict (order_id) do nothing;

  return new;
end;
$$;

drop trigger if exists record_pickup_no_show_case on public.orders;
create trigger record_pickup_no_show_case
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_pickup_no_show_case();

revoke all on function public.record_pickup_no_show_case() from public, anon, authenticated;

-- Preserve automatically expired reservations that predate this admin screen.
insert into public.pickup_no_show_cases (
  order_id, customer_id, customer_name, store_id, store_name,
  product_name, quantity, ready_at, expired_at, reason
)
select
  order_row.id,
  order_row.buyer_id,
  coalesce(nullif(profile.full_name, ''), 'Customer'),
  order_row.store_id,
  coalesce(nullif(store.business_name, ''), 'Store'),
  coalesce(nullif(product.name, ''), 'Product'),
  order_row.quantity,
  coalesce(order_row.ready_at, order_row.cancelled_at, order_row.created_at),
  coalesce(order_row.cancelled_at, order_row.created_at, now()),
  coalesce(order_row.cancellation_reason, 'Not picked up within 72 hours after being marked ready.')
from public.orders as order_row
left join public.profiles as profile on profile.id = order_row.buyer_id
left join public.stores as store on store.id = order_row.store_id
left join public.products as product on product.id = order_row.product_id
where order_row.status = 'EXPIRED'
  and order_row.cancellation_actor = 'SYSTEM'
  and order_row.cancellation_reason ilike '%not picked up within%'
on conflict (order_id) do nothing;

-- Readiness and missed-pickup warnings are transactional and cannot be opted out.
create or replace function public.create_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status
     or new.status not in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED')
     or (
       new.status not in ('READY_FOR_PICKUP', 'EXPIRED')
       and exists (
         select 1
         from public.notification_preferences as preference
         where preference.id = new.buyer_id
           and preference.orders = false
       )
     ) then
    return new;
  end if;

  insert into public.order_status_notifications (
    order_id, buyer_id, previous_status, new_status, created_at
  ) values (new.id, new.buyer_id, old.status, new.status, now());

  return new;
end;
$$;

drop trigger if exists create_order_status_notification on public.orders;
create trigger create_order_status_notification
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.create_order_status_notification();

-- Keep the existing five-minute expiry job and make its customer notice explicit.
create or replace function public.expire_uncollected_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  update public.orders as order_row
  set status = 'EXPIRED',
      cancelled_at = now(),
      cancelled_by = null,
      cancellation_actor = 'SYSTEM',
      cancellation_reason = 'Not picked up within 72 hours after being marked ready. Reservation automatically cancelled; no-show recorded for admin review.'
  where order_row.status = 'READY_FOR_PICKUP'
    and order_row.ready_at <= now() - interval '72 hours'
    and exists (
      select 1
      from public.order_inventory_holds as inventory_hold
      where inventory_hold.order_id = order_row.id
        and inventory_hold.state in ('HELD', 'UNLIMITED')
    );

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.expire_uncollected_orders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'expire-uncollected-orders';

    perform cron.schedule(
      'expire-uncollected-orders',
      '*/5 * * * *',
      'select public.expire_uncollected_orders();'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
