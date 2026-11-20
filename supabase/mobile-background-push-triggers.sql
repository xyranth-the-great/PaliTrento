-- ============================================================
-- PaliTrento Mobile — Background FCM Push Notification Triggers
-- Fires `send-mobile-push` Edge Function via `pg_net` whenever:
--   1. New order chat message (`messages` INSERT)
--   2. Order status changes (`orders` UPDATE)
--   3. New customer reservation (`reservation_notifications` INSERT)
--   4. Account warning / suspension / ban (`account_moderation_actions` INSERT)
--   5. New advisory / price cap / announcement / personal alert (`advisories` INSERT)
--   6. New support ticket reply (`support_messages` INSERT)
--
-- Non-blocking: `pg_net` sends asynchronously after commit, and any error
-- inside the trigger is caught so DB writes can NEVER fail.
-- ============================================================

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.mobile_push_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on table private.mobile_push_config from public, anon, authenticated;

-- Store Edge Function endpoint (webhook secret is populated separately during deploy)
insert into private.mobile_push_config (key, value)
values (
  'function_url',
  'https://xcbkpknsieawtzyfwrff.supabase.co/functions/v1/send-mobile-push'
)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function private.dispatch_mobile_push()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, net
as $$
declare
  v_url text;
  v_secret text;
  v_payload jsonb;
begin
  select value into v_url from private.mobile_push_config where key = 'function_url';
  select value into v_secret from private.mobile_push_config where key = 'webhook_secret';

  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'table', tg_table_name,
    'op', tg_op,
    'record', to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
  );

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-webhook-secret', v_secret
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- Never fail user/admin writes if push dispatch encounters a transient error
    raise warning '[dispatch_mobile_push] error on %.%: %', tg_table_name, tg_op, sqlerrm;
    return new;
end;
$$;

revoke all on function private.dispatch_mobile_push() from public, anon, authenticated;

-- 1. Order Chat Messages
drop trigger if exists trg_mobile_push_messages on public.messages;
create trigger trg_mobile_push_messages
  after insert on public.messages
  for each row
  execute function private.dispatch_mobile_push();

-- 2. Order Status Updates
drop trigger if exists trg_mobile_push_orders on public.orders;
create trigger trg_mobile_push_orders
  after update of status on public.orders
  for each row
  when (
    old.status is distinct from new.status
    and new.status in ('CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED')
  )
  execute function private.dispatch_mobile_push();

-- 3. New Customer Reservations (Business Owners)
drop trigger if exists trg_mobile_push_reservations on public.reservation_notifications;
create trigger trg_mobile_push_reservations
  after insert on public.reservation_notifications
  for each row
  execute function private.dispatch_mobile_push();

-- 4. Account Moderation Alerts (Warnings, Suspensions, Bans)
drop trigger if exists trg_mobile_push_moderation on public.account_moderation_actions;
create trigger trg_mobile_push_moderation
  after insert on public.account_moderation_actions
  for each row
  when (new.action in ('warn', 'suspend_temporary', 'suspend_permanent', 'ban'))
  execute function private.dispatch_mobile_push();

-- 5. Advisories, Price Caps, Announcements & Personal Alerts
drop trigger if exists trg_mobile_push_advisories on public.advisories;
create trigger trg_mobile_push_advisories
  after insert on public.advisories
  for each row
  execute function private.dispatch_mobile_push();

-- 6. Support Ticket Replies
drop trigger if exists trg_mobile_push_support_messages on public.support_messages;
create trigger trg_mobile_push_support_messages
  after insert on public.support_messages
  for each row
  execute function private.dispatch_mobile_push();
