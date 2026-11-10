-- Email OTP codes table
create table if not exists email_otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  purpose text not null default 'verify',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_otp_codes_email_idx on email_otp_codes (email);
create index if not exists email_otp_codes_expires_idx on email_otp_codes (expires_at);

-- RLS: only service role can insert/read (via Edge Function)
alter table email_otp_codes enable row level security;
create policy "service role only" on email_otp_codes for all to service_role using (true) with check (true);

-- Function to clean expired codes (optional, run via pg_cron or manually)
create or replace function clean_expired_otp_codes()
returns void language plpgsql as $$
begin
  delete from email_otp_codes where expires_at < now();
end; $$;