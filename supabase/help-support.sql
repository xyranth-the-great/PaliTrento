-- ============================================================
-- PaliTrento Help & Support System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Support Tickets table
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subject text not null,
  category text not null check (category in (
    'ACCOUNT_PROBLEMS',
    'LOGIN_AUTHENTICATION',
    'BUSINESS_VERIFICATION',
    'STORE_MANAGEMENT',
    'PRODUCT_LISTINGS',
    'REPORTS_MODERATION',
    'PAYMENTS_PRICING',
    'TECHNICAL_ISSUES',
    'OTHER'
  )),
  description text not null,
  attachment_path text, -- storage path for optional attachment
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_user_idx on public.support_tickets(user_id);
create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_category_idx on public.support_tickets(category);
create index if not exists support_tickets_assigned_idx on public.support_tickets(assigned_admin_id);

-- Add FK to profiles for PostgREST relationship resolution (profiles.id = auth.users.id)
-- Drop existing FK to auth.users if it exists, then add FK to profiles with the standard name
alter table public.support_tickets
  drop constraint if exists support_tickets_user_id_fkey;
alter table public.support_tickets
  add constraint support_tickets_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- Users can read their own tickets
drop policy if exists "user read own support tickets" on public.support_tickets;
create policy "user read own support tickets" on public.support_tickets
  for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Users can create tickets
drop policy if exists "user create support tickets" on public.support_tickets;
create policy "user create support tickets" on public.support_tickets
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own tickets (e.g., reply, but status is admin-controlled)
drop policy if exists "user update own support tickets" on public.support_tickets;
create policy "user update own support tickets" on public.support_tickets
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Support Messages table (conversation within a ticket)
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null,
  content text not null,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  is_from_admin boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id);
create index if not exists support_messages_sender_idx on public.support_messages(sender_id);

-- Add FK to profiles for PostgREST relationship resolution (profiles.id = auth.users.id)
-- Drop existing FK to auth.users if it exists, then add FK to profiles with the standard name
alter table public.support_messages
  drop constraint if exists support_messages_sender_id_fkey;
alter table public.support_messages
  add constraint support_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table public.support_messages enable row level security;

-- Users can read messages in their own tickets
drop policy if exists "user read own ticket messages" on public.support_messages;
create policy "user read own ticket messages" on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets
      where id = support_messages.ticket_id
        and (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
    )
  );

-- Users can send messages to their own tickets
drop policy if exists "user send messages to own tickets" on public.support_messages;
create policy "user send messages to own tickets" on public.support_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.support_tickets
      where id = support_messages.ticket_id
        and user_id = auth.uid()
    )
    and sender_id = auth.uid()
  );

-- Admins can send messages to any ticket
drop policy if exists "admin send messages to any ticket" on public.support_messages;
create policy "admin send messages to any ticket" on public.support_messages
  for insert to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    and sender_id = auth.uid()
  );

-- 3. Storage bucket for support attachments (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'];

-- Storage policies for support attachments
drop policy if exists "user access own support attachments" on storage.objects;
create policy "user access own support attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user upload own support attachments" on storage.objects;
create policy "user upload own support attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin access all support attachments" on storage.objects;
create policy "admin access all support attachments" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'support-attachments'
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 4. Function to create support ticket
create or replace function public.create_support_ticket(
  p_subject text,
  p_category text,
  p_description text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_size bigint default null,
  p_attachment_mime text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket_id uuid;
begin
  if v_user_id is null then
    raise exception 'Must be authenticated to create support ticket';
  end if;

  if p_subject is null or length(trim(p_subject)) = 0 then
    raise exception 'Subject is required';
  end if;

  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Description is required';
  end if;

  -- Create ticket
  insert into public.support_tickets (user_id, subject, category, description, attachment_path, attachment_name, attachment_size, attachment_mime)
  values (v_user_id, trim(p_subject), p_category, trim(p_description), p_attachment_path, p_attachment_name, p_attachment_size, p_attachment_mime)
  returning id into v_ticket_id;

  -- Notify each administrator privately.
  insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only)
  select
    'New Support Ticket',
    'Support ticket "' || p_subject || '" created by user ' || v_user_id || '. Category: ' || p_category || '.',
    'ANNOUNCEMENT',
    'normal',
    now(),
    v_user_id,
    admin_profile.id,
    true
  from public.profiles admin_profile
  where admin_profile.role = 'admin';

  return jsonb_build_object('success', true, 'ticket_id', v_ticket_id);
end;
$$;

revoke all on function public.create_support_ticket(text, text, text, text, text, bigint, text) from public, anon;
grant execute on function public.create_support_ticket(text, text, text, text, text, bigint, text) to authenticated;

-- 5. Function to add message to support ticket
create or replace function public.add_support_message(
  p_ticket_id uuid,
  p_content text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_size bigint default null,
  p_attachment_mime text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_is_admin boolean;
  v_ticket public.support_tickets%rowtype;
  v_message_id uuid;
begin
  if v_sender_id is null then
    raise exception 'Must be authenticated';
  end if;

  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'Message content is required';
  end if;

  -- Check ticket exists and user has access
  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found';
  end if;

  -- Check if sender is admin
  select role = 'admin' into v_is_admin from public.profiles where id = v_sender_id;

  -- Verify access
  if v_ticket.user_id <> v_sender_id and not v_is_admin then
    raise exception 'Access denied';
  end if;

  -- Create message
  insert into public.support_messages (ticket_id, sender_id, content, attachment_path, attachment_name, attachment_size, attachment_mime, is_from_admin)
  values (p_ticket_id, v_sender_id, trim(p_content), p_attachment_path, p_attachment_name, p_attachment_size, p_attachment_mime, v_is_admin)
  returning id into v_message_id;

  -- Update ticket status based on who replied
  if v_is_admin then
    update public.support_tickets
    set status = 'WAITING_FOR_USER',
        updated_at = now()
    where id = p_ticket_id;
  else
    update public.support_tickets
    set status = 'IN_PROGRESS',
        updated_at = now()
    where id = p_ticket_id;
  end if;

  -- Notify the other party
  if v_is_admin then
    -- Notify user
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only)
    values (
      'Support Ticket Update',
      'An administrator has replied to your ticket: "' || v_ticket.subject || '".',
      'ANNOUNCEMENT',
      'normal',
      now(),
      v_sender_id,
      v_ticket.user_id
    );
  else
    -- Notify each administrator privately.
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    select
      'Support Ticket Reply',
      'User has replied to ticket: "' || v_ticket.subject || '".',
      'ANNOUNCEMENT',
      'normal',
      now(),
      v_sender_id,
      admin_profile.id,
      true
    from public.profiles admin_profile
    where admin_profile.role = 'admin';
  end if;

  return jsonb_build_object('success', true, 'message_id', v_message_id);
end;
$$;

revoke all on function public.add_support_message(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.add_support_message(uuid, text, text, text, bigint, text) to authenticated;

-- 6. Admin function to update ticket status
create or replace function public.admin_update_ticket_status(
  p_actor_id uuid,
  p_ticket_id uuid,
  p_status text, -- 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'
  p_assigned_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_ticket public.support_tickets%rowtype;
begin
  -- Verify actor is admin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role <> 'admin' then
    raise exception 'Only administrators can update ticket status';
  end if;

  -- Get ticket
  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found';
  end if;

  if p_status not in ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED') then
    raise exception 'Invalid status';
  end if;

  -- Update ticket
  update public.support_tickets
  set status = p_status,
      assigned_admin_id = coalesce(p_assigned_admin_id, assigned_admin_id),
      updated_at = now(),
      resolved_at = case when p_status in ('RESOLVED', 'CLOSED') then now() else null end
  where id = p_ticket_id;

  -- Notify user if resolved/closed
  if p_status in ('RESOLVED', 'CLOSED') then
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    values (
      'Support Ticket ' || p_status,
      'Your support ticket "' || v_ticket.subject || '" has been marked as ' || lower(p_status) || '.',
      'ANNOUNCEMENT',
      'normal',
      now(),
      p_actor_id,
      v_ticket.user_id
    );
  end if;

  return jsonb_build_object('success', true, 'ticket_id', p_ticket_id, 'status', p_status);
end;
$$;

revoke all on function public.admin_update_ticket_status(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_update_ticket_status(uuid, uuid, text, uuid) to service_role;

-- 7. Admin function to assign ticket
create or replace function public.admin_assign_ticket(
  p_actor_id uuid,
  p_ticket_id uuid,
  p_assigned_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role <> 'admin' then
    raise exception 'Only administrators can assign tickets';
  end if;

  update public.support_tickets
  set assigned_admin_id = p_assigned_admin_id,
      status = 'IN_PROGRESS',
      updated_at = now()
  where id = p_ticket_id;

  return jsonb_build_object('success', true, 'ticket_id', p_ticket_id, 'assigned_to', p_assigned_admin_id);
end;
$$;

revoke all on function public.admin_assign_ticket(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_assign_ticket(uuid, uuid, uuid) to service_role;

-- 8. Grant for authenticated users
grant select on public.support_tickets to authenticated;
grant select on public.support_messages to authenticated;
grant insert on public.support_tickets to authenticated;
grant insert on public.support_messages to authenticated;
grant update on public.support_tickets to authenticated;

-- ============================================================
-- DEPLOYMENT CHECKLIST:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Frontend will call create_support_ticket, add_support_message RPCs
-- 3. Admin dashboard will use admin_update_ticket_status, admin_assign_ticket RPCs
-- ============================================================