import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function listFiles(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<string[]> {
  const files: string[] = []

  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path, { limit: 100, offset })

    if (error) throw new Error(`Failed to list ${bucket} files: ${error.message}`)

    for (const entry of data ?? []) {
      const entryPath = `${path}/${entry.name}`
      if (entry.id === null) {
        files.push(...await listFiles(supabase, bucket, entryPath))
      } else {
        files.push(entryPath)
      }
    }

    if (!data || data.length < 100) break
  }

  return files
}

async function removeUserFiles(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
) {
  const files = await listFiles(supabase, bucket, userId)

  for (let offset = 0; offset < files.length; offset += 100) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove(files.slice(offset, offset + 100))

    if (error) throw new Error(`Failed to remove ${bucket} files: ${error.message}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { confirmation?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }
  if (body.confirmation !== 'DELETE') {
    return jsonResponse({ error: 'Account deletion was not confirmed' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Account deletion requires Supabase URL, anon key, and service role key')
    return jsonResponse({ error: 'Account deletion is not configured' }, 500)
  }

  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return jsonResponse({ error: 'Authentication required' }, 401)

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Invalid session' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: stores, error: storesError } = await adminClient
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
    if (storesError) throw new Error(`Failed to load stores: ${storesError.message}`)

    const storeIds = (stores ?? []).map((store) => store.id)
    let orderQuery = adminClient.from('orders').select('id')
    if (storeIds.length) {
      orderQuery = orderQuery.or(`buyer_id.eq.${user.id},store_id.in.(${storeIds.join(',')})`)
    } else {
      orderQuery = orderQuery.eq('buyer_id', user.id)
    }
    const { data: orders, error: ordersError } = await orderQuery
    if (ordersError) throw new Error(`Failed to load orders: ${ordersError.message}`)

    const orderIds = (orders ?? []).map((order) => order.id)
    const { error: senderMessagesError } = await adminClient
      .from('messages')
      .delete()
      .eq('sender_id', user.id)
    if (senderMessagesError) throw new Error(`Failed to delete sent messages: ${senderMessagesError.message}`)

    if (orderIds.length) {
      const { error } = await adminClient.from('messages').delete().in('order_id', orderIds)
      if (error) throw new Error(`Failed to delete order messages: ${error.message}`)

      const { error: deleteOrdersError } = await adminClient.from('orders').delete().in('id', orderIds)
      if (deleteOrdersError) throw new Error(`Failed to delete orders: ${deleteOrdersError.message}`)
    }

    for (const bucket of ['avatars', 'store-images', 'product-images']) {
      await removeUserFiles(adminClient, bucket, user.id)
    }

    const { error: auditError } = await adminClient
      .from('stores')
      .update({ verified_by: null })
      .eq('verified_by', user.id)
    if (auditError) throw new Error(`Failed to clear store audit references: ${auditError.message}`)

    const { error: storeDeleteError } = await adminClient
      .from('stores')
      .delete()
      .eq('user_id', user.id)
    if (storeDeleteError) throw new Error(`Failed to delete stores: ${storeDeleteError.message}`)

    const { error: advisoryError } = await adminClient
      .from('advisories')
      .update({ created_by: null })
      .eq('created_by', user.id)
    if (advisoryError) throw new Error(`Failed to clear advisory ownership: ${advisoryError.message}`)

    if (user.email) {
      const { error: otpError } = await adminClient
        .from('email_otp_codes')
        .delete()
        .eq('email', user.email.trim().toLowerCase())
      if (otpError) throw new Error(`Failed to delete email verification data: ${otpError.message}`)
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteUserError) throw new Error(`Failed to delete Auth user: ${deleteUserError.message}`)

    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Account deletion failed:', error)
    return jsonResponse({ error: 'Account deletion failed. Your account may still be active.' }, 500)
  }
})
