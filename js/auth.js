import { supabase } from './supabase.js';
import { esc } from './ui.js';

const PROFILE_CACHE_KEY = 'palitrento_profile_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const UNREAD_CACHE_KEY = 'palitrento_unread_counts';

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, role, barangay, avatar_url')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function getCachedProfile(userId) {
  // Try cache first
  const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
  if (cached) {
    try {
      const { data, timestamp, userId: cachedUserId } = JSON.parse(cached);
      if (cachedUserId === userId && Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    } catch {
      // ignore parse errors
    }
  }
  // Fetch fresh
  const profile = await getProfile(userId);
  if (profile) {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      data: profile,
      timestamp: Date.now(),
      userId
    }));
  }
  return profile;
}

export function clearProfileCache() {
  sessionStorage.removeItem(PROFILE_CACHE_KEY);
}

export async function updateProfile(userId, updates) {
  if (!supabase) return { error: new Error('Not configured') };
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  return { error };
}

export async function uploadAvatar(userId, file) {
  if (!supabase) return { error: new Error('Not configured'), url: null };

  // Validate
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { error: new Error('Choose a JPG, PNG or WebP image under 2 MB'), url: null };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: new Error('Choose a JPG, PNG or WebP image under 2 MB'), url: null };
  }

  // Resize & crop to 256x256 square, export as webp
  const blob = await resizeAndCrop(file, 256, 256, 'image/webp', 0.9);
  const ext = '.webp';
  const path = `${userId}/avatar-${Date.now()}${ext}`;

  // Upload
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/webp', upsert: false });

  if (uploadError) {
    return { error: uploadError, url: null };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(path);

  return { error: null, url: urlData.publicUrl };
}

export async function deleteAvatar(userId, avatarUrl) {
  if (!supabase || !avatarUrl) return { error: null };
  try {
    // Extract path from public URL
    const url = new URL(avatarUrl);
    const pathMatch = url.pathname.match(/\/avatars\/(.+)/);
    if (!pathMatch) return { error: null };
    const path = pathMatch[1];
    await supabase.storage.from('avatars').remove([path]);
  } catch {
    // ignore errors
  }
  return { error: null };
}

async function resizeAndCrop(file, width, height, mimeType, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Calculate crop to center square
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      ctx.drawImage(img, sx, sy, size, size, 0, 0, width, height);
      canvas.toBlob(resolve, mimeType, quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function signOut() {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error };
}

export function onAuthStateChange(callback) {
  if (!supabase) {
    callback(null, 'NO_SUPABASE');
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}

export function isSupabaseConfigured() {
  return !!supabase;
}

export function getLoginUnavailableMessage() {
  return 'Login is not available right now';
}

export function getPostLoginPath(role) {
  if (role === 'business_owner') return 'dashboard.html';
  if (role === 'admin') return 'admin.html';
  return 'index.html';
}

export function getOAuthRedirectUrl() {
  const redirectUrl = new URL('index.html', window.location.href);
  redirectUrl.searchParams.set('auth_callback', '1');
  return redirectUrl.href;
}

export function isNewGoogleAccount(user) {
  if (user?.app_metadata?.provider !== 'google') return false;

  const createdAt = Date.parse(user.created_at ?? '');
  const lastSignInAt = Date.parse(user.last_sign_in_at ?? '');
  return Number.isFinite(createdAt)
    && Number.isFinite(lastSignInAt)
    && Math.abs(lastSignInAt - createdAt) <= 2 * 60 * 1000;
}

export function getAuthErrorMessage(error) {
  if (!error) return 'Something went wrong';
  const msg = error.message?.toLowerCase() ?? '';
  if (msg.includes('invalid login credentials') || msg.includes('wrong password') || msg.includes('invalid email or password')) {
    return 'Wrong email or password';
  }
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return 'Confirm your email first';
  }
  if (msg.includes('user not found')) {
    return 'No account with that email';
  }
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'An account with this email already exists';
  }
  if (msg.includes('weak password') || msg.includes('password should be at least')) {
    return 'Password must be at least 8 characters';
  }
  if (msg.includes('invalid email')) {
    return 'Please enter a valid email address';
  }
  return 'Something went wrong. Please try again.';
}

// ===== Unread Message Counts =====

export async function getUnreadCounts(userId) {
  if (!supabase) return {};
  try {
    // Get all orders for this user (as buyer or seller)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id')
      .or(`buyer_id.eq.${userId},store_id.in.(select id from stores where user_id=eq.${userId})`);

    if (error || !orders) return {};

    const orderIds = orders.map(o => o.id);
    if (orderIds.length === 0) return {};

    // Get unread count per order
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('order_id')
      .in('order_id', orderIds)
      .is('read_at', null)
      .neq('sender_id', userId); // Only count messages from others

    if (msgError) return {};

    // Count per order
    const counts = {};
    (messages || []).forEach(m => {
      counts[m.order_id] = (counts[m.order_id] || 0) + 1;
    });

    return counts;
  } catch {
    return {};
  }
}

export async function getTotalUnreadCount(userId) {
  const counts = await getUnreadCounts(userId);
  return Object.values(counts).reduce((sum, c) => sum + c, 0);
}

export function getCachedUnreadCounts() {
  try {
    const cached = sessionStorage.getItem(UNREAD_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 60000) { // 1 min cache
        return data;
      }
    }
  } catch {}
  return {};
}

export function setCachedUnreadCounts(counts) {
  sessionStorage.setItem(UNREAD_CACHE_KEY, JSON.stringify({
    data: counts,
    timestamp: Date.now()
  }));
}

export function clearCachedUnreadCounts() {
  sessionStorage.removeItem(UNREAD_CACHE_KEY);
}

export function incrementUnreadCount(orderId) {
  const counts = getCachedUnreadCounts();
  counts[orderId] = (counts[orderId] || 0) + 1;
  setCachedUnreadCounts(counts);
  return counts;
}

export function clearUnreadCount(orderId) {
  const counts = getCachedUnreadCounts();
  if (counts[orderId]) {
    delete counts[orderId];
    setCachedUnreadCounts(counts);
  }
  return counts;
}

let unreadChannel = null;

export async function startUnreadListener(userId) {
  console.log('Starting unread listener for user:', userId);
  if (!supabase || unreadChannel) {
    console.log('Listener already running or no supabase');
    return;
  }

  // First get user's store IDs
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', userId);

  console.log('Stores:', stores, 'error:', storesError);

  const storeIds = (stores || []).map(s => s.id);
  console.log('Store IDs:', storeIds);

  // Get user's order IDs (as buyer or seller)
  let query = supabase.from('orders').select('id').eq('buyer_id', userId);

  if (storeIds.length > 0) {
    query = query.or(`buyer_id.eq.${userId},store_id.in.(${storeIds.join(',')})`);
  }

  const { data: orders, error } = await query;

  console.log('Orders:', orders, 'error:', error);

  if (error || !orders || orders.length === 0) {
    console.log('No orders found for user');
    return;
  }

  const orderIds = orders.map(o => o.id);
  console.log('Order IDs:', orderIds);

  unreadChannel = supabase
    .channel(`unread-messages-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `order_id=in.(${orderIds.join(',')})`
      },
      (payload) => {
        console.log('Realtime message received:', payload);
        const msg = payload.new;
        if (msg && msg.sender_id !== userId) {
          console.log('New message from other user:', msg);
          const counts = incrementUnreadCount(msg.order_id);
          window.dispatchEvent(new CustomEvent('unread-count-changed', { detail: counts }));
        }
      }
    )
    .subscribe((status, err) => {
      console.log('Realtime subscription status:', status, err);
    });
}

export function stopUnreadListener() {
  if (unreadChannel) {
    unreadChannel.unsubscribe();
    unreadChannel = null;
  }
}