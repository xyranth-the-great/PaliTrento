-- Auth deletes the profile via FK cascade. The profile audit trigger then
-- records its deleted target UUID, so target_user_id cannot reference auth.users.
alter table public.audit_logs
  drop constraint if exists audit_logs_target_user_id_fkey;
