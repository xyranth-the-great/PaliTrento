-- ============================================================
-- Fix Dashboard Errors
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create notification_preferences table if it doesn't exist
create table if not exists notification_preferences (
  id uuid primary key references auth.users(id) on delete cascade,
  orders boolean not null default true,
  messages boolean not null default true,
  price_caps boolean not null default false,
  store_announcements boolean not null default false,
  push boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

drop policy if exists "read own notification preferences" on notification_preferences;
create policy "read own notification preferences" on notification_preferences
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "upsert own notification preferences" on notification_preferences;
create policy "upsert own notification preferences" on notification_preferences
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "update own notification preferences" on notification_preferences;
create policy "update own notification preferences" on notification_preferences
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger to auto-create default preferences on user signup
drop trigger if exists on_auth_user_created_notif_prefs on auth.users;

create or replace function create_default_notification_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notification_preferences (id, orders, messages, price_caps, store_announcements, push)
  values (new.id, true, true, false, false, false)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created_notif_prefs
  after insert on auth.users
  for each row execute function create_default_notification_preferences();

-- 2. Backfill notification_preferences for existing users who don't have it
insert into notification_preferences (id, orders, messages, price_caps, store_announcements, push)
select id, true, true, false, false, false
from auth.users u
where not exists (
  select 1 from notification_preferences np where np.id = u.id
);

-- 3. Fix business_documents: Add unique constraint for upsert
alter table public.business_documents
  drop constraint if exists business_documents_store_id_document_type_key;

alter table public.business_documents
  add constraint business_documents_store_id_document_type_key
  unique (store_id, document_type);

-- 4. Ensure business_compliance has the new columns
alter table public.business_compliance
  add column if not exists compliance_paused_at timestamptz,
  add column if not exists compliance_remaining_seconds integer,
  add column if not exists countdown_started_at timestamptz;

-- 5. Ensure stores has the new columns
alter table public.stores
  add column if not exists approval_status text not null default 'PENDING'
    check (approval_status in ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED')),
  add column if not exists certificate_status text not null default 'NONE'
    check (certificate_status in ('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  add column if not exists certificate_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspension_reason text,
  add column if not exists updated_at timestamptz not null default now();

-- 6. Add indexes
create index if not exists stores_approval_status_idx on public.stores(approval_status);
create index if not exists stores_certificate_status_idx on public.stores(certificate_status);
create index if not exists stores_is_suspended_idx on public.stores(is_suspended) where is_suspended = true;

-- ============================================================
-- After running this, refresh the dashboard page
-- ============================================================