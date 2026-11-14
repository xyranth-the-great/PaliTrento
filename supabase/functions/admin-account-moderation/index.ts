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
      .select('role, account_status, suspended_until')
      .eq('id', userData.user.id)
      .single()

    const actorIsActive = actor?.account_status === 'active'
      || (actor?.account_status === 'suspended' && actor.suspended_until && new Date(actor.suspended_until).getTime() <= Date.now())
    if (actorError || actor?.role !== 'admin' || !actorIsActive) {
      return respond({ error: 'Only an active administrator can manage accounts' }, 403)
    }

    const body = await req.json()
    if (body.action === 'list') {
      const { data: profiles, error: profilesError } = await service
        .from('profiles')
        .select('id, full_name, role, account_status, suspended_until, suspension_reason, created_at')
        .order('created_at', { ascending: false })
      if (profilesError) throw profilesError

      const users = []
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) throw error
        users.push(...data.users)
        if (data.users.length < 1000) break
      }

      const { data: actions, error: actionsError } = await service
        .from('account_moderation_actions')
        .select('target_user_id, action, reason, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(5000)
      if (actionsError) throw actionsError

      const emailById = new Map(users.map((user) => [user.id, user.email ?? '']))
      const historyById = new Map<string, typeof actions>()
      for (const action of actions ?? []) {
        const history = historyById.get(action.target_user_id) ?? []
        if (history.length < 5) history.push(action)
        historyById.set(action.target_user_id, history)
      }

      return respond({
        accounts: (profiles ?? []).map((profile) => ({
          ...profile,
          email: emailById.get(profile.id) ?? '',
          recent_actions: historyById.get(profile.id) ?? [],
        })),
      })
    }

    if (body.action === 'moderate') {
      const { targetUserId, moderationAction, reason, durationHours } = body
      if (typeof targetUserId !== 'string' || typeof reason !== 'string') {
        return respond({ error: 'A target account and reason are required' }, 400)
      }

      const { data: result, error: moderationError } = await service.rpc('admin_moderate_account', {
        p_actor_id: userData.user.id,
        p_target_user_id: targetUserId,
        p_action: moderationAction,
        p_reason: reason,
        p_duration_hours: durationHours ?? null,
      })
      if (moderationError) return respond({ error: moderationError.message }, 400)

      let authWarning = null
      if (moderationAction === 'suspend_temporary' || moderationAction === 'suspend_permanent' || moderationAction === 'restore') {
        const banDuration = moderationAction === 'restore'
          ? 'none'
          : moderationAction === 'suspend_permanent'
            ? '876000h'
            : `${durationHours}h`
        const { error } = await service.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration })
        if (error) authWarning = 'Database access is blocked, but the sign-in lock could not be updated. Check Supabase Auth configuration.'
      }

      return respond({ result, warning: authWarning })
    }

    return respond({ error: 'Unsupported request' }, 400)
  } catch (error) {
    console.error('Account moderation error:', error)
    return respond({ error: 'Account moderation request failed' }, 500)
  }
})