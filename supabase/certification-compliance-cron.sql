-- Before running this script:
-- 1. Enable pg_cron and pg_net in Supabase Database > Extensions.
-- 2. Add Vault secrets named palitrento_project_url and
--    palitrento_compliance_cron_secret.
-- 3. Set the same cron secret as COMPLIANCE_CRON_SECRET for the Edge Function.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'enforce-store-certification-deadlines';

select cron.schedule(
  'enforce-store-certification-deadlines',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'palitrento_project_url'
    ) || '/functions/v1/manage-certifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-compliance-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'palitrento_compliance_cron_secret'
      )
    ),
    body := '{"action":"enforce"}'::jsonb
  );
  $$
);
