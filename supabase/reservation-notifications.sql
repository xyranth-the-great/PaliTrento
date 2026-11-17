-- Run in Supabase SQL Editor to enable reservation and order-status notifications with per-user dismissal.

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
  new_status text not null check (new_status in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

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
     or new.status not in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED')
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

create or replace function public.deduct_product_stock_on_order_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  available_quantity integer;
begin
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

  return new;
end;
$$;

drop trigger if exists deduct_product_stock_on_order_completion on public.orders;
create trigger deduct_product_stock_on_order_completion
  before update of status on public.orders
  for each row
  when (old.status is distinct from new.status and new.status = 'COMPLETED')
  execute function public.deduct_product_stock_on_order_completion();

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
