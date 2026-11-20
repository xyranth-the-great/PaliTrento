import { supabase } from './supabase';

export type NotificationType = 'advisory' | 'message' | 'reservation' | 'order_status';

export interface NotificationPreferences {
  orders: boolean;
  messages: boolean;
  price_caps: boolean;
  store_announcements: boolean;
  push: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  orders: true,
  messages: true,
  price_caps: false,
  store_announcements: false,
  push: false,
};

export interface UnifiedNotification {
  id: string;
  type: NotificationType;
  category: string;
  title: string;
  body: string;
  published_at: string;
  isRead: boolean;
  barangay?: string | null;
  priority?: string | null;
  order_id?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  new_status?: string | null;
  isExpired?: boolean;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  READY_FOR_PICKUP: 'Ready for pickup',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired - not picked up',
};

export function pickupDeadlineNotice(readyAt?: string | null): string {
  const deadlineMs = readyAt ? Date.parse(readyAt) + 72 * 60 * 60 * 1000 : NaN;
  const deadline = Number.isFinite(deadlineMs)
    ? new Date(deadlineMs).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  return `Please pick it up within 72 hours${deadline ? `, by ${deadline}` : ''}. If it is not collected, the reservation will be automatically cancelled.`;
}

export interface PickupCountdownInfo {
  label: string;
  deadlineText: string | null;
  state: 'ok' | 'warn' | 'expired' | 'unavailable';
}

/**
 * Computes live 72-hour pickup countdown matching website `orders.js`.
 */
export function getPickupCountdown(
  readyAt?: string | null,
  nowMs: number = Date.now()
): PickupCountdownInfo {
  const deadlineMs = readyAt ? Date.parse(readyAt) + 72 * 60 * 60 * 1000 : NaN;
  if (!Number.isFinite(deadlineMs)) {
    return {
      label: 'Deadline unavailable',
      deadlineText: null,
      state: 'unavailable',
    };
  }

  const deadlineText = new Date(deadlineMs).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const remaining = deadlineMs - nowMs;

  if (remaining <= 0) {
    return {
      label: 'Pickup window passed',
      deadlineText,
      state: 'expired',
    };
  }

  const totalMinutes = Math.ceil(remaining / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  let label: string;
  if (days > 0) {
    label = `${days} day${days === 1 ? '' : 's'}${hours ? `, ${hours} hr${hours === 1 ? '' : 's'}` : ''} left`;
  } else if (hours > 0) {
    label = `${hours} hour${hours === 1 ? '' : 's'}${minutes ? `, ${minutes} min${minutes === 1 ? '' : 's'}` : ''} left`;
  } else {
    label = `${minutes} minute${minutes === 1 ? '' : 's'} left`;
  }

  return {
    label,
    deadlineText,
    state: remaining <= 12 * 60 * 60 * 1000 ? 'warn' : 'ok',
  };
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('orders, messages, price_caps, store_announcements, push')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) {
      return {
        orders: data.orders !== false,
        messages: data.messages !== false,
        price_caps: Boolean(data.price_caps),
        store_announcements: Boolean(data.store_announcements),
        push: Boolean(data.push),
      };
    }
  } catch {
    // fallback to defaults
  }
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export async function getOwnedStoreIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('stores').select('id').eq('user_id', userId);
  if (error || !data) return [];
  return data.map((s: { id: string }) => s.id);
}

interface OrderRef {
  id: string;
  buyer_id: string;
  store_id: string;
  stores?: { business_name?: string | null; user_id?: string | null } | null;
}

export async function getMessageNotificationOrders(userId: string): Promise<OrderRef[]> {
  const storeIds = await getOwnedStoreIds(userId);
  let query = supabase
    .from('orders')
    .select('id, buyer_id, store_id, stores(business_name, user_id)');
  if (storeIds.length > 0) {
    query = query.or(`buyer_id.eq.${userId},store_id.in.(${storeIds.join(',')})`);
  } else {
    query = query.eq('buyer_id', userId);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as OrderRef[];
}

async function getDismissedKeys(
  userId: string,
  items: { type: NotificationType; id: string }[]
): Promise<Set<string>> {
  const dismissed = new Set<string>();
  const byType = new Map<NotificationType, string[]>();
  for (const item of items) {
    const list = byType.get(item.type) || [];
    list.push(item.id);
    byType.set(item.type, list);
  }

  for (const [type, ids] of byType.entries()) {
    const unique = [...new Set(ids)];
    for (let i = 0; i < unique.length; i += 100) {
      const { data, error } = await supabase
        .from('notification_dismissals')
        .select('notification_id')
        .eq('user_id', userId)
        .eq('notification_type', type)
        .in('notification_id', unique.slice(i, i + 100));
      if (!error && data) {
        data.forEach((row: { notification_id: string }) => {
          dismissed.add(`${type}:${row.notification_id}`);
        });
      }
    }
  }
  return dismissed;
}

/**
 * Fetches all active unified notifications (advisories, chat messages,
 * order status updates, and seller reservation notifications) excluding dismissed ones.
 * Mirrors website `advisories.js` & `ui.js`.
 */
export async function fetchAllNotifications(
  userId: string,
  isBusinessOwner: boolean
): Promise<UnifiedNotification[]> {
  const now = new Date().toISOString();
  const prefs = await getNotificationPreferences(userId);

  const [advisoriesRes, orderStatusRes, messageItems, reservationItems] = await Promise.all([
    // 1. Advisories
    supabase
      .from('advisories')
      .select(
        'id, title, body, category, priority, published_at, barangay, recipient_id, action_url, action_label'
      )
      .lte('published_at', now)
      .or(
        `and(recipient_id.is.null,expires_at.is.null),and(recipient_id.is.null,expires_at.gt.${now}),and(recipient_id.eq.${userId},expires_at.is.null),and(recipient_id.eq.${userId},expires_at.gt.${now})`
      )
      .order('published_at', { ascending: false }),

    // 2. Order status updates
    (async () => {
      let q = supabase
        .from('order_status_notifications')
        .select(
          'id, order_id, previous_status, new_status, created_at, read_at, orders(ready_at, cancellation_reason, products(name), stores(business_name))'
        )
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });
      if (!prefs.orders) {
        q = q.in('new_status', ['READY_FOR_PICKUP', 'EXPIRED']);
      }
      return q;
    })(),

    // 3. Message notifications
    (async (): Promise<UnifiedNotification[]> => {
      if (!prefs.messages) return [];
      const orders = await getMessageNotificationOrders(userId);
      if (!orders.length) return [];

      const orderMap = new Map(orders.map((o) => [o.id, o]));
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, order_id, sender_id, content, created_at, read_at')
        .in(
          'order_id',
          orders.map((o) => o.id)
        )
        .neq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(80);
      if (error || !messages) return [];

      const senderNames = new Map<string, string>();
      const sellerOrderIds = [
        ...new Set(
          messages
            .map((m: { order_id: string }) => m.order_id)
            .filter((oid: string) => orderMap.get(oid)?.buyer_id !== userId)
        ),
      ];
      await Promise.all(
        sellerOrderIds.map(async (oid) => {
          const { data } = await supabase.rpc('get_order_customer_name', { p_order_id: oid });
          senderNames.set(oid, (typeof data === 'string' && data) || 'Customer');
        })
      );

      return messages.map((m: any): UnifiedNotification => {
        const ord = orderMap.get(m.order_id);
        const senderName =
          ord?.buyer_id === userId
            ? ord?.stores?.business_name || 'Business owner'
            : senderNames.get(m.order_id) || 'Customer';
        return {
          id: m.id,
          type: 'message',
          category: 'MESSAGE',
          title: `New message from ${senderName}`,
          body: m.content,
          published_at: m.created_at,
          isRead: Boolean(m.read_at),
          order_id: m.order_id,
        };
      });
    })(),

    // 4. Seller reservation notifications
    (async (): Promise<UnifiedNotification[]> => {
      if (!isBusinessOwner || !prefs.orders) return [];
      const storeIds = await getOwnedStoreIds(userId);
      if (!storeIds.length) return [];

      const { data: reservations, error } = await supabase
        .from('reservation_notifications')
        .select(
          'id, order_id, created_at, read_at, orders(id, buyer_id, quantity, status, cancellation_reason, products(name))'
        )
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(80);
      if (error || !reservations) return [];

      const buyerNames = new Map<string, string>();
      const uniqueOids = [...new Set(reservations.map((r: any) => r.order_id))];
      await Promise.all(
        uniqueOids.map(async (oid) => {
          const { data } = await supabase.rpc('get_order_customer_name', { p_order_id: oid });
          buyerNames.set(oid, (typeof data === 'string' && data) || 'Customer');
        })
      );

      return reservations.map((r: any): UnifiedNotification => {
        const ord = r.orders || {};
        const prod = ord.products || {};
        const buyerName = buyerNames.get(r.order_id) || 'Customer';
        const isExpired = ord.status === 'EXPIRED';
        const shortId = String(r.order_id || '').slice(0, 8);
        return {
          id: r.id,
          type: 'reservation',
          category: 'RESERVATION',
          title: isExpired
            ? `Reservation expired for ${buyerName}`
            : `New reservation from ${buyerName}`,
          body: isExpired
            ? `${ord.cancellation_reason || 'Not picked up within 3 days of being marked ready'} • ${ord.quantity || 0} × ${prod.name || 'Product'} • Order ${shortId}`
            : `${ord.quantity || 0} × ${prod.name || 'Product'} • Order ${shortId}`,
          published_at: r.created_at,
          isRead: Boolean(r.read_at),
          order_id: r.order_id,
          isExpired,
        };
      });
    })(),
  ]);

  // Process advisories + read state
  const rawAdvisories = (advisoriesRes.data || []) as any[];
  const advisoryIds = rawAdvisories.map((a) => a.id);
  const readAdvisoryIds = new Set<string>();
  if (advisoryIds.length > 0) {
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('advisory_id')
      .eq('user_id', userId)
      .in('advisory_id', advisoryIds);
    (reads || []).forEach((r: { advisory_id: string }) => readAdvisoryIds.add(r.advisory_id));
  }

  const advisoryItems: UnifiedNotification[] = rawAdvisories.map((a) => ({
    id: a.id,
    type: 'advisory',
    category: a.category || 'GENERAL',
    title: a.title,
    body: a.body,
    published_at: a.published_at,
    isRead: readAdvisoryIds.has(a.id),
    barangay: a.barangay,
    priority: a.priority,
    action_url: a.action_url,
    action_label: a.action_label,
  }));

  // Process order status notifications
  const orderStatusItems: UnifiedNotification[] = ((orderStatusRes.data || []) as any[]).map(
    (u) => {
      const ord = u.orders || {};
      const prod = ord.products || {};
      const store = ord.stores || {};
      const statusLabel = ORDER_STATUS_LABELS[u.new_status] || 'Updated';
      const reason = ord.cancellation_reason ? ` Reason: ${ord.cancellation_reason}` : '';
      const deadlinePart =
        u.new_status === 'READY_FOR_PICKUP' ? ` ${pickupDeadlineNotice(ord.ready_at)}` : '';
      return {
        id: u.id,
        type: 'order_status',
        category: 'ORDER_STATUS',
        title: `Order ${statusLabel}`,
        body: `Your order${prod.name ? ` for ${prod.name}` : ''}${store.business_name ? ` from ${store.business_name}` : ''} is now ${statusLabel.toLowerCase()}.${deadlinePart}${reason}`,
        published_at: u.created_at,
        isRead: Boolean(u.read_at),
        order_id: u.order_id,
        new_status: u.new_status,
      };
    }
  );

  const combined = [...advisoryItems, ...messageItems, ...reservationItems, ...orderStatusItems].sort(
    (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)
  );

  const dismissedKeys = await getDismissedKeys(userId, combined);
  return combined.filter((n) => !dismissedKeys.has(`${n.type}:${n.id}`));
}

export async function markAdvisoryRead(userId: string, advisoryId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_reads')
    .upsert({ user_id: userId, advisory_id: advisoryId });
  if (error) {
    await supabase.from('notification_reads').upsert({ user_id: userId, advisory_id: advisoryId });
  }
}

export async function markOrderStatusRead(
  userId: string,
  notificationId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('order_status_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('buyer_id', userId)
    .is('read_at', null);
  return { error: error ? new Error(error.message) : null };
}

export async function markReservationRead(
  userId: string,
  notificationId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('reservation_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('owner_id', userId)
    .is('read_at', null);
  return { error: error ? new Error(error.message) : null };
}

export async function markAllNotificationsRead(
  userId: string,
  isBusinessOwner: boolean
): Promise<void> {
  const now = new Date().toISOString();

  const { data: advisories } = await supabase
    .from('advisories')
    .select('id')
    .lte('published_at', now)
    .or(
      `and(recipient_id.is.null,expires_at.is.null),and(recipient_id.is.null,expires_at.gt.${now}),and(recipient_id.eq.${userId},expires_at.is.null),and(recipient_id.eq.${userId},expires_at.gt.${now})`
    );
  if (advisories?.length) {
    const rows = advisories.map((a: { id: string }) => ({ user_id: userId, advisory_id: a.id }));
    await supabase.from('notification_reads').upsert(rows);
  }

  const orders = await getMessageNotificationOrders(userId);
  if (orders.length > 0) {
    await supabase
      .from('messages')
      .update({ read_at: now })
      .in(
        'order_id',
        orders.map((o) => o.id)
      )
      .neq('sender_id', userId)
      .is('read_at', null);
  }

  await supabase
    .from('order_status_notifications')
    .update({ read_at: now })
    .eq('buyer_id', userId)
    .is('read_at', null);

  if (isBusinessOwner) {
    const storeIds = await getOwnedStoreIds(userId);
    if (storeIds.length > 0) {
      await supabase
        .from('reservation_notifications')
        .update({ read_at: now })
        .eq('owner_id', userId)
        .is('read_at', null);
    }
  }
}

export async function dismissNotifications(
  userId: string,
  items: { type: NotificationType; id: string }[]
): Promise<{ error: Error | null }> {
  const rows = items.map((n) => ({
    user_id: userId,
    notification_type: n.type,
    notification_id: n.id,
  }));
  if (!rows.length) return { error: null };

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase
      .from('notification_dismissals')
      .upsert(rows.slice(i, i + 100), { onConflict: 'user_id,notification_type,notification_id' });
    if (error) return { error: new Error(error.message) };
  }
  return { error: null };
}

/**
 * Maps website relative `action_url` values stored on advisories into mobile app routes.
 */
export function resolveAdvisoryAction(
  actionUrl?: string | null
): { pathname: string; params?: Record<string, string> } | null {
  if (!actionUrl) return null;
  try {
    const u = new URL(actionUrl, 'https://palitrento.online');
    const path = u.pathname.replace(/\/+$/, '');
    if (path === '/orders') {
      const orderId = u.searchParams.get('orderId');
      return { pathname: '/(tabs)/orders', params: orderId ? { orderId } : undefined };
    }
    if (path === '/dashboard') {
      return { pathname: '/(tabs)/store' };
    }
    if (path === '/admin' || path === '/admin-verification') {
      return { pathname: '/(tabs)/admin' };
    }
    if (path === '/admin-accounts') {
      const userId = u.searchParams.get('userId');
      return { pathname: '/admin/accounts', params: userId ? { userId } : undefined };
    }
    if (path === '/admin-reports-management') {
      const tab = u.searchParams.get('tab');
      return { pathname: '/admin/reports-management', params: tab ? { tab } : undefined };
    }
    if (path === '/admin-support') {
      return { pathname: '/admin/support' };
    }
    if (path === '/admin-marketplace') {
      return { pathname: '/admin/marketplace' };
    }
    if (path === '/admin-pickup-cases') {
      return { pathname: '/admin/pickup-cases' };
    }
    if (path === '/admin-activity') {
      return { pathname: '/admin/activity' };
    }
    if (path === '/admin-reports') {
      return { pathname: '/admin/reports' };
    }
    if (path === '/admin-verification-docs') {
      return { pathname: '/admin/verification-docs' };
    }
    if (path === '/admin-prices') {
      return { pathname: '/admin/advisory' };
    }
    if (path === '/business') {
      const trn = u.searchParams.get('trn');
      if (trn) return { pathname: '/store/[trn]', params: { trn } };
    }
    if (path === '/product-detail') {
      const id = u.searchParams.get('id');
      if (id) return { pathname: '/product/[id]', params: { id } };
    }
    if (path === '/chat') {
      const orderId = u.searchParams.get('orderId');
      if (orderId) return { pathname: '/chat/[orderId]', params: { orderId } };
    }
    if (path === '/support') {
      return { pathname: '/support' };
    }
    if (path === '/settings') {
      const tab = u.searchParams.get('tab');
      return { pathname: '/settings', params: tab ? { tab } : undefined };
    }
    if (path === '/explore') {
      return { pathname: '/(tabs)/explore' };
    }
    if (path === '/products') {
      return { pathname: '/(tabs)/explore', params: { mode: 'products' } };
    }
  } catch {
    return null;
  }
  return null;
}

export function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
