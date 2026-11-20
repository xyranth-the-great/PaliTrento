-- ============================================================
-- PaliTrento Mobile — Batch 6 Native Push Tokens Migration
-- Run in Supabase SQL Editor to persist Android/iOS FCM tokens
-- without modifying the website's Web Push `push_subscriptions` table.
-- ============================================================

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists mobile_push_tokens_user_idx
  on public.mobile_push_tokens (user_id);

alter table public.mobile_push_tokens enable row level security;

drop policy if exists "read own mobile push tokens" on public.mobile_push_tokens;
create policy "read own mobile push tokens" on public.mobile_push_tokens
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own mobile push tokens" on public.mobile_push_tokens;
create policy "insert own mobile push tokens" on public.mobile_push_tokens
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own mobile push tokens" on public.mobile_push_tokens;
create policy "update own mobile push tokens" on public.mobile_push_tokens
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own mobile push tokens" on public.mobile_push_tokens;
create policy "delete own mobile push tokens" on public.mobile_push_tokens
  for delete to authenticated
  using (auth.uid() = user_id);

-- Enforce suspended/banned account restriction if helper exists
do $$
begin
  if to_regprocedure('public.is_account_active()') is not null then
    drop policy if exists "active_account_access" on public.mobile_push_tokens;
    create policy "active_account_access" on public.mobile_push_tokens
      as restrictive for all to authenticated
      using (public.is_account_active())
      with check (public.is_account_active());
  end if;
end;
$$;

grant select, insert, update, delete on public.mobile_push_tokens to authenticated;

notify pgrst, 'reload schema';
