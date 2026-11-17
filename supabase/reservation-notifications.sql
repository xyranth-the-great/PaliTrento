-- Run in Supabase SQL Editor to enable reservation inventory holds, cancellations,
-- pickup expiry, and notifications.

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_actor text
    check (cancellation_actor in ('CUSTOMER', 'BUSINESS_OWNER', 'ADMIN', 'SYSTEM')),
  add column if not exists cancellation_reason text;

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED'));

create index if not exists orders_ready_for_pickup_expiry_idx
  on public.orders (ready_at)
  where status = 'READY_FOR_PICKUP';

create table if not exists public.order_inventory_holds (
  order_id uuid primary key references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  state text not null check (state in ('HELD', 'UNLIMITED', 'CONSUMED', 'RELEASED')),
  created_at timestamptz not null default now()
);

alter table public.order_inventory_holds enable row level security;
revoke all on table public.order_inventory_holds from anon, authenticated;

drop policy if exists "buyer create orders" on public.orders;
create policy "buyer create orders" on public.orders
  for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and status = 'PENDING'
    and exists (
      select 1
      from public.products
      where products.id = orders.product_id
        and products.store_id = orders.store_id
    )
    and not exists (
      select 1
      from public.stores
      where stores.id = orders.store_id
        and stores.user_id = auth.uid()
    )
  );

create table if not exists public.reservation_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists reservation_notifications_owner_unread_idx
  on public.reservation_notifications (owner_id, created_at desc)
  where read_at is null;

create table if not exists public.order_status_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  previous_status text not null,
  new_status text not null check (new_status in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.order_status_notifications
  drop constraint if exists order_status_notifications_new_status_check;
alter table public.order_status_notifications
  add constraint order_status_notifications_new_status_check
  check (new_status in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED'));

create index if not exists order_status_notifications_buyer_unread_idx
  on public.order_status_notifications (buyer_id, created_at desc)
  where read_at is null;

create table if not exists public.notification_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('advisory', 'message', 'reservation', 'order_status')),
  notification_id uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, notification_type, notification_id)
);

alter table public.notification_dismissals
  drop constraint if exists notification_dismissals_notification_type_check;
alter table public.notification_dismissals
  add constraint notification_dismissals_notification_type_check
  check (notification_type in ('advisory', 'message', 'reservation', 'order_status'));

alter table public.notification_dismissals enable row level security;

drop policy if exists "users read own notification dismissals" on public.notification_dismissals;
create policy "users read own notification dismissals" on public.notification_dismissals
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "users create own notification dismissals" on public.notification_dismissals;
create policy "users create own notification dismissals" on public.notification_dismissals
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users update own notification dismissals" on public.notification_dismissals;
create policy "users update own notification dismissals" on public.notification_dismissals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.notification_dismissals to authenticated;
revoke delete on table public.notification_dismissals from authenticated;

alter table public.order_status_notifications enable row level security;

drop policy if exists "buyers read own order status notifications" on public.order_status_notifications;
create policy "buyers read own order status notifications" on public.order_status_notifications
  for select to authenticated
  using (buyer_id = auth.uid());

drop policy if exists "buyers mark own order status notifications read" on public.order_status_notifications;
create policy "buyers mark own order status notifications read" on public.order_status_notifications
  for update to authenticated
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

grant select on table public.order_status_notifications to authenticated;
revoke insert, update, delete on public.order_status_notifications from authenticated;
grant update (read_at) on public.order_status_notifications to authenticated;

alter table public.reservation_notifications enable row level security;

drop policy if exists "owners read reservation notifications" on public.reservation_notifications;
create policy "owners read reservation notifications" on public.reservation_notifications
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "owners mark reservation notifications read" on public.reservation_notifications;
create policy "owners mark reservation notifications read" on public.reservation_notifications
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select on table public.reservation_notifications to authenticated;
revoke insert, update, delete on table public.reservation_notifications from authenticated;
grant update (read_at) on table public.reservation_notifications to authenticated;

create or replace function public.create_reservation_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  store_owner_id uuid;
begin
  if new.status <> 'PENDING' then
    return new;
  end if;

  select store.user_id
  into store_owner_id
  from public.stores as store
  where store.id = new.store_id;

  if store_owner_id is not null then
    insert into public.reservation_notifications (order_id, owner_id, created_at)
    values (new.id, store_owner_id, new.created_at)
    on conflict (order_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists create_reservation_notification on public.orders;
create trigger create_reservation_notification
  after insert on public.orders
  for each row execute function public.create_reservation_notification();

create or replace function public.create_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status
     or new.status not in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED')
     or exists (
       select 1
       from public.notification_preferences as preference
       where preference.id = new.buyer_id
         and preference.orders = false
     ) then
    return new;
  end if;

  insert into public.order_status_notifications (
    order_id, buyer_id, previous_status, new_status, created_at
  )
  values (new.id, new.buyer_id, old.status, new.status, now());

  return new;
end;
$$;

drop trigger if exists create_order_status_notification on public.orders;
create trigger create_order_status_notification
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.create_order_status_notification();

create or replace function public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_cancellation_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  actor_id uuid := auth.uid();
  is_store_owner boolean;
  is_admin boolean;
  actor_type text;
  reason text := nullif(btrim(p_cancellation_reason), '');
begin
  if actor_id is null then
    raise exception 'You must be signed in to update an order';
  end if;

  select *
  into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % was not found', p_order_id;
  end if;

  select exists (
    select 1
    from public.stores
    where id = order_row.store_id
      and user_id = actor_id
  )
  into is_store_owner;

  select exists (
    select 1
    from public.profiles
    where id = actor_id
      and role = 'admin'
  )
  into is_admin;

  if p_new_status = 'CANCELLED' then
    if order_row.status not in ('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP') then
      raise exception 'This order can no longer be cancelled';
    end if;

    if actor_id = order_row.buyer_id then
      if order_row.status <> 'PENDING' then
        raise exception 'Customers can cancel only while an order is pending';
      end if;
      actor_type := 'CUSTOMER';
      reason := coalesce(reason, 'Cancelled by customer');
    elsif is_store_owner then
      if reason is null then
        raise exception 'A cancellation reason is required';
      end if;
      actor_type := 'BUSINESS_OWNER';
    elsif is_admin then
      if reason is null then
        raise exception 'A cancellation reason is required';
      end if;
      actor_type := 'ADMIN';
    else
      raise exception 'You are not allowed to cancel this order';
    end if;

    update public.orders
    set status = 'CANCELLED',
        cancelled_at = now(),
        cancelled_by = actor_id,
        cancellation_actor = actor_type,
        cancellation_reason = reason
    where id = p_order_id
    returning * into order_row;
  elsif p_new_status in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED') then
    if not is_store_owner and not is_admin then
      raise exception 'Only the business owner can update this order';
    end if;

    if not (
      (order_row.status = 'PENDING' and p_new_status = 'CONFIRMED')
      or (order_row.status = 'CONFIRMED' and p_new_status = 'READY_FOR_PICKUP')
      or (order_row.status = 'READY_FOR_PICKUP' and p_new_status = 'COMPLETED')
    ) then
      raise exception 'Invalid order status transition';
    end if;

    update public.orders
    set status = p_new_status,
        confirmed_at = case when p_new_status = 'CONFIRMED' then now() else confirmed_at end,
        ready_at = case when p_new_status = 'READY_FOR_PICKUP' then now() else ready_at end,
        completed_at = case when p_new_status = 'COMPLETED' then now() else completed_at end
    where id = p_order_id
    returning * into order_row;
  else
    raise exception 'Unsupported order status: %', p_new_status;
  end if;

  return order_row;
end;
$$;

revoke all on function public.update_order_status(uuid, text, text) from public, anon;
grant execute on function public.update_order_status(uuid, text, text) to authenticated;

drop policy if exists "owner update orders" on public.orders;
drop policy if exists "admin update orders" on public.orders;
revoke update on table public.orders from anon, authenticated;

create or replace function public.reserve_product_stock_for_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  available_quantity integer;
  product_is_in_stock boolean;
begin
  select product.quantity, product.in_stock
  into available_quantity, product_is_in_stock
  from public.products as product
  where product.id = new.product_id
  for update;

  if not found then
    raise exception 'Product % was not found', new.product_id;
  end if;

  if not product_is_in_stock then
    raise exception 'This product is out of stock';
  end if;

  if available_quantity is null then
    insert into public.order_inventory_holds (order_id, product_id, quantity, state)
    values (new.id, new.product_id, new.quantity, 'UNLIMITED');
    return new;
  end if;

  if available_quantity < new.quantity then
    raise exception 'Insufficient stock. Available: %, requested: %',
      available_quantity, new.quantity
      using errcode = '23514';
  end if;

  update public.products
  set quantity = available_quantity - new.quantity,
      in_stock = (available_quantity - new.quantity > 0)
  where id = new.product_id;

  insert into public.order_inventory_holds (order_id, product_id, quantity, state)
  values (new.id, new.product_id, new.quantity, 'HELD');

  return new;
end;
$$;

drop trigger if exists reserve_product_stock_for_order on public.orders;
create trigger reserve_product_stock_for_order
  after insert on public.orders
  for each row
  when (new.status = 'PENDING')
  execute function public.reserve_product_stock_for_order();

create or replace function public.apply_order_inventory_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inventory_hold public.order_inventory_holds%rowtype;
  available_quantity integer;
begin
  if new.status = 'EXPIRED' and old.status is distinct from new.status then
    update public.reservation_notifications
    set created_at = now(),
        read_at = null
    where order_id = new.id;

    delete from public.notification_dismissals as dismissal
    using public.reservation_notifications as reservation
    where reservation.order_id = new.id
      and dismissal.user_id = reservation.owner_id
      and dismissal.notification_type = 'reservation'
      and dismissal.notification_id = reservation.id;
  elsif new.status <> 'PENDING' and old.status is distinct from new.status then
    update public.reservation_notifications
    set read_at = coalesce(read_at, now())
    where order_id = new.id
      and read_at is null;
  end if;

  if new.status in ('CANCELLED', 'EXPIRED') then
    select *
    into inventory_hold
    from public.order_inventory_holds
    where order_id = new.id
    for update;

    if found and inventory_hold.state = 'HELD' then
      update public.products
      set quantity = quantity + inventory_hold.quantity,
          in_stock = case when quantity = 0 then true else in_stock end
      where id = inventory_hold.product_id;

      update public.order_inventory_holds
      set state = 'RELEASED'
      where order_id = new.id;
    elsif found and inventory_hold.state = 'UNLIMITED' then
      update public.order_inventory_holds
      set state = 'RELEASED'
      where order_id = new.id;
    end if;
  elsif new.status = 'COMPLETED' then
    select *
    into inventory_hold
    from public.order_inventory_holds
    where order_id = new.id
    for update;

    if found and inventory_hold.state in ('HELD', 'UNLIMITED') then
      update public.order_inventory_holds
      set state = 'CONSUMED'
      where order_id = new.id;
    elsif not found then
      update public.products
      set quantity = quantity - new.quantity,
          in_stock = in_stock and (quantity - new.quantity > 0)
      where id = new.product_id
        and quantity is not null
        and quantity >= new.quantity;

      if not found then
        select product.quantity
        into available_quantity
        from public.products as product
        where product.id = new.product_id
        for update;

        if not found then
          raise exception 'Product % was not found while completing order %', new.product_id, new.id;
        elsif available_quantity is not null then
          raise exception 'Insufficient stock to complete this order. Available: %, requested: %',
            available_quantity, new.quantity
            using errcode = '23514';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists deduct_product_stock_on_order_completion on public.orders;
drop function if exists public.deduct_product_stock_on_order_completion();
drop trigger if exists apply_order_inventory_transition on public.orders;
create trigger apply_order_inventory_transition
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.apply_order_inventory_transition();

create or replace function public.expire_uncollected_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  -- Hold rows identify new reservations; pre-migration active orders are grandfathered.
  update public.orders as order_row
  set status = 'EXPIRED',
      cancelled_at = now(),
      cancelled_by = null,
      cancellation_actor = 'SYSTEM',
      cancellation_reason = 'Not picked up within 3 days of being marked ready'
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

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'expire-uncollected-orders';

select cron.schedule(
  'expire-uncollected-orders',
  '*/5 * * * *',
  'select public.expire_uncollected_orders();'
);

insert into public.reservation_notifications (order_id, owner_id, created_at)
select order_row.id, store.user_id, order_row.created_at
from public.orders as order_row
join public.stores as store on store.id = order_row.store_id
where order_row.status = 'PENDING'
  and store.user_id is not null
on conflict (order_id) do nothing;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservation_notifications'
  ) then
    alter publication supabase_realtime add table public.reservation_notifications;
  end if;
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_status_notifications'
  ) then
    alter publication supabase_realtime add table public.order_status_notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
