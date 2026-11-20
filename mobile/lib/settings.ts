import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import {
  DEFAULT_NOTIFICATION_PREFS,
  MOBILE_PUSH_DEFAULT_APPLIED_PREFIX,
  MOBILE_PUSH_OPTOUT_PREFIX,
  NotificationPreferences,
} from './notifications';

export const NOTIF_STORAGE_KEY = 'palitrento_notifications';
export const PRIVACY_STORAGE_KEY = 'palitrento_privacy';

export interface PrivacyPreferences {
  show_name: boolean;
  show_barangay: boolean;
  store_contact: boolean;
  analytics: boolean;
  lgu_data: boolean;
}

export const DEFAULT_PRIVACY_PREFS: PrivacyPreferences = {
  show_name: true,
  show_barangay: true,
  store_contact: true,
  analytics: true,
  lgu_data: false,
};

// ---------------------------------------------------------------------------
// Notification Preferences (parity with settings.js & notification_preferences)
// ---------------------------------------------------------------------------
export async function loadNotificationPrefs(userId: string): Promise<NotificationPreferences> {
  try {
    const [optOut, applied, dbRes] = await Promise.all([
      AsyncStorage.getItem(`${MOBILE_PUSH_OPTOUT_PREFIX}${userId}`).catch(() => null),
      AsyncStorage.getItem(`${MOBILE_PUSH_DEFAULT_APPLIED_PREFIX}${userId}`).catch(() => null),
      supabase
        .from('notification_preferences')
        .select('orders, messages, price_caps, store_announcements, push')
        .eq('id', userId)
        .maybeSingle(),
    ]);
    const needsMobileDefault = optOut !== '1' && applied !== '1';

    if (!dbRes.error && dbRes.data) {
      const data = dbRes.data;
      const prefs: NotificationPreferences = {
        orders: data.orders ?? true,
        messages: data.messages ?? true,
        price_caps: needsMobileDefault ? true : (data.price_caps ?? true),
        store_announcements: needsMobileDefault ? true : (data.store_announcements ?? true),
        push: needsMobileDefault ? true : (data.push ?? true),
      };
      await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(prefs));
      return prefs;
    }
  } catch {
    // Fallback to cached local preferences
  }

  try {
    const cached = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        orders: parsed.orders ?? true,
        messages: parsed.messages ?? true,
        price_caps: parsed.price_caps ?? true,
        store_announcements: parsed.store_announcements ?? true,
        push: parsed.push ?? true,
      };
    }
  } catch {
    // Ignore storage read errors
  }

  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPreferences
): Promise<void> {
  await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(prefs));
  await AsyncStorage.setItem(`${MOBILE_PUSH_DEFAULT_APPLIED_PREFIX}${userId}`, '1');
  if (prefs.push) {
    await AsyncStorage.removeItem(`${MOBILE_PUSH_OPTOUT_PREFIX}${userId}`);
  } else {
    await AsyncStorage.setItem(`${MOBILE_PUSH_OPTOUT_PREFIX}${userId}`, '1');
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        id: userId,
        orders: prefs.orders,
        messages: prefs.messages,
        price_caps: prefs.price_caps,
        store_announcements: prefs.store_announcements,
        push: prefs.push,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Privacy Preferences (AsyncStorage — matches website localStorage key)
// ---------------------------------------------------------------------------
export async function loadPrivacyPrefs(): Promise<PrivacyPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PRIVACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        show_name: parsed.show_name ?? true,
        show_barangay: parsed.show_barangay ?? true,
        store_contact: parsed.store_contact ?? true,
        analytics: parsed.analytics ?? true,
        lgu_data: parsed.lgu_data ?? false,
      };
    }
  } catch {
    // Ignore parse error
  }
  return { ...DEFAULT_PRIVACY_PREFS };
}

export async function savePrivacyPrefs(prefs: PrivacyPreferences): Promise<void> {
  await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(prefs));
}

// ---------------------------------------------------------------------------
// Personal Data & Chat History Export (parity with settings.js getUserOrderIds)
// ---------------------------------------------------------------------------
async function getUserOrderIds(userId: string): Promise<string[]> {
  const { data: stores, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', userId);
  if (storeErr) throw new Error(storeErr.message);

  const storeIds = (stores || []).map((s: { id: string }) => s.id);
  const query =
    storeIds.length > 0
      ? supabase
          .from('orders')
          .select('id')
          .or(`buyer_id.eq.${userId},store_id.in.(${storeIds.join(',')})`)
      : supabase.from('orders').select('id').eq('buyer_id', userId);

  const { data: orders, error: ordErr } = await query;
  if (ordErr) throw new Error(ordErr.message);
  return (orders || []).map((o: { id: string }) => o.id);
}

export async function buildPersonalDataExport(
  userId: string,
  email?: string | null
): Promise<{ text: string; ordersCount: number; messagesCount: number }> {
  const orderIds = await getUserOrderIds(userId);
  const safeIds = orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'];

  const [profileRes, ordersRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('orders')
      .select('id, status, quantity, total_price, payment_method, created_at')
      .in('id', safeIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('id, order_id, sender_id, content, created_at')
      .in('order_id', safeIds)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (messagesRes.error) throw new Error(messagesRes.error.message);

  const profile = profileRes.data || {};
  const orders = ordersRes.data || [];
  const messages = messagesRes.data || [];

  const lines: string[] = [
    'PALITRENTO — PERSONAL DATA EXPORT',
    `Exported at: ${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`,
    '',
    'PROFILE',
    `Name: ${profile.full_name || '—'}`,
    `Email: ${email || profile.email || '—'}`,
    `Role: ${profile.role || 'customer'}`,
    `Barangay: ${profile.barangay || '—'}`,
    `User ID: ${userId}`,
    '',
    `ORDERS (${orders.length})`,
  ];

  if (orders.length === 0) {
    lines.push('No orders recorded.');
  } else {
    orders.slice(0, 50).forEach((o: any, i: number) => {
      const price = Number(o.total_price || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const date = o.created_at
        ? new Date(o.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })
        : '—';
      lines.push(
        `${i + 1}. #${String(o.id).slice(0, 8)} • ${o.status} • Qty ${o.quantity ?? 1} • ₱${price} • ${o.payment_method || 'CASH'} • ${date}`
      );
    });
    if (orders.length > 50) lines.push(`...and ${orders.length - 50} earlier orders.`);
  }

  lines.push('', `CHAT MESSAGES (${messages.length})`);
  if (messages.length === 0) {
    lines.push('No messages recorded.');
  } else {
    messages.slice(0, 50).forEach((m: any) => {
      const who = m.sender_id === userId ? 'You' : 'Other party';
      const ts = m.created_at
        ? new Date(m.created_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })
        : '';
      lines.push(`[${ts}] (#${String(m.order_id).slice(0, 8)}) ${who}: ${m.content || ''}`);
    });
    if (messages.length > 50) lines.push(`...and ${messages.length - 50} older messages.`);
  }

  return {
    text: lines.join('\n'),
    ordersCount: orders.length,
    messagesCount: messages.length,
  };
}

export async function buildChatHistoryExport(
  userId: string,
  email?: string | null
): Promise<{ text: string; messagesCount: number }> {
  const orderIds = await getUserOrderIds(userId);
  if (orderIds.length === 0) {
    return { text: '', messagesCount: 0 };
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, order_id, sender_id, content, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  const rows = messages || [];
  if (rows.length === 0) return { text: '', messagesCount: 0 };

  const lines: string[] = [
    'PALITRENTO — CHAT HISTORY EXPORT',
    `User: ${email || userId}`,
    `Exported at: ${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`,
    `Total messages: ${rows.length}`,
    '',
  ];

  rows.forEach((m: any) => {
    const who = m.sender_id === userId ? 'You' : 'Counterparty';
    const ts = m.created_at
      ? new Date(m.created_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })
      : '';
    lines.push(`[${ts}] Order #${String(m.order_id).slice(0, 8)} • ${who}: ${m.content || ''}`);
  });

  return { text: lines.join('\n'), messagesCount: rows.length };
}

// ---------------------------------------------------------------------------
// Danger Zone: Delete Account & Delete Store (exact parity with settings.js)
// ---------------------------------------------------------------------------
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE' },
  });

  if (error) {
    let message = error.message || 'Account deletion failed.';
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.clone === 'function') {
      try {
        const body = await ctx.clone().json();
        if (typeof body?.error === 'string' && body.error) message = body.error;
      } catch {
        // Ignore parse error
      }
    }
    throw new Error(message);
  }

  if (data?.success !== true) {
    throw new Error(data?.error || 'Account deletion failed.');
  }

  await supabase.auth.signOut({ scope: 'local' });
}

export async function deleteMyStore(userId: string): Promise<void> {
  const { data: stores, error: findErr } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', userId);
  if (findErr) throw new Error(findErr.message);
  if (!stores || stores.length === 0) {
    throw new Error('No store found for your account.');
  }

  const storeId = stores[0].id;

  // Best-effort storage cleanup matching website settings.js
  try {
    const { data: storeImages } = await supabase.storage.from('store-images').list(userId);
    if (storeImages?.length) {
      await supabase.storage
        .from('store-images')
        .remove(storeImages.map((f) => `${userId}/${f.name}`));
    }
  } catch {
    // Non-fatal
  }

  try {
    const { data: productImages } = await supabase.storage.from('product-images').list(userId);
    if (productImages?.length) {
      await supabase.storage
        .from('product-images')
        .remove(productImages.map((f) => `${userId}/${f.name}`));
    }
  } catch {
    // Non-fatal
  }

  const { error: prodDelErr } = await supabase.from('products').delete().eq('store_id', storeId);
  if (prodDelErr) throw new Error(prodDelErr.message);

  const { error: storeDelErr } = await supabase.from('stores').delete().eq('id', storeId);
  if (storeDelErr) throw new Error(storeDelErr.message);

  // Revert role to customer if no other stores exist
  const { data: remaining } = await supabase.from('stores').select('id').eq('user_id', userId);
  if (!remaining || remaining.length === 0) {
    await supabase.from('profiles').update({ role: 'customer' }).eq('id', userId);
  }
}
