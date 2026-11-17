  -- ============================================================
  -- PaliTrento pg_cron Setup for Subscription Automation
  -- Run in Supabase SQL Editor after enabling pg_cron extension
  -- ============================================================

  -- Enable pg_cron extension (requires superuser, run once)
  -- create extension if not exists pg_cron;

  -- ============================================================
  -- 1. Process subscription expirations (every 5 minutes)
  -- Checks for expired subscriptions and starts 5-day grace period
  -- ============================================================
  select cron.schedule(
    'pali-process-subscription-expirations',
    '*/5 * * * *',
    'select public.process_subscription_expirations();'
  );

  -- ============================================================
  -- 2. Process grace period endings (every 5 minutes)
  -- Checks for expired grace periods and locks products permanently
  -- ============================================================
  select cron.schedule(
    'pali-process-grace-period-endings',
    '*/5 * * * *',
    'select public.process_grace_period_endings();'
  );

  -- ============================================================
  -- 3. Process featured promotion expirations (every hour)
  -- Expires featured store promotions that have passed their expiry date
  -- ============================================================
  select cron.schedule(
    'pali-process-featured-promo-expirations',
    '0 * * * *',
    'select public.process_featured_promo_expirations();'
  );

  -- ============================================================
  -- 4. Send pending notifications (every 5 minutes)
  -- Creates advisories for in-app real-time notifications
  -- ============================================================
  select cron.schedule(
    'pali-send-pending-notifications',
    '*/5 * * * *',
    'select public.send_pending_notifications();'
  );

  -- ============================================================
  -- 5. Send expiration warnings (daily at 9:00 AM)
  -- Creates warnings for subscriptions expiring in 3 days and featured promos expiring tomorrow
  -- ============================================================
  select cron.schedule(
    'pali-send-expiration-warnings',
    '0 9 * * *',
    'select public.send_expiration_warnings();'
  );

  -- ============================================================
  -- 6. Auto-restore expired suspensions (every 5 minutes)
  -- From account-moderation-v2.sql
  -- ============================================================
  select cron.schedule(
    'pali-auto-restore-expired-suspensions',
    '*/5 * * * *',
    'select public.auto_restore_expired_suspensions();'
  );

  -- ============================================================
  -- Verify cron jobs are scheduled
  -- ============================================================
  select * from cron.job order by jobid;

  -- ============================================================
  -- To unschedule a job (if needed):
  -- select cron.unschedule('pali-process-subscription-expirations');
  -- select cron.unschedule('pali-process-grace-period-endings');
  -- select cron.unschedule('pali-process-featured-promo-expirations');
  -- select cron.unschedule('pali-send-pending-notifications');
  -- select cron.unschedule('pali-send-expiration-warnings');
  -- select cron.unschedule('pali-auto-restore-expired-suspensions');
  -- ============================================================