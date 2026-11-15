import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Helper to send notification to user
async function sendWarningNotification(
  service: ReturnType<typeof createClient>,
  targetUserId: string,
  reason: string,
  actorName: string
) {
  try {
    // Create advisory for the user (warning category)
    const { error } = await service
      .from('advisories')
      .insert({
        title: 'Account Warning',
        body: `Warning from ${actorName}: ${reason}`,
        category: 'GENERAL', // Using GENERAL as warning category
        priority: 'normal',
        published_at: new Date().toISOString(),
        created_by: targetUserId, // System user or admin
      })
    if (error) {
      console.error('Failed to create warning advisory:', error)
    }
  } catch (e) {
    console.error('Error sending warning notification:', e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  try {
    const authorization = req.headers.get('Authorization')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return respond({ error: 'Account moderation is not configured' }, 503)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return respond({ error: 'Please sign in again' }, 401)

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: actor, error: actorError } = await service
      .from('profiles')
      .select('role, account_status, suspended_until, full_name')
      .eq('id', userData.user.id)
      .single()

    const actorIsActive = actor?.account_status === 'active'
      || (actor?.account_status === 'suspended' && actor.suspended_until && new Date(actor.suspended_until).getTime() <= Date.now())
    if (actorError || actor?.role !== 'admin' || !actorIsActive) {
      return respond({ error: 'Only an active administrator can manage accounts' }, 403)
    }

    const body = await req.json()

    // Supported durations in hours: 1d=24, 3d=72, 7d=168, 14d=336, 30d=720
    const SUPPORTED_DURATIONS = [24, 72, 168, 336, 720]

    if (body.action === 'list') {
      const { data: profiles, error: profilesError } = await service
        .from('profiles')
        .select('id, full_name, role, account_status, suspended_until, suspension_reason, suspended_at, banned_at, ban_reason, created_at')
        .order('created_at', { ascending: false })
      if (profilesError) throw profilesError

      // Fetch all auth users for emails
      const users = []
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) throw error
        users.push(...data.users)
        if (data.users.length < 1000) break
      }

      // Fetch moderation history
      const { data: actions, error: actionsError } = await service
        .from('account_moderation_actions')
        .select('target_user_id, actor_user_id, action, reason, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(5000)
      if (actionsError) throw actionsError

      const userById = new Map(users.map((user) => [user.id, user]))
      const historyById = new Map<string, typeof actions>()
      for (const action of actions ?? []) {
        const history = historyById.get(action.target_user_id) ?? []
        if (history.length < 10) history.push(action) // Increased from 5 to 10
        historyById.set(action.target_user_id, history)
      }

      // Fetch actor names for history
      const actorIds = [...new Set(actions?.map(a => a.actor_user_id) ?? [])]
      const { data: actorProfiles } = await service
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds)
      const actorNameById = new Map((actorProfiles ?? []).map(a => [a.id, a.full_name]))

      return respond({
        accounts: (profiles ?? []).map((profile) => {
          const authUser = userById.get(profile.id)
          return {
            ...profile,
            email: authUser?.email ?? '',
            auth_banned: Boolean(authUser?.banned_until && Date.parse(authUser.banned_until) > Date.now()),
            recent_actions: (historyById.get(profile.id) ?? []).map(action => ({
              ...action,
              actor_name: actorNameById.get(action.actor_user_id) ?? 'Unknown admin',
            })),
          }
        }),
      })
    }

    if (body.action === 'moderate') {
      const { targetUserId, moderationAction, reason, durationHours, customDurationDays } = body
      if (typeof targetUserId !== 'string' || typeof reason !== 'string') {
        return respond({ error: 'A target account and reason are required' }, 400)
      }
      if (!['warn', 'suspend_temporary', 'suspend_permanent', 'ban', 'restore', 'unban'].includes(moderationAction)) {
        return respond({ error: 'Unsupported moderation action' }, 400)
      }
      if (targetUserId === userData.user.id) {
        return respond({ error: 'You cannot moderate your own account' }, 400)
      }

      // Validate duration
      let finalDurationHours: number | null = null
      let finalCustomDays: number | null = null

      if (moderationAction === 'suspend_temporary') {
        if (customDurationDays && customDurationDays > 0) {
          finalCustomDays = customDurationDays
          finalDurationHours = customDurationDays * 24
        } else if (durationHours && SUPPORTED_DURATIONS.includes(durationHours)) {
          finalDurationHours = durationHours
        } else {
          return respond({ error: 'Choose a supported temporary suspension duration (1, 3, 7, 14, 30 days, or custom)' }, 400)
        }
      }

      if (moderationAction === 'restore' || moderationAction === 'unban') {
        const { error: authUnbanError } = await service.auth.admin.updateUserById(
          targetUserId,
          { ban_duration: 'none' },
        )
        if (authUnbanError) {
          return respond({ error: `Could not restore sign-in access: ${authUnbanError.message}` }, 400)
        }
      }

      const { data: result, error: moderationError } = await service.rpc('admin_moderate_account', {
        p_actor_id: userData.user.id,
        p_target_user_id: targetUserId,
        p_action: moderationAction,
        p_reason: reason,
        p_duration_hours: finalDurationHours,
        p_custom_duration_days: finalCustomDays,
      })
      if (moderationError) return respond({ error: moderationError.message }, 400)

      // Send warning notification for warn action
      if (moderationAction === 'warn') {
        await sendWarningNotification(service, targetUserId, reason, actor?.full_name ?? 'Admin')
      }

      return respond({ result })
    }

    if (body.action === 'get_status') {
      const { targetUserId } = body
      if (!targetUserId) {
        return respond({ error: 'Target user ID required' }, 400)
      }

      const { data, error } = await service.rpc('get_account_status', { p_user_id: targetUserId })
      if (error) return respond({ error: error.message }, 400)

      return respond({ status: data })
    }

    return respond({ error: 'Unsupported request' }, 400)
  } catch (error) {
    console.error('Account moderation error:', error)
    return respond({ error: 'Account moderation request failed' }, 500)
  }
})
