import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PushChannelId = 'default' | 'orders' | 'messages' | 'advisories' | 'moderation';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface PushMessageSpec {
  title: string;
  body: string;
  channelId: PushChannelId;
  color?: string;
  tag?: string;
  route: {
    pathname: string;
    params?: Record<string, string>;
    orderId?: string;
    type?: string;
    action_url?: string;
  };
}

interface PrefsRow {
  id: string;
  push?: boolean | null;
  orders?: boolean | null;
  messages?: boolean | null;
  price_caps?: boolean | null;
  store_announcements?: boolean | null;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64Url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const iat = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(pem);
  const keyBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned))
  );
  const jwt = `${unsigned}.${base64Url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || 'Failed to obtain Google OAuth token for FCM');
  }

  cachedAccessToken = {
    token: json.access_token as string,
    expiresAt: now + Math.max(300, Number(json.expires_in || 3600) - 300) * 1000,
  };
  return cachedAccessToken.token;
}

function truncateText(text: string, maxLen = 180): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function buildDataPayload(spec: PushMessageSpec): Record<string, string> {
  const nested: Record<string, unknown> = {
    pathname: spec.route.pathname,
  };
  if (spec.route.params && Object.keys(spec.route.params).length > 0) {
    nested.params = spec.route.params;
  }
  if (spec.route.orderId) nested.orderId = spec.route.orderId;
  if (spec.route.type) nested.type = spec.route.type;
  if (spec.route.action_url) nested.action_url = spec.route.action_url;

  const flat: Record<string, string> = {
    pathname: spec.route.pathname,
    channelId: spec.channelId,
    // expo-notifications reads `data["body"]` as JSON for content.data on Android
    body: JSON.stringify(nested),
  };
  if (spec.route.orderId) flat.orderId = spec.route.orderId;
  if (spec.route.type) flat.type = spec.route.type;
  if (spec.route.action_url) flat.action_url = spec.route.action_url;
  if (spec.tag) flat.tag = spec.tag;
  return flat;
}

async function sendFcmToUserIds(
  service: ReturnType<typeof createClient>,
  userIds: string[],
  spec: PushMessageSpec,
  prefFilter?: {
    mandatory?: boolean;
    category?: 'orders' | 'messages' | 'price_caps' | 'store_announcements';
  }
): Promise<{ sent: number; attempted: number; removed: number }> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { sent: 0, attempted: 0, removed: 0 };

  const rawSa = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!rawSa) {
    console.error('[send-mobile-push] FIREBASE_SERVICE_ACCOUNT_JSON secret is missing');
    return { sent: 0, attempted: 0, removed: 0 };
  }

  let eligibleIds = uniqueIds;
  if (!prefFilter?.mandatory) {
    const { data: prefRows } = await service
      .from('notification_preferences')
      .select('id, push, orders, messages, price_caps, store_announcements')
      .in('id', uniqueIds);

    const prefMap = new Map<string, PrefsRow>();
    for (const row of (prefRows ?? []) as PrefsRow[]) {
      prefMap.set(row.id, row);
    }

    eligibleIds = uniqueIds.filter((uid) => {
      const p = prefMap.get(uid);
      // Mobile default is ON when no preference row exists or column is null
      if (!p) return true;
      if (p.push === false) return false;
      if (prefFilter?.category && p[prefFilter.category] === false) return false;
      return true;
    });
  }

  if (eligibleIds.length === 0) return { sent: 0, attempted: 0, removed: 0 };

  const { data: tokenRows, error: tokenErr } = await service
    .from('mobile_push_tokens')
    .select('user_id, token, platform')
    .in('user_id', eligibleIds);

  if (tokenErr) {
    console.error('[send-mobile-push] failed loading tokens:', tokenErr.message);
    return { sent: 0, attempted: 0, removed: 0 };
  }

  const tokens = (tokenRows ?? []) as Array<{ user_id: string; token: string; platform: string }>;
  if (tokens.length === 0) return { sent: 0, attempted: 0, removed: 0 };

  const sa = JSON.parse(rawSa) as ServiceAccount;
  const accessToken = await getGoogleAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const dataPayload = buildDataPayload(spec);

  let sent = 0;
  let removed = 0;

  // Send in small parallel batches so bursts stay fast without overloading FCM
  const BATCH_SIZE = 15;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const slice = tokens.slice(i, i + BATCH_SIZE);
    await Promise.all(
      slice.map(async (row) => {
        try {
          const messageBody: Record<string, unknown> = {
            token: row.token,
            notification: {
              title: truncateText(spec.title, 100),
              body: truncateText(spec.body, 220),
            },
            android: {
              priority: 'HIGH',
              notification: {
                channel_id: spec.channelId,
                color: spec.color || (spec.channelId === 'moderation' ? '#DC2626' : '#1B4329'),
                sound: 'default',
                default_vibrate_timings: true,
                visibility: 'PUBLIC',
                ...(spec.tag ? { tag: spec.tag } : {}),
              },
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
            data: dataPayload,
          };

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: messageBody }),
          });

          if (res.ok) {
            sent += 1;
          } else {
            const errText = await res.text();
            console.warn(
              `[send-mobile-push] FCM error (${res.status}) for user ${row.user_id}:`,
              errText.slice(0, 300)
            );
            if (
              res.status === 404 ||
              errText.includes('UNREGISTERED') ||
              errText.includes('registration-token-not-registered') ||
              errText.includes('NotRegistered')
            ) {
              await service.from('mobile_push_tokens').delete().eq('token', row.token);
              removed += 1;
            }
          }
        } catch (e) {
          console.error('[send-mobile-push] fetch exception:', e);
        }
      })
    );
  }

  return { sent, attempted: tokens.length, removed };
}

function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    READY_FOR_PICKUP: 'Ready for Pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };
  return map[status] || status;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    const expectedWebhookSecret = Deno.env.get('MOBILE_PUSH_WEBHOOK_SECRET');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return respond({ error: 'Supabase environment not configured' }, 503);
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const webhookSecretHeader = req.headers.get('x-push-webhook-secret') || '';
    const isWebhookAuthorized = Boolean(
      expectedWebhookSecret &&
        webhookSecretHeader &&
        timingSafeEqual(webhookSecretHeader, expectedWebhookSecret)
    );

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return respond({ error: 'Invalid JSON payload' }, 400);
    }

    // Allow authenticated users to send a remote FCM test push ONLY to their own devices
    if (!isWebhookAuthorized) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || payload.type !== 'test_self') {
        return respond({ error: 'Unauthorized' }, 401);
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return respond({ error: 'Please sign in again' }, 401);
      }
      const result = await sendFcmToUserIds(
        service,
        [userData.user.id],
        {
          title: 'PaliTrento Background Push Active',
          body: 'Remote Firebase notifications are working even when the app is closed.',
          channelId: 'advisories',
          route: { pathname: '/notifications', type: 'test' },
        },
        { mandatory: true }
      );
      return respond({ ok: true, ...result });
    }

    const table = String(payload.table || '');
    const op = String(payload.op || payload.type || '').toUpperCase();
    const record = (payload.record || {}) as Record<string, any>;
    const oldRecord = (payload.old_record || {}) as Record<string, any>;

    // -----------------------------------------------------------------------
    // 1. Order Chat Messages (`messages` INSERT)
    // -----------------------------------------------------------------------
    if (table === 'messages' && op === 'INSERT') {
      const orderId = String(record.order_id || '');
      const senderId = String(record.sender_id || '');
      const content = String(record.content || '').trim();
      if (!orderId || !senderId) return respond({ skipped: 'missing order_id/sender_id' });

      const { data: order } = await service
        .from('orders')
        .select('id, buyer_id, stores (business_name, user_id)')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) return respond({ skipped: 'order not found' });

      const storeObj = Array.isArray((order as any).stores)
        ? (order as any).stores[0]
        : (order as any).stores;
      const ownerId = storeObj?.user_id ? String(storeObj.user_id) : null;
      const buyerId = String((order as any).buyer_id || '');
      const recipientId = senderId === buyerId ? ownerId : buyerId;
      if (!recipientId || recipientId === senderId) {
        return respond({ skipped: 'no recipient' });
      }

      let senderLabel = storeObj?.business_name || `Order #${orderId.slice(0, 8)}`;
      if (senderId === buyerId) {
        const { data: buyerProf } = await service
          .from('profiles')
          .select('full_name')
          .eq('id', buyerId)
          .maybeSingle();
        senderLabel = buyerProf?.full_name || 'Customer';
      }

      const result = await sendFcmToUserIds(
        service,
        [recipientId],
        {
          title: `New message from ${senderLabel}`,
          body: content || 'Sent you a message',
          channelId: 'messages',
          tag: `chat-${orderId}`,
          route: {
            pathname: '/chat/[orderId]',
            params: { orderId },
            orderId,
            type: 'message',
          },
        },
        { category: 'messages' }
      );
      return respond({ ok: true, table, ...result });
    }

    // -----------------------------------------------------------------------
    // 2. Order Status Updates (`orders` UPDATE)
    // -----------------------------------------------------------------------
    if (table === 'orders' && op === 'UPDATE') {
      const status = String(record.status || '');
      const oldStatus = String(oldRecord.status || '');
      const notifying = ['CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
      if (!status || status === oldStatus || !notifying.includes(status)) {
        return respond({ skipped: 'non-notifying status change' });
      }

      const buyerId = String(record.buyer_id || '');
      const orderId = String(record.id || '');
      if (!buyerId || !orderId) return respond({ skipped: 'missing buyer/order id' });

      // Skip notifying customer when they cancelled their own order
      if (status === 'CANCELLED' && record.cancellation_actor === 'CUSTOMER') {
        return respond({ skipped: 'self-cancelled' });
      }

      const { data: orderDetail } = await service
        .from('orders')
        .select('products (name), stores (business_name)')
        .eq('id', orderId)
        .maybeSingle();

      const prod = Array.isArray((orderDetail as any)?.products)
        ? (orderDetail as any).products[0]
        : (orderDetail as any)?.products;
      const store = Array.isArray((orderDetail as any)?.stores)
        ? (orderDetail as any).stores[0]
        : (orderDetail as any)?.stores;
      const itemText = prod?.name ? `${prod.name} at ${store?.business_name || 'store'}` : `Order #${orderId.slice(0, 8)}`;

      const bodyByStatus: Record<string, string> = {
        CONFIRMED: `${itemText} has been confirmed by the store.`,
        READY_FOR_PICKUP: `${itemText} is ready for pickup! Pick up within 72 hours.`,
        COMPLETED: `${itemText} has been completed. Thank you for shopping local!`,
        CANCELLED: record.cancellation_reason
          ? `${itemText} was cancelled. Reason: ${record.cancellation_reason}`
          : `${itemText} was cancelled by the store.`,
        EXPIRED:
          record.cancellation_reason ||
          `${itemText} expired because it was not picked up within 72 hours.`,
      };

      const mandatory = status === 'READY_FOR_PICKUP' || status === 'EXPIRED';
      const result = await sendFcmToUserIds(
        service,
        [buyerId],
        {
          title: `Order ${orderStatusLabel(status)} (#${orderId.slice(0, 8)})`,
          body: bodyByStatus[status] || `Your order status is now ${orderStatusLabel(status)}.`,
          channelId: 'orders',
          tag: `order-${orderId}`,
          route: {
            pathname: '/(tabs)/orders',
            params: { orderId },
            orderId,
            type: 'order',
          },
        },
        { mandatory, category: 'orders' }
      );
      return respond({ ok: true, table, ...result });
    }

    // -----------------------------------------------------------------------
    // 3. New Customer Reservation for Business Owners (`reservation_notifications` INSERT)
    // -----------------------------------------------------------------------
    if (table === 'reservation_notifications' && op === 'INSERT') {
      const ownerId = String(record.owner_id || '');
      const orderId = String(record.order_id || '');
      if (!ownerId) return respond({ skipped: 'missing owner_id' });

      let body = `Order #${orderId.slice(0, 8)} is waiting for your confirmation.`;
      if (orderId) {
        const { data: ord } = await service
          .from('orders')
          .select('quantity, products (name)')
          .eq('id', orderId)
          .maybeSingle();
        const prod = Array.isArray((ord as any)?.products)
          ? (ord as any).products[0]
          : (ord as any)?.products;
        if (prod?.name) {
          body = `${ord?.quantity || 1} × ${prod.name} reserved (#${orderId.slice(0, 8)}). Tap to confirm.`;
        }
      }

      const result = await sendFcmToUserIds(
        service,
        [ownerId],
        {
          title: 'New Customer Reservation',
          body,
          channelId: 'orders',
          tag: `res-${orderId || record.id}`,
          route: {
            pathname: '/(tabs)/store',
            type: 'reservation',
            ...(orderId ? { orderId } : {}),
          },
        },
        { category: 'orders' }
      );
      return respond({ ok: true, table, ...result });
    }

    // -----------------------------------------------------------------------
    // 4. Account Moderation Alerts (`account_moderation_actions` INSERT)
    //    ALWAYS mandatory (warnings, suspensions, bans) — bypasses user opt-outs
    // -----------------------------------------------------------------------
    if (table === 'account_moderation_actions' && op === 'INSERT') {
      const targetUserId = String(record.target_user_id || '');
      const action = String(record.action || '');
      const reason = String(record.reason || '').trim();
      const notifyingActions = ['warn', 'suspend_temporary', 'suspend_permanent', 'ban'];
      if (!targetUserId || !notifyingActions.includes(action)) {
        return respond({ skipped: 'non-notifying moderation action' });
      }

      let title = 'Account Alert';
      let body = reason || 'There is an important moderation notice on your PaliTrento account.';
      let pathname = '/(tabs)/account';

      if (action === 'warn') {
        title = 'Account Warning';
        body = reason
          ? `Admin warning: ${reason}`
          : 'You received an account warning from a PaliTrento administrator.';
        pathname = '/(tabs)/account';
      } else if (action === 'suspend_temporary' || action === 'suspend_permanent') {
        title = 'Account Suspended';
        body = reason
          ? `Your account has been suspended. Reason: ${reason}`
          : 'Your PaliTrento account has been suspended by an administrator.';
        pathname = '/auth-status';
      } else if (action === 'ban') {
        title = 'Account Banned';
        body = reason
          ? `Your account has been banned. Reason: ${reason}`
          : 'Your PaliTrento account has been banned by an administrator.';
        pathname = '/auth-status';
      }

      const result = await sendFcmToUserIds(
        service,
        [targetUserId],
        {
          title,
          body,
          channelId: 'moderation',
          color: '#DC2626',
          tag: `mod-${record.id || action}`,
          route: { pathname, type: 'moderation' },
        },
        { mandatory: true }
      );
      return respond({ ok: true, table, ...result });
    }

    // -----------------------------------------------------------------------
    // 5. Advisories, Announcements, Price Caps & Personal Notifications (`advisories` INSERT)
    // -----------------------------------------------------------------------
    if (table === 'advisories' && op === 'INSERT') {
      const publishedAt = record.published_at ? Date.parse(String(record.published_at)) : null;
      const expiresAt = record.expires_at ? Date.parse(String(record.expires_at)) : null;
      const now = Date.now();
      if (publishedAt && publishedAt > now + 60_000) {
        return respond({ skipped: 'scheduled for future' });
      }
      if (expiresAt && expiresAt <= now) {
        return respond({ skipped: 'already expired' });
      }

      const title = String(record.title || 'PaliTrento Update');
      const body = String(record.body || '');
      const recipientId = record.recipient_id ? String(record.recipient_id) : null;
      const adminOnly = Boolean(record.admin_only);
      const category = String(record.category || 'GENERAL').toUpperCase();
      const barangay = record.barangay ? String(record.barangay) : null;
      const actionUrl = record.action_url ? String(record.action_url) : undefined;

      // Account Warning advisories are already pushed with higher priority by account_moderation_actions
      if (recipientId && title.toLowerCase() === 'account warning') {
        return respond({ skipped: 'handled by account_moderation_actions trigger' });
      }

      let targetUserIds: string[] = [];
      let mandatory = category === 'EMERGENCY' || Boolean(recipientId);
      let prefCategory: 'price_caps' | 'store_announcements' | undefined;

      if (recipientId) {
        targetUserIds = [recipientId];
      } else if (adminOnly) {
        mandatory = true;
        const { data: admins } = await service
          .from('profiles')
          .select('id')
          .eq('role', 'admin');
        targetUserIds = (admins ?? []).map((a: any) => String(a.id));
      } else {
        if (category === 'PRICE_CAP') prefCategory = 'price_caps';
        else if (category === 'ANNOUNCEMENT' || category === 'GENERAL') {
          prefCategory = 'store_announcements';
        }

        if (barangay) {
          const { data: usersInBrgy } = await service
            .from('profiles')
            .select('id')
            .eq('barangay', barangay);
          targetUserIds = (usersInBrgy ?? []).map((u: any) => String(u.id));
        } else {
          // Only look up users who actually have a mobile token registered
          const { data: tokenHolders } = await service
            .from('mobile_push_tokens')
            .select('user_id');
          targetUserIds = [...new Set((tokenHolders ?? []).map((r: any) => String(r.user_id)))];
        }
      }

      const result = await sendFcmToUserIds(
        service,
        targetUserIds,
        {
          title,
          body: body || 'Open PaliTrento to view this update.',
          channelId: 'advisories',
          color: category === 'EMERGENCY' ? '#DC2626' : '#1B4329',
          tag: `adv-${record.id || Date.now()}`,
          route: {
            pathname: '/notifications',
            type: 'advisory',
            ...(actionUrl ? { action_url: actionUrl } : {}),
          },
        },
        { mandatory, category: prefCategory }
      );
      return respond({ ok: true, table, ...result });
    }

    // -----------------------------------------------------------------------
    // 6. Support Ticket Replies (`support_messages` INSERT)
    // -----------------------------------------------------------------------
    if (table === 'support_messages' && op === 'INSERT') {
      const ticketId = String(record.ticket_id || '');
      const senderId = String(record.sender_id || '');
      const isFromAdmin = Boolean(record.is_from_admin);
      const content = String(record.content || '').trim();
      if (!ticketId) return respond({ skipped: 'missing ticket_id' });

      const { data: ticket } = await service
        .from('support_tickets')
        .select('id, user_id, subject')
        .eq('id', ticketId)
        .maybeSingle();
      if (!ticket) return respond({ skipped: 'ticket not found' });

      let targetUserIds: string[] = [];
      let title = 'Support Update';
      let pathname = '/support';

      if (isFromAdmin) {
        targetUserIds = [String((ticket as any).user_id)];
        title = `Support reply: ${(ticket as any).subject || 'Your ticket'}`;
        pathname = '/support';
      } else {
        const { data: admins } = await service
          .from('profiles')
          .select('id')
          .eq('role', 'admin');
        targetUserIds = (admins ?? [])
          .map((a: any) => String(a.id))
          .filter((id) => id !== senderId);
        title = `New support reply: ${(ticket as any).subject || 'Support ticket'}`;
        pathname = '/admin/support';
      }

      const result = await sendFcmToUserIds(
        service,
        targetUserIds,
        {
          title,
          body: content || 'Tap to view the new reply.',
          channelId: 'default',
          tag: `support-${ticketId}`,
          route: { pathname, type: 'support' },
        },
        { mandatory: isFromAdmin }
      );
      return respond({ ok: true, table, ...result });
    }

    return respond({ skipped: `unhandled event ${table}:${op}` });
  } catch (error) {
    console.error('[send-mobile-push] unhandled error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return respond({ error: message }, 500);
  }
});
