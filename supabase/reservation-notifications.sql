-- Run in Supabase SQL Editor to enable reservation notifications and per-user notification dismissal.

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

create table if not exists public.notification_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('advisory', 'message', 'reservation')),
  notification_id uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, notification_type, notification_id)
);

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
end $$;

notify pgrst, 'reload schema';
