import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-compliance-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const certificateLabels: Record<string, string> = {
  locational_clearance: 'Locational / Zoning Clearance',
  cedula: 'Community Tax Certificate (Cedula)',
  fire_safety: 'Fire Safety Inspection Certificate',
  sanitary_permit: 'Sanitary Permit',
  building_occupancy: 'Building Permit and Certificate of Occupancy',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service credentials are not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function authenticate(req: Request, supabaseUrl: string, anonKey: string) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return null

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await authClient.auth.getUser(token)
  return error || !user ? null : user
}

async function requireAdmin(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(`Failed to verify administrator: ${error.message}`)
  if (data?.role !== 'admin') return false
  return true
}

async function restoreAccountIfNoOverdueStores(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  changingStoreId?: string,
) {
  const { data: suspendedStores, error: storesError } = await supabase
    .from('stores')
    .select('id, compliance_deadline_at, compliance_approved_at, compliance_suspended_at')
    .eq('user_id', userId)
  if (storesError) throw new Error(`Failed to check seller compliance: ${storesError.message}`)
  const now = Date.now()
  const hasOverdueStore = (suspendedStores ?? [])
    .filter((store) => store.id !== changingStoreId)
    .some((store) =>
      Boolean(store.compliance_suspended_at)
      || (!store.compliance_approved_at
        && store.compliance_deadline_at
        && Date.parse(store.compliance_deadline_at) <= now)
    )
  if (hasOverdueStore) return

  const { error: unbanError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (unbanError) throw new Error(`Account access could not be restored: ${unbanError.message}`)
}

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('Email service is not configured')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'PaliTrento <no-reply@palitrento.online>',
      to: [to],
      subject,
      text,
    }),
  })

  if (!response.ok) {
    console.error('Certification email delivery failed:', response.status)
    throw new Error(`Email delivery failed (HTTP ${response.status})`)
  }
}

async function notifySubmission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  storeId: string,
) {
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, business_name, user_id')
    .eq('id', storeId)
    .maybeSingle()
  if (error) throw new Error(`Failed to load store: ${error.message}`)
  if (!store || store.user_id !== userId) throw new Error('Store not found')

  const { data: certifications, error: certError } = await supabase
    .from('store_certifications')
    .select('id, certificate_type')
    .eq('store_id', storeId)
    .eq('review_status', 'PENDING')
    .is('submission_notified_at', null)
    .not('storage_path', 'is', null)
  if (certError) throw new Error(`Failed to load submitted certificates: ${certError.message}`)
  if (!certifications?.length) return { success: true, notified: 0 }

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
  if (authError) throw new Error(`Failed to load seller email: ${authError.message}`)
  const email = authData.user.email
  if (!email) throw new Error('Seller account has no email address')

  const labels = [...new Set(certifications.map((cert) => certificateLabels[cert.certificate_type] ?? cert.certificate_type))]
  await sendEmail(
    email,
    'PaliTrento received your business certificates',
    `We received the following certificates for ${store.business_name}: ${labels.join(', ')}.\n\nAn admin will review them, usually within 24 hours. You can continue using your store while the review is pending. The 15-day deadline remains until all required certificates are approved.`,
  )

  const { error: updateError } = await supabase
    .from('store_certifications')
    .update({ submission_notified_at: new Date().toISOString() })
    .in('id', certifications.map((cert) => cert.id))
  if (updateError) throw new Error(`Email sent, but notification status was not saved: ${updateError.message}`)

  return { success: true, notified: certifications.length }
}

async function requestCertificate(
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  certificateType: string,
  notes: string,
) {
  if (!certificateLabels[certificateType]) throw new Error('Choose a valid certificate type')

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, user_id, business_name, compliance_approved_at, compliance_deadline_at, compliance_suspended_at')
    .eq('id', storeId)
    .maybeSingle()
  if (storeError) throw new Error(`Failed to load store: ${storeError.message}`)
  if (!store?.user_id) throw new Error('Store owner was not found')

  const { error: certError } = await supabase
    .from('store_certifications')
    .upsert({
      store_id: storeId,
      certificate_type: certificateType,
      storage_path: null,
      required: true,
      review_status: 'REQUESTED',
      admin_notes: notes || null,
      submitted_at: null,
      submission_notified_at: null,
      reviewed_at: null,
      reviewed_by: null,
    }, { onConflict: 'store_id,certificate_type' })
  if (certError) throw new Error(`Failed to request certificate: ${certError.message}`)

  const update: Record<string, unknown> = { compliance_approved_at: null }
  const deadlinePassed = Boolean(
    store.compliance_deadline_at
    && Date.parse(store.compliance_deadline_at) <= Date.now()
  )
  const reopenCompliance = Boolean(
    store.compliance_approved_at
    || store.compliance_suspended_at
    || deadlinePassed
    || !store.compliance_deadline_at
  )
  const deadline = reopenCompliance
    ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    : new Date(store.compliance_deadline_at)

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(store.user_id)
  if (authError) throw new Error(`Failed to load seller email: ${authError.message}`)
  const email = authData.user.email
  if (!email) throw new Error('Seller account has no email address')

  await sendEmail(
    email,
    'PaliTrento requested an additional certificate',
    `An admin requested ${certificateLabels[certificateType]} for ${store.business_name}.${notes ? `\n\nAdmin note: ${notes}` : ''}\n\nPlease upload it in Store Setup. Your store remains usable while you comply. ${reopenCompliance ? 'Your new 15-day deadline is' : 'Your current deadline is'} ${deadline.toLocaleDateString('en-PH')}. The deadline ends only after all required certificates are approved.`,
  )

  if (store.compliance_suspended_at || deadlinePassed) {
    await restoreAccountIfNoOverdueStores(supabase, store.user_id, storeId)
  }
  if (reopenCompliance) {
    update.compliance_deadline_at = deadline.toISOString()
    update.compliance_notified_at = new Date().toISOString()
    update.compliance_suspended_at = null
  }
  const { error: complianceError } = await supabase
    .from('stores')
    .update(update)
    .eq('id', storeId)
  if (complianceError) throw new Error(`Failed to update compliance deadline: ${complianceError.message}`)

  return { success: true }
}

async function reviewCertificate(
  supabase: ReturnType<typeof createClient>,
  reviewerId: string,
  certificationId: string,
  decision: string,
  notes: string,
) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new Error('Choose approve or reject')
  }

  const { data: certification, error: certError } = await supabase
    .from('store_certifications')
    .select('id, store_id, storage_path, certificate_type')
    .eq('id', certificationId)
    .maybeSingle()
  if (certError) throw new Error(`Failed to load certificate: ${certError.message}`)
  if (!certification) throw new Error('Certificate was not found')
  if (decision === 'APPROVED' && !certification.storage_path) {
    throw new Error('A certificate must be uploaded before it can be approved')
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, user_id, business_name, compliance_deadline_at, compliance_suspended_at')
    .eq('id', certification.store_id)
    .maybeSingle()
  if (storeError) throw new Error(`Failed to load store: ${storeError.message}`)
  if (!store?.user_id) throw new Error('Store owner was not found')

  const { data: certificates, error: listError } = await supabase
    .from('store_certifications')
    .select('id, required, review_status')
    .eq('store_id', certification.store_id)
  if (listError) throw new Error(`Failed to check certification status: ${listError.message}`)

  const required = (certificates ?? []).filter((item) => item.required)
  const compliant = required.length > 0 && required.every((item) =>
    item.id === certificationId
      ? decision === 'APPROVED'
      : item.review_status === 'APPROVED'
  )
  const deadlinePassed = Boolean(
    store.compliance_deadline_at
    && Date.parse(store.compliance_deadline_at) <= Date.now()
  )
  const reopenForReplacement = !compliant
    && decision === 'REJECTED'
    && Boolean(store.compliance_suspended_at || deadlinePassed || !store.compliance_deadline_at)
  const complianceUpdate: Record<string, unknown> = {
    compliance_approved_at: compliant ? new Date().toISOString() : null,
  }
  if (reopenForReplacement) {
    complianceUpdate.compliance_deadline_at = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    complianceUpdate.compliance_notified_at = new Date().toISOString()
  }

  if (decision === 'REJECTED') {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(store.user_id)
    if (authError) throw new Error(`Certificate was rejected, but seller email could not be loaded: ${authError.message}`)
    if (!authData.user.email) throw new Error('Certificate was rejected, but the seller account has no email address')
    const label = certificateLabels[certification.certificate_type] || 'certificate'
    const deadline = reopenForReplacement
      ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      : store.compliance_deadline_at
        ? new Date(store.compliance_deadline_at)
        : null
    const deadlineMessage = deadline
      ? `${reopenForReplacement ? 'Your new 15-day period ends' : 'Your current deadline is'} ${deadline.toLocaleDateString('en-PH')}.`
      : 'Please contact an administrator to confirm your certificate deadline.'
    await sendEmail(
      authData.user.email,
      'PaliTrento needs a replacement certificate',
      `The ${label} for ${store.business_name} needs a replacement.${notes ? `\n\nAdmin note: ${notes}` : ''}\n\nPlease sign in and upload a replacement in Store Setup. ${deadlineMessage} The deadline ends only after all required certificates are approved.`,
    )
  }

  if ((compliant || reopenForReplacement)
    && (store.compliance_suspended_at || deadlinePassed)) {
    await restoreAccountIfNoOverdueStores(supabase, store.user_id, store.id)
  }

  const { error: updateError } = await supabase
    .from('store_certifications')
    .update({
      review_status: decision,
      admin_notes: notes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
    })
    .eq('id', certificationId)
  if (updateError) throw new Error(`Failed to record certificate review: ${updateError.message}`)

  if (compliant || reopenForReplacement) complianceUpdate.compliance_suspended_at = null
  const { error: complianceError } = await supabase
    .from('stores')
    .update(complianceUpdate)
    .eq('id', certification.store_id)
  if (complianceError) throw new Error(`Failed to update compliance status: ${complianceError.message}`)

  return { success: true, compliant }
}

async function notifyExistingSellers(supabase: ReturnType<typeof createClient>) {
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, user_id, business_name')
    .is('compliance_deadline_at', null)
    .is('compliance_approved_at', null)
    .not('user_id', 'is', null)
  if (error) throw new Error(`Failed to load current sellers: ${error.message}`)

  const owners = new Map<string, { storeIds: string[]; storeNames: string[] }>()
  for (const store of stores ?? []) {
    if (!store.user_id) continue
    const owner = owners.get(store.user_id) ?? { storeIds: [], storeNames: [] }
    owner.storeIds.push(store.id)
    owner.storeNames.push(store.business_name)
    owners.set(store.user_id, owner)
  }

  let notified = 0
  let failed = 0
  for (const [userId, owner] of owners) {
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
      if (authError) throw authError
      const email = authData.user.email
      if (!email) throw new Error('Seller account has no email address')

      const now = new Date()
      const deadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
      await sendEmail(
        email,
        'Action required: submit your store certificates within 15 days',
        `Please submit the certificates that apply to your store (${owner.storeNames.join(', ')}) by ${deadline.toLocaleDateString('en-PH')}. You can continue using your store while certificates are being reviewed. If all required certificates are not approved by the deadline, your account will be disabled.\n\nUpload certificates in Store Setup. Admin review usually takes about 24 hours.`,
      )

      const { error: updateError } = await supabase
        .from('stores')
        .update({
          compliance_notified_at: now.toISOString(),
          compliance_deadline_at: deadline.toISOString(),
        })
        .in('id', owner.storeIds)
      if (updateError) throw updateError
      notified += 1
    } catch (error) {
      console.error(`Failed to notify seller ${userId}:`, error)
      failed += 1
    }
  }

  return { success: true, notified, failed }
}

async function enforceDeadlines(supabase: ReturnType<typeof createClient>) {
  const now = new Date().toISOString()
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, user_id, business_name')
    .lte('compliance_deadline_at', now)
    .is('compliance_approved_at', null)
    .is('compliance_suspended_at', null)
    .not('user_id', 'is', null)
  if (error) throw new Error(`Failed to load overdue stores: ${error.message}`)

  const storeGroups = new Map<string, { ids: string[]; names: string[] }>()
  for (const store of stores ?? []) {
    if (!store.user_id) continue
    const group = storeGroups.get(store.user_id) ?? { ids: [], names: [] }
    group.ids.push(store.id)
    group.names.push(store.business_name)
    storeGroups.set(store.user_id, group)
  }

  let disabled = 0
  for (const [userId, group] of storeGroups) {
    const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    })
    if (banError) throw new Error(`Failed to disable seller account ${userId}: ${banError.message}`)

    const { error: updateError } = await supabase
      .from('stores')
      .update({ compliance_suspended_at: now })
      .in('id', group.ids)
    if (updateError) throw new Error(`Failed to suspend overdue stores: ${updateError.message}`)

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
      if (authError) throw authError
      if (authData.user.email) {
        await sendEmail(
          authData.user.email,
          'Your PaliTrento account has been disabled',
          `Your account has been disabled because the required certificates for ${group.names.join(', ')} were not approved before the 15-day deadline. Please contact an administrator and submit the requested certificates for review.`,
        )
      }
    } catch (emailError) {
      console.error(`Seller was disabled, but notification email failed for ${userId}:`, emailError)
    }

    disabled += 1
  }

  return { success: true, disabled }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return jsonResponse({ error: 'Invalid request body' }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }

  try {
    const supabase = getServiceClient()
    const action = body.action

    if (action === 'enforce') {
      const expectedSecret = Deno.env.get('COMPLIANCE_CRON_SECRET')
      if (!expectedSecret || req.headers.get('x-compliance-cron-secret') !== expectedSecret) {
        return jsonResponse({ error: 'Unauthorized scheduler request' }, 401)
      }
      return jsonResponse(await enforceDeadlines(supabase))
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) throw new Error('Supabase authentication is not configured')
    const user = await authenticate(req, supabaseUrl, anonKey)
    if (!user) return jsonResponse({ error: 'Authentication required' }, 401)

    if (action === 'submitted') {
      return jsonResponse(await notifySubmission(supabase, user.id, String(body.storeId ?? '')))
    }

    if (!await requireAdmin(supabase, user.id)) {
      return jsonResponse({ error: 'Administrator access required' }, 403)
    }

    if (action === 'request') {
      return jsonResponse(await requestCertificate(
        supabase,
        String(body.storeId ?? ''),
        String(body.certificateType ?? ''),
        String(body.notes ?? '').trim(),
      ))
    }

    if (action === 'review') {
      return jsonResponse(await reviewCertificate(
        supabase,
        user.id,
        String(body.certificationId ?? ''),
        String(body.decision ?? ''),
        String(body.notes ?? '').trim(),
      ))
    }

    if (action === 'notify_existing') {
      return jsonResponse(await notifyExistingSellers(supabase))
    }

    return jsonResponse({ error: 'Unsupported action' }, 400)
  } catch (error) {
    console.error('Certification workflow failed:', error)
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return jsonResponse({ error: message }, 500)
  }
})
