-- PaliTrento permit submission and approval workflow.
-- Run after store-submission.sql and business-verification.sql.

alter table public.stores
  add column if not exists barangay_clearance_image_url text,
  add column if not exists cedula_image_url text,
  add column if not exists business_permit_image_url text,
  add column if not exists approval_status text not null default 'PENDING'
    check (approval_status in ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED')),
  add column if not exists certificate_status text not null default 'NONE'
    check (certificate_status in ('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  add column if not exists certificate_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspension_reason text,
  add column if not exists admin_notes text,
  add column if not exists barangay_clearance_status text not null default 'PENDING'
    check (barangay_clearance_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column if not exists cedula_status text not null default 'PENDING'
    check (cedula_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column if not exists business_permit_status text not null default 'PENDING'
    check (business_permit_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column if not exists barangay_clearance_review_note text,
  add column if not exists cedula_review_note text,
  add column if not exists business_permit_review_note text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists stores_approval_status_idx on public.stores(approval_status);
create index if not exists stores_certificate_status_idx on public.stores(certificate_status);
create index if not exists stores_is_suspended_idx on public.stores(is_suspended) where is_suspended = true;

update public.stores
set barangay_clearance_status = 'APPROVED',
    cedula_status = 'APPROVED',
    business_permit_status = 'APPROVED'
where approval_status = 'APPROVED'
  and certificate_status = 'APPROVED'
  and nullif(trim(barangay_clearance_image_url), '') is not null
  and nullif(trim(cedula_image_url), '') is not null
  and nullif(trim(business_permit_image_url), '') is not null;

alter table public.business_compliance
  add column if not exists compliance_paused_at timestamptz,
  add column if not exists compliance_remaining_seconds integer,
  add column if not exists countdown_started_at timestamptz,
  add column if not exists approval_notice_acknowledged boolean not null default false,
  alter column compliance_deadline drop not null;

create index if not exists business_compliance_paused_idx
  on public.business_compliance(compliance_paused_at)
  where compliance_paused_at is not null;

create or replace function public.acknowledge_business_approval(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.business_compliance bc
  set approval_notice_acknowledged = true,
      updated_at = now()
  where bc.store_id = p_store_id
    and exists (
      select 1
      from public.stores s
      where s.id = bc.store_id
        and s.user_id = auth.uid()
    );

  if not found then
    raise exception 'Business compliance record not found for current user';
  end if;
end;
$$;

revoke all on function public.acknowledge_business_approval(uuid) from public, anon;
grant execute on function public.acknowledge_business_approval(uuid) to authenticated;

-- Return legacy auto-suspended stores to review, but preserve manual suspensions.
update public.stores
set is_suspended = false,
    suspension_reason = null,
    approval_status = case
      when nullif(trim(barangay_clearance_image_url), '') is null
        or nullif(trim(cedula_image_url), '') is null
        or nullif(trim(business_permit_image_url), '') is null
      then 'PENDING'
      else approval_status
    end,
    certificate_status = case
      when nullif(trim(barangay_clearance_image_url), '') is null
        or nullif(trim(cedula_image_url), '') is null
        or nullif(trim(business_permit_image_url), '') is null
      then 'NONE'
      else certificate_status
    end,
    verification_status = case
      when nullif(trim(barangay_clearance_image_url), '') is null
        or nullif(trim(cedula_image_url), '') is null
        or nullif(trim(business_permit_image_url), '') is null
      then 'PENDING'
      else verification_status
    end,
    verified_at = case
      when nullif(trim(barangay_clearance_image_url), '') is null
        or nullif(trim(cedula_image_url), '') is null
        or nullif(trim(business_permit_image_url), '') is null
      then null
      else verified_at
    end,
    updated_at = now()
where suspension_reason = 'Failed to submit required business documents within 15-day compliance period';

-- Incomplete legacy submissions must be resubmitted with all three permits.
update public.stores
set approval_status = 'PENDING',
    certificate_status = 'NONE',
    verification_status = 'PENDING',
    verified_at = null,
    updated_at = now()
where nullif(trim(barangay_clearance_image_url), '') is null
   or nullif(trim(cedula_image_url), '') is null
   or nullif(trim(business_permit_image_url), '') is null;

-- Complete but previously unverified stores still require Admin review.
update public.stores
set approval_status = 'PENDING',
    certificate_status = 'NONE',
    verification_status = 'PENDING',
    verified_at = null,
    updated_at = now()
where approval_status = 'APPROVED'
  and certificate_status <> 'APPROVED'
  and nullif(trim(barangay_clearance_image_url), '') is not null
  and nullif(trim(cedula_image_url), '') is not null
  and nullif(trim(business_permit_image_url), '') is not null;

update public.stores
set verification_status = 'VERIFIED',
    verified_at = coalesce(verified_at, now()),
    updated_at = now()
where approval_status = 'APPROVED'
  and certificate_status = 'APPROVED'
  and not is_suspended
  and nullif(trim(barangay_clearance_image_url), '') is not null
  and nullif(trim(cedula_image_url), '') is not null
  and nullif(trim(business_permit_image_url), '') is not null;

update public.stores
set verification_status = 'PENDING',
    updated_at = now()
where verification_status = 'CLARIFICATION_REQUIRED'
  and approval_status = 'PENDING';

update public.business_compliance
set compliance_deadline = null,
    compliance_paused_at = null,
    compliance_remaining_seconds = null,
    countdown_started_at = null,
    suspended_for_noncompliance = false,
    suspension_reason = null,
    suspended_at = null,
    updated_at = now();

alter table public.stores
  drop constraint if exists stores_all_required_permits_check;
alter table public.stores
  add constraint stores_all_required_permits_check
  check (
    nullif(trim(barangay_clearance_image_url), '') is not null
    and nullif(trim(cedula_image_url), '') is not null
    and nullif(trim(business_permit_image_url), '') is not null
  ) not valid;

create or replace function public.get_store_display_status(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_compliance public.business_compliance%rowtype;
begin
  select * into v_store from public.stores where id = p_store_id;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND', 'badge_class', 'warn', 'label', 'Not Found');
  end if;

  select * into v_compliance from public.business_compliance where store_id = p_store_id;

  if v_store.is_suspended or v_store.approval_status = 'SUSPENDED' then
    return jsonb_build_object(
      'status', 'SUSPENDED',
      'badge_class', 'bad',
      'label', 'Suspended',
      'message', v_store.suspension_reason
    );
  end if;

  if v_store.approval_status = 'PENDING' then
    return jsonb_build_object(
      'status', 'PENDING_APPROVAL',
      'badge_class', 'warn',
      'label', 'Pending Approval',
      'message', 'Your store and required permits are awaiting Admin review.'
    );
  end if;

  if v_store.approval_status = 'REJECTED' then
    return jsonb_build_object(
      'status', 'REJECTED',
      'badge_class', 'bad',
      'label', 'Rejected',
      'message', 'Your business submission was rejected. Please contact Admin administration.'
    );
  end if;

  if v_store.approval_status = 'APPROVED'
     and v_store.certificate_status = 'APPROVED'
     and nullif(trim(v_store.barangay_clearance_image_url), '') is not null
     and nullif(trim(v_store.cedula_image_url), '') is not null
     and nullif(trim(v_store.business_permit_image_url), '') is not null then
    return jsonb_build_object(
      'status', 'VERIFIED',
      'badge_class', 'ok',
      'label', 'Verified',
      'message', 'Your store and all required permits have been approved.',
      'approval_notice_acknowledged', coalesce(v_compliance.approval_notice_acknowledged, false),
      'verified_at', v_store.verified_at
    );
  end if;

  return jsonb_build_object(
    'status', 'PENDING_APPROVAL',
    'badge_class', 'warn',
    'label', 'Pending Approval',
    'message', 'Your store and required permits are awaiting Admin review.'
  );
end;
$$;

revoke all on function public.get_store_display_status(uuid) from public, anon;
grant execute on function public.get_store_display_status(uuid) to authenticated, service_role;

create or replace function public.admin_approve_store_submission(
  p_actor_id uuid,
  p_store_id uuid,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_store public.stores%rowtype;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role is distinct from 'admin'
     or (auth.uid() is not null and auth.uid() is distinct from p_actor_id) then
    raise exception 'Only administrators can approve store submissions';
  end if;

  select * into v_store from public.stores where id = p_store_id for update;
  if not found then
    raise exception 'Store not found';
  end if;
  if v_store.is_suspended or v_store.approval_status = 'SUSPENDED' then
    raise exception 'Suspended stores must be restored by an administrator';
  end if;
  if nullif(trim(v_store.barangay_clearance_image_url), '') is null
     or nullif(trim(v_store.cedula_image_url), '') is null
     or nullif(trim(v_store.business_permit_image_url), '') is null then
    raise exception 'All three required permits must be uploaded before the store can be approved';
  end if;
  if v_store.barangay_clearance_status <> 'APPROVED'
     or v_store.cedula_status <> 'APPROVED'
     or v_store.business_permit_status <> 'APPROVED' then
    raise exception 'Each required permit must be approved before the store can be approved';
  end if;

  update public.stores
  set approval_status = 'APPROVED',
      certificate_status = 'APPROVED',
      verification_status = 'VERIFIED',
      verified_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  where id = p_store_id;

  insert into public.business_compliance as existing_compliance (
    store_id, user_id, compliance_deadline, compliance_paused_at,
    compliance_remaining_seconds, countdown_started_at, is_compliant,
    all_documents_approved, suspended_for_noncompliance,
    approval_notice_acknowledged, updated_at
  )
  values (
    p_store_id, v_store.user_id, null, null, null, null, true,
    true, false, false, now()
  )
  on conflict (store_id) do update set
    compliance_deadline = null,
    compliance_paused_at = null,
    compliance_remaining_seconds = null,
    countdown_started_at = null,
    is_compliant = true,
    all_documents_approved = true,
    suspended_for_noncompliance = false,
    suspension_reason = null,
    suspended_at = null,
    approval_notice_acknowledged = case
      when v_store.approval_status = 'APPROVED'
       and v_store.certificate_status = 'APPROVED'
      then existing_compliance.approval_notice_acknowledged
      else false
    end,
    updated_at = now();

  insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
  values (
    'Business Approved',
    'Your business "' || v_store.business_name || '" and all required permits have been approved.',
    'ANNOUNCEMENT',
    'normal',
    now(),
    p_actor_id,
    v_store.user_id
  );

  return jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'approval_status', 'APPROVED',
    'certificate_status', 'APPROVED',
    'verified_at', now()
  );
end;
$$;

revoke all on function public.admin_approve_store_submission(uuid, uuid, text) from public, anon;
grant execute on function public.admin_approve_store_submission(uuid, uuid, text) to authenticated, service_role;

create or replace function public.admin_review_store_permit(
  p_actor_id uuid,
  p_store_id uuid,
  p_permit_type text,
  p_action text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_store public.stores%rowtype;
  v_all_approved boolean;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role is distinct from 'admin'
     or (auth.uid() is not null and auth.uid() is distinct from p_actor_id) then
    raise exception 'Only administrators can review store permits';
  end if;

  if p_action is null or p_action not in ('APPROVE', 'REJECT') then
    raise exception 'Invalid permit review action';
  end if;
  if p_permit_type is null or p_permit_type not in ('BARANGAY_CLEARANCE', 'CEDULA', 'BUSINESS_PERMIT') then
    raise exception 'Invalid permit type';
  end if;
  if p_action = 'REJECT' and nullif(trim(p_review_note), '') is null then
    raise exception 'A reason is required when rejecting a permit';
  end if;

  select * into v_store from public.stores where id = p_store_id for update;
  if not found then
    raise exception 'Store not found';
  end if;

  if p_permit_type = 'BARANGAY_CLEARANCE' then
    if nullif(trim(v_store.barangay_clearance_image_url), '') is null then
      raise exception 'Barangay Business Clearance has not been submitted';
    end if;
    update public.stores
    set barangay_clearance_status = case when p_action = 'APPROVE' then 'APPROVED' else 'REJECTED' end,
        barangay_clearance_review_note = case when p_action = 'REJECT' then trim(p_review_note) else null end,
        updated_at = now()
    where id = p_store_id;
  elsif p_permit_type = 'CEDULA' then
    if nullif(trim(v_store.cedula_image_url), '') is null then
      raise exception 'Cedula has not been submitted';
    end if;
    update public.stores
    set cedula_status = case when p_action = 'APPROVE' then 'APPROVED' else 'REJECTED' end,
        cedula_review_note = case when p_action = 'REJECT' then trim(p_review_note) else null end,
        updated_at = now()
    where id = p_store_id;
  else
    if nullif(trim(v_store.business_permit_image_url), '') is null then
      raise exception 'Business Permit has not been submitted';
    end if;
    update public.stores
    set business_permit_status = case when p_action = 'APPROVE' then 'APPROVED' else 'REJECTED' end,
        business_permit_review_note = case when p_action = 'REJECT' then trim(p_review_note) else null end,
        updated_at = now()
    where id = p_store_id;
  end if;

  if p_action = 'REJECT' then
    update public.stores
    set approval_status = 'PENDING',
        certificate_status = 'NONE',
        verification_status = 'PENDING',
        verified_at = null,
        updated_at = now()
    where id = p_store_id;

    update public.business_compliance
    set is_compliant = false,
        all_documents_approved = false,
        approval_notice_acknowledged = false,
        updated_at = now()
    where store_id = p_store_id;
  end if;

  select barangay_clearance_status = 'APPROVED'
     and cedula_status = 'APPROVED'
     and business_permit_status = 'APPROVED'
  into v_all_approved
  from public.stores
  where id = p_store_id;

  return jsonb_build_object(
    'success', true,
    'permit_type', p_permit_type,
    'status', case when p_action = 'APPROVE' then 'APPROVED' else 'REJECTED' end,
    'all_permits_approved', coalesce(v_all_approved, false)
  );
end;
$$;
revoke all on function public.admin_review_store_permit(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.admin_review_store_permit(uuid, uuid, text, text, text) to authenticated, service_role;

-- Retain old RPC signatures so stale clients and scheduled jobs fail safely.
create or replace function public.submit_store_certificate(
  p_store_id uuid,
  p_document_type text,
  p_file_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Permits must be uploaded with the store application, not after approval';
end;
$$;
revoke all on function public.submit_store_certificate(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.submit_store_certificate(uuid, text, text, text, bigint, text) to authenticated;

create or replace function public.admin_review_business_document(
  p_actor_id uuid,
  p_document_id uuid,
  p_action text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Review permits from the store submission; post-approval document review is disabled';
end;
$$;
revoke all on function public.admin_review_business_document(uuid, uuid, text, text) from public, anon;
grant execute on function public.admin_review_business_document(uuid, uuid, text, text) to authenticated, service_role;
revoke insert, update on public.business_documents from authenticated;

create or replace function public.update_business_compliance(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;
revoke all on function public.update_business_compliance(uuid) from public, anon, authenticated;
grant execute on function public.update_business_compliance(uuid) to service_role;

create or replace function public.enforce_business_compliance_deadlines()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0;
end;
$$;
revoke all on function public.enforce_business_compliance_deadlines() from public, anon, authenticated;
grant execute on function public.enforce_business_compliance_deadlines() to service_role;

create or replace function public.create_business_compliance_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_compliance (
    store_id, user_id, compliance_deadline, is_compliant, all_documents_approved
  )
  values (new.id, new.user_id, null, false, false)
  on conflict (store_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_business_compliance_trigger on public.stores;
create trigger create_business_compliance_trigger
  after insert on public.stores
  for each row execute function public.create_business_compliance_record();

create or replace function public.prevent_owner_store_review_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_permit_changed boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into v_actor_role from public.profiles where id = auth.uid();
  if v_actor_role = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.approval_status <> 'PENDING'
       or new.certificate_status <> 'NONE'
       or new.verification_status <> 'PENDING'
       or new.certificate_url is not null
       or new.verified_at is not null
       or new.is_suspended
       or new.suspension_reason is not null
       or new.admin_notes is not null then
      raise exception 'Store review fields can only be set by an administrator';
    end if;
  elsif new.approval_status is distinct from old.approval_status
     or new.certificate_status is distinct from old.certificate_status
     or new.verification_status is distinct from old.verification_status
     or new.certificate_url is distinct from old.certificate_url
     or new.verified_at is distinct from old.verified_at
     or new.is_suspended is distinct from old.is_suspended
     or new.suspension_reason is distinct from old.suspension_reason
     or new.admin_notes is distinct from old.admin_notes
     or (new.barangay_clearance_status is distinct from old.barangay_clearance_status
         and new.barangay_clearance_image_url is not distinct from old.barangay_clearance_image_url)
     or (new.cedula_status is distinct from old.cedula_status
         and new.cedula_image_url is not distinct from old.cedula_image_url)
     or (new.business_permit_status is distinct from old.business_permit_status
         and new.business_permit_image_url is not distinct from old.business_permit_image_url)
     or (new.barangay_clearance_review_note is distinct from old.barangay_clearance_review_note
         and new.barangay_clearance_image_url is not distinct from old.barangay_clearance_image_url)
     or (new.cedula_review_note is distinct from old.cedula_review_note
         and new.cedula_image_url is not distinct from old.cedula_image_url)
     or (new.business_permit_review_note is distinct from old.business_permit_review_note
         and new.business_permit_image_url is not distinct from old.business_permit_image_url) then
    raise exception 'Store review fields can only be changed by an administrator';
  end if;

  if tg_op = 'UPDATE' then
    if new.barangay_clearance_image_url is distinct from old.barangay_clearance_image_url then
      v_permit_changed := true;
      new.barangay_clearance_status := 'PENDING';
      new.barangay_clearance_review_note := null;
    end if;
    if new.cedula_image_url is distinct from old.cedula_image_url then
      v_permit_changed := true;
      new.cedula_status := 'PENDING';
      new.cedula_review_note := null;
    end if;
    if new.business_permit_image_url is distinct from old.business_permit_image_url then
      v_permit_changed := true;
      new.business_permit_status := 'PENDING';
      new.business_permit_review_note := null;
    end if;
    if v_permit_changed then
      new.approval_status := 'PENDING';
      new.certificate_status := 'NONE';
      new.verification_status := 'PENDING';
      new.verified_at := null;
      update public.business_compliance
      set is_compliant = false,
          all_documents_approved = false,
          approval_notice_acknowledged = false,
          updated_at = now()
      where store_id = old.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_owner_store_review_changes_trigger on public.stores;
create trigger prevent_owner_store_review_changes_trigger
  before insert or update on public.stores
  for each row execute function public.prevent_owner_store_review_changes();

notify pgrst, 'reload schema';
