-- ============================================================
-- PaliTrento Notification Recipient Targeting Fix
-- Run in Supabase SQL Editor
-- This fixes the critical issue where notifications were broadcast to all users
-- ============================================================

-- 1. Add recipient_id column to advisories table
-- NULL = global broadcast (price caps, announcements to all)
-- Specific UUID = targeted to that user only
alter table public.advisories
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade,
  add column if not exists admin_only boolean not null default false,
  add column if not exists action_url text,
  add column if not exists action_label text;

create index if not exists advisories_recipient_idx on public.advisories(recipient_id);

-- 2. Update RLS policies on advisories table
alter table public.advisories enable row level security;

-- Remove every existing policy so no permissive policy can widen these scopes.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'advisories'
  loop
    execute format('drop policy %I on public.advisories', v_policy.policyname);
  end loop;
end;
$$;

create policy "public read active advisories" on public.advisories
  for select to anon, authenticated
  using (
    recipient_id is null
    and admin_only = false
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );
create policy "users read own targeted advisories" on public.advisories
  for select to authenticated
  using (
    recipient_id = auth.uid()
    and (
      admin_only = false
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );
create policy "admins manage global advisories" on public.advisories
  for all to authenticated
  using (
    recipient_id is null
    and admin_only = false
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    recipient_id is null
    and admin_only = false
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 3. Update notification_reads RLS to only allow users to manage their own reads
alter table public.notification_reads enable row level security;
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_reads'
  loop
    execute format('drop policy %I on public.notification_reads', v_policy.policyname);
  end loop;
end;
$$;
create policy "users manage own notification reads" on public.notification_reads
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Create helper function to get admin user IDs (for targeting admin notifications)
create or replace function public.get_admin_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select array_agg(id) from public.profiles where role = 'admin';
$$;

revoke all on function public.get_admin_user_ids() from public, anon, authenticated;
grant execute on function public.get_admin_user_ids() to service_role;

-- Repair or remove legacy records that were previously stored as broadcasts.
do $$
begin
  insert into public.advisories
    (title, body, category, priority, published_at, expires_at, created_by, recipient_id, admin_only, action_url, action_label)
  select
    legacy.title,
    legacy.body,
    legacy.category,
    legacy.priority,
    legacy.published_at,
    legacy.expires_at,
    legacy.created_by,
    admin_profile.id,
    true,
    case legacy.title
      when 'New Business Report' then '/admin-reports-management/?tab=business'
      else '/admin-reports-management/?tab=product'
    end,
    case legacy.title
      when 'New Business Report' then 'Review business report'
      else 'Review product report'
    end
  from public.advisories legacy
  cross join public.profiles admin_profile
  where legacy.recipient_id is null
    and legacy.title in ('New Business Report', 'New Product Report')
    and admin_profile.role = 'admin';

  delete from public.advisories
  where recipient_id is null
    and title in ('New Business Report', 'New Product Report');

  if to_regclass('public.account_moderation_actions') is not null then
    with uniquely_matched_warnings as (
      select advisory.id, (array_agg(moderation.target_user_id))[1] as target_user_id
      from public.advisories advisory
      join public.account_moderation_actions moderation
        on moderation.actor_user_id = advisory.created_by
       and moderation.action = 'warn'
       and advisory.created_at >= moderation.created_at
       and advisory.created_at < moderation.created_at + interval '1 hour'
       and right(advisory.body, length(moderation.reason)) = moderation.reason
      where advisory.recipient_id is null
        and advisory.title = 'Account Warning'
      group by advisory.id
      having count(*) = 1
    )
    update public.advisories advisory
    set recipient_id = warning.target_user_id
    from uniquely_matched_warnings warning
    where advisory.id = warning.id;
  end if;

  delete from public.advisories
  where recipient_id is null
    and title in (
      'Account Warning',
      'Report Resolution Update',
      'New Support Ticket',
      'Support Ticket Reply',
      'Support Ticket Update',
      'Business Verified',
      'Business Account Suspended - Document Compliance',
      'Support Ticket OPEN',
      'Support Ticket IN_PROGRESS',
      'Support Ticket WAITING_FOR_USER',
      'Support Ticket RESOLVED',
      'Support Ticket CLOSED'
    );

  delete from public.advisories
  where title = 'Report Resolution Update';

  update public.advisories
  set action_url = case title
        when 'New Business Report' then '/admin-reports-management/?tab=business'
        when 'New Product Report' then '/admin-reports-management/?tab=product'
      end,
      action_label = case title
        when 'New Business Report' then 'Review business report'
        when 'New Product Report' then 'Review product report'
      end
  where recipient_id is not null
    and title in ('New Business Report', 'New Product Report');

  update public.advisories
  set admin_only = true
  where recipient_id is not null
    and title in ('New Business Report', 'New Product Report', 'New Support Ticket', 'Support Ticket Reply');
end;
$$;

-- 5. Update create_business_report to target admins only
create or replace function public.create_business_report(
  p_store_id uuid,
  p_reason text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid := auth.uid();
  v_store public.stores%rowtype;
  v_existing_report boolean := false;
  v_report_id uuid;
  v_admin_ids uuid[];
begin
  if v_reporter_id is null then
    raise exception 'Must be authenticated to report';
  end if;

  -- Verify store exists and is verified
  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Store not found';
  end if;

  if v_store.verification_status <> 'VERIFIED' then
    raise exception 'Cannot report unverified store';
  end if;

  -- Check for duplicate report (same reporter, same store, same reason within 24h)
  select exists (
    select 1 from public.business_reports
    where reporter_id = v_reporter_id
      and store_id = p_store_id
      and reason = p_reason
      and created_at >= now() - interval '24 hours'
  ) into v_existing_report;

  if v_existing_report then
    raise exception 'You have already reported this store for this reason recently';
  end if;

  -- Create report
  insert into public.business_reports (reporter_id, store_id, reason, description)
  values (v_reporter_id, p_store_id, p_reason, p_description)
  returning id into v_report_id;

  -- Notify ADMINS ONLY (not all users)
  v_admin_ids := public.get_admin_user_ids();
  if array_length(v_admin_ids, 1) > 0 then
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only, action_url, action_label)
    select
      'New Business Report',
      'A report has been submitted for "' || v_store.business_name || '" (TRN: ' || v_store.trn_code || '). Reason: ' || p_reason || '.',
      'ANNOUNCEMENT',
      'normal',
      now(),
      v_reporter_id,
      admins.admin_id,
      true,
      '/admin-reports-management/?tab=business',
      'Review business report'
    from unnest(v_admin_ids) as admins(admin_id);
  end if;

  return jsonb_build_object('success', true, 'report_id', v_report_id);
end;
$$;

revoke all on function public.create_business_report(uuid, text, text) from public, anon;
grant execute on function public.create_business_report(uuid, text, text) to authenticated;

-- 6. Update create_product_report to target admins only
create or replace function public.create_product_report(
  p_product_id uuid,
  p_reason text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_store public.stores%rowtype;
  v_existing_report boolean := false;
  v_report_id uuid;
  v_admin_ids uuid[];
begin
  if v_reporter_id is null then
    raise exception 'Must be authenticated to report';
  end if;

  -- Verify product exists
  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;

  -- Verify store is verified
  select * into v_store from public.stores where id = v_product.store_id;
  if not found or v_store.verification_status <> 'VERIFIED' then
    raise exception 'Cannot report product from unverified store';
  end if;

  -- Check for duplicate report
  select exists (
    select 1 from public.product_reports
    where reporter_id = v_reporter_id
      and product_id = p_product_id
      and reason = p_reason
      and created_at >= now() - interval '24 hours'
  ) into v_existing_report;

  if v_existing_report then
    raise exception 'You have already reported this product for this reason recently';
  end if;

  -- Create report
  insert into public.product_reports (reporter_id, product_id, store_id, reason, description)
  values (v_reporter_id, p_product_id, v_product.store_id, p_reason, p_description)
  returning id into v_report_id;

  -- Notify ADMINS ONLY
  v_admin_ids := public.get_admin_user_ids();
  if array_length(v_admin_ids, 1) > 0 then
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only, action_url, action_label)
    select
      'New Product Report',
      'A report has been submitted for product "' || v_product.name || '" from store "' || v_store.business_name || '". Reason: ' || p_reason || '.',
      'ANNOUNCEMENT',
      'normal',
      now(),
      v_reporter_id,
      admins.admin_id,
      true,
      '/admin-reports-management/?tab=product',
      'Review product report'
    from unnest(v_admin_ids) as admins(admin_id);
  end if;

  return jsonb_build_object('success', true, 'report_id', v_report_id);
end;
$$;

revoke all on function public.create_product_report(uuid, text, text) from public, anon;
grant execute on function public.create_product_report(uuid, text, text) to authenticated;

-- 7. Update report status without exposing internal report notes to the reported owner
create or replace function public.admin_update_report_status(
  p_actor_id uuid,
  p_report_type text, -- 'BUSINESS' or 'PRODUCT'
  p_report_id uuid,
  p_status text, -- 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
  p_admin_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_table text;
  v_updated_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'Actor does not match authenticated user';
  end if;

  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Only administrators can update report status';
  end if;

  if p_report_type = 'BUSINESS' then
    v_table := 'business_reports';
  elsif p_report_type = 'PRODUCT' then
    v_table := 'product_reports';
  else
    raise exception 'Invalid report type. Use BUSINESS or PRODUCT';
  end if;

  if p_status not in ('UNDER_REVIEW', 'RESOLVED', 'DISMISSED') then
    raise exception 'Invalid status';
  end if;

  -- Update report
  execute format('
    update public.%I
    set status = %L,
        admin_notes = %L,
        resolved_by = %L,
        resolved_at = %L,
        updated_at = %L
    where id = %L
  ', v_table, p_status, p_admin_notes, p_actor_id, now(), now(), p_report_id);
  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    raise exception 'Report not found';
  end if;

  return jsonb_build_object('success', true, 'report_id', p_report_id, 'status', p_status);
end;
$$;

revoke all on function public.admin_update_report_status(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_report_status(uuid, text, uuid, text, text) to authenticated, service_role;

-- 8. Update create_support_ticket to target admins only
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
  v_admin_ids uuid[];
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

  -- Notify ADMINS ONLY
  v_admin_ids := public.get_admin_user_ids();
  if array_length(v_admin_ids, 1) > 0 then
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only)
    select
      'New Support Ticket',
      'Support ticket "' || p_subject || '" created by user ' || v_user_id || '. Category: ' || p_category || '.',
      'ANNOUNCEMENT',
      'normal',
      now(),
      v_user_id,
      admins.admin_id,
      true
    from unnest(v_admin_ids) as admins(admin_id);
  end if;

  return jsonb_build_object('success', true, 'ticket_id', v_ticket_id);
end;
$$;

revoke all on function public.create_support_ticket(text, text, text, text, text, bigint, text) from public, anon;
grant execute on function public.create_support_ticket(text, text, text, text, text, bigint, text) to authenticated;

-- 9. Update add_support_message to target the correct recipient
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
  v_admin_ids uuid[];
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

    -- Notify the TICKET OWNER (user) ONLY
    if v_ticket.user_id is not null then
      insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
      values (
        'Support Ticket Update',
        'An administrator has replied to your ticket: "' || v_ticket.subject || '".',
        'ANNOUNCEMENT',
        'normal',
        now(),
        v_sender_id,
        v_ticket.user_id
      );
    end if;
  else
    update public.support_tickets
    set status = 'IN_PROGRESS',
        updated_at = now()
    where id = p_ticket_id;

    -- Notify ADMINS ONLY
    v_admin_ids := public.get_admin_user_ids();
    if array_length(v_admin_ids, 1) > 0 then
      insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id, admin_only)
      select
        'Support Ticket Reply',
        'User has replied to ticket: "' || v_ticket.subject || '".',
        'ANNOUNCEMENT',
        'normal',
        now(),
        v_sender_id,
        admins.admin_id,
        true
      from unnest(v_admin_ids) as admins(admin_id);
    end if;
  end if;

  return jsonb_build_object('success', true, 'message_id', v_message_id);
end;
$$;

revoke all on function public.add_support_message(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.add_support_message(uuid, text, text, text, bigint, text) to authenticated;

-- 10. Update admin_update_ticket_status to target the ticket owner
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

  -- Notify TICKET OWNER if resolved/closed
  if p_status in ('RESOLVED', 'CLOSED') and v_ticket.user_id is not null then
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

-- 11. Update business verification functions to use recipient_id
-- update_business_compliance - notify business owner when verified
create or replace function public.update_business_compliance(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compliant boolean;
  v_all_approved boolean;
begin
  v_all_approved := public.check_business_documents_approved(p_store_id);

  if v_all_approved then
    -- All documents approved - mark as compliant and verified
    update public.business_compliance
    set is_compliant = true,
        all_documents_approved = true,
        updated_at = now()
    where store_id = p_store_id;

    -- Update store verification status
    update public.stores
    set verification_status = 'VERIFIED',
        updated_at = now()
    where id = p_store_id and verification_status != 'VERIFIED';

    -- Notify business owner ONLY (recipient_id = store owner)
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    select
      'Business Verified',
      'Congratulations! All required documents for ' || s.business_name || ' have been approved. Your business is now verified.',
      'ANNOUNCEMENT',
      'normal',
      now(),
      s.user_id,
      s.user_id
    from public.stores s
    where s.id = p_store_id
      and s.user_id is not null;
  else
    -- Not all approved yet
    update public.business_compliance
    set all_documents_approved = false,
        updated_at = now()
    where store_id = p_store_id;
  end if;
end;
$$;

revoke all on function public.update_business_compliance(uuid) from public, anon;
grant execute on function public.update_business_compliance(uuid) to authenticated, service_role;

-- enforce_business_compliance_deadlines - notify business owner when suspended
create or replace function public.enforce_business_compliance_deadlines()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  suspended_count integer := 0;
  rec record;
begin
  -- Find non-compliant businesses past their deadline
  for rec in
    select bc.store_id, bc.user_id, s.business_name
    from public.business_compliance bc
    join public.stores s on s.id = bc.store_id
    where bc.compliance_deadline <= now()
      and bc.all_documents_approved = false
      and bc.suspended_for_noncompliance = false
  loop
    -- Suspend the business account
    update public.business_compliance
    set suspended_for_noncompliance = true,
        suspension_reason = 'Failed to submit required business documents within 15-day compliance period',
        suspended_at = now(),
        updated_at = now()
    where store_id = rec.store_id;

    -- Update store verification status
    update public.stores
    set verification_status = 'REJECTED'
    where id = rec.store_id and verification_status != 'REJECTED';

    -- Notify business owner ONLY (recipient_id = business owner)
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    values (
      'Business Account Suspended - Document Compliance',
      'Your business "' || rec.business_name || '" has been suspended for failing to submit all required documents (Barangay Clearance, Cedula, Business Permit) within the 15-day compliance period. Please contact LGU administration to resolve.',
      'EMERGENCY',
      'high',
      now(),
      rec.user_id,
      rec.user_id
    );

    -- Also create moderation action record for the user
    insert into public.account_moderation_actions (target_user_id, actor_user_id, action, reason)
    values (rec.user_id, rec.user_id, 'suspend_temporary', 'Automatic suspension: Failed to comply with business document requirements within 15 days');

    suspended_count := suspended_count + 1;
  end loop;

  return suspended_count;
end;
$$;

revoke all on function public.enforce_business_compliance_deadlines() from public, anon, authenticated;
grant execute on function public.enforce_business_compliance_deadlines() to service_role;

-- 12. Grant execute permissions
grant execute on function public.create_business_report(uuid, text, text) to authenticated;
grant execute on function public.create_product_report(uuid, text, text) to authenticated;
grant execute on function public.create_support_ticket(text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.add_support_message(uuid, text, text, text, bigint, text) to authenticated;
grant execute on function public.admin_update_report_status(uuid, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_update_ticket_status(uuid, uuid, text, uuid) to service_role;
grant execute on function public.update_business_compliance(uuid) to authenticated, service_role;
grant execute on function public.enforce_business_compliance_deadlines() to service_role;

-- ============================================================
-- DEPLOYMENT CHECKLIST:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Deploy updated admin-account-moderation and send-push-notification Edge Functions
-- 3. Verify report RPCs create one admin-targeted advisory per active admin
-- 4. Test recipient isolation using separate authenticated accounts
-- ============================================================