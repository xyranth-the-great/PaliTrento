-- Run in Supabase SQL Editor after applying verification-workflow-fix.sql.
-- Uses existing admin and business-owner profiles and removes its test rows.
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_result jsonb;
  v_compliance public.business_compliance%rowtype;
  v_status jsonb;
  v_missing_permit_rejected boolean := false;
  v_unreviewed_permits_blocked boolean := false;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'Permit workflow tests skipped: admin and business-owner profiles are required';
    return;
  end if;

  begin
    insert into public.stores (
      user_id, trn_code, business_name, trade_category, proprietor_name,
      barangay, purok, landmark_reference
    )
    values (
      v_owner_id, 'TRN-PERMIT-TEST-MISSING', 'Permit Test Missing',
      'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza'
    );
  exception when check_violation then
    v_missing_permit_rejected := true;
  end;
  assert v_missing_permit_rejected,
    'Store submission without all three permit URLs should be rejected';

  insert into public.stores (
    user_id, trn_code, business_name, trade_category, proprietor_name,
    barangay, purok, landmark_reference, barangay_clearance_image_url,
    cedula_image_url, business_permit_image_url
  )
  values (
    v_owner_id, 'TRN-PERMIT-TEST-COMPLETE', 'Permit Test Complete',
    'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza',
    'https://example.test/clearance.jpg',
    'https://example.test/cedula.jpg',
    'https://example.test/business-permit.jpg'
  )
  returning id into v_store_id;

  begin
    perform public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval');
  exception when raise_exception then
    if sqlerrm = 'Each required permit must be approved before the store can be approved' then
      v_unreviewed_permits_blocked := true;
    else
      raise;
    end if;
  end;
  assert v_unreviewed_permits_blocked,
    'Store approval should be blocked until each permit is reviewed individually';

  perform public.admin_review_store_permit(
    v_admin_id, v_store_id, 'BARANGAY_CLEARANCE', 'APPROVE', null
  );
  perform public.admin_review_store_permit(
    v_admin_id, v_store_id, 'CEDULA', 'APPROVE', null
  );
  perform public.admin_review_store_permit(
    v_admin_id, v_store_id, 'BUSINESS_PERMIT', 'APPROVE', null
  );

  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval')
  into v_result;
  assert v_result->>'success' = 'true', 'Approval with all permits should succeed';
  assert v_result->>'approval_status' = 'APPROVED', 'Store should be approved';
  assert v_result->>'certificate_status' = 'APPROVED', 'All permits should be verified with approval';
  assert (select verification_status from public.stores where id = v_store_id) = 'VERIFIED',
    'Verified store status should be set';
  assert (
    select barangay_clearance_status = 'APPROVED'
       and cedula_status = 'APPROVED'
       and business_permit_status = 'APPROVED'
    from public.stores
    where id = v_store_id
  ), 'Each permit should retain its individual review result';

  select * into v_compliance
  from public.business_compliance
  where store_id = v_store_id;
  assert v_compliance.compliance_deadline is null, 'No permit deadline should be set';
  assert v_compliance.countdown_started_at is null, 'No countdown should be started';
  assert v_compliance.is_compliant, 'Approved permits should mark compliance complete';
  assert not v_compliance.approval_notice_acknowledged,
    'A fresh approval should show the acknowledgement notice';

  select public.get_store_display_status(v_store_id) into v_status;
  assert v_status->>'status' = 'VERIFIED', 'Approved permits should display as verified';
  assert v_status->>'approval_notice_acknowledged' = 'false',
    'Approval acknowledgement state should be returned';
  assert public.enforce_business_compliance_deadlines() = 0,
    'Legacy deadline enforcement must be a no-op';

  delete from public.advisories
  where recipient_id = v_owner_id
    and title = 'Business Approved'
    and body like '%Permit Test Complete%';
  delete from public.stores where id = v_store_id;
  raise notice 'Permit workflow tests passed';
exception when others then
  delete from public.advisories
  where recipient_id = v_owner_id
    and title = 'Business Approved'
    and body like '%Permit Test Complete%';
  if v_store_id is not null then
    delete from public.stores where id = v_store_id;
  end if;
  raise;
end;
$$;
