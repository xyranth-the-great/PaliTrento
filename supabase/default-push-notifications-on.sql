-- Make push notifications (and price cap / announcement alerts) default ON for new users
alter table if exists public.notification_preferences
  alter column push set default true,
  alter column price_caps set default true,
  alter column store_announcements set default true;
