import { supabase } from './supabase.js';
import { getSession } from './auth.js';
import { esc } from './ui.js';

// VAPID public key will be replaced at build time by vite.config.js
// Set VITE_VAPID_PUBLIC_KEY environment variable for production
const VAPID_PUBLIC_KEY = import.meta.env?.VITE_VAPID_PUBLIC_KEY || '';

// Check if VAPID key is valid (not empty and valid base64url)
function isValidVapidKey(key) {
  if (!key || key.length < 80) return false;
  try {
    // Try to decode as base64url
    const padding = '='.repeat((4 - key.length % 4) % 4);
    const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
    atob(base64);
    return true;
  } catch {
    return false;
  }
}

let swRegistration = null;

/**
 * Convert base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[Push] Service Worker not supported');
    return null;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service Worker registered:', swRegistration.scope);
    return swRegistration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeToPush() {
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
  }
  if (!swRegistration) return { error: 'Service Worker not available' };

  // Check for valid VAPID key
  if (!isValidVapidKey(VAPID_PUBLIC_KEY)) {
    console.warn('[Push] VAPID public key not configured, skipping push subscription');
    return { subscription: null, error: 'VAPID key not configured' };
  }

  try {
    // Check existing subscription
    let subscription = await swRegistration.pushManager.getSubscription();

    if (subscription) {
      console.log('[Push] Existing subscription found');
      return { subscription, error: null };
    }

    // Create new subscription
    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('[Push] New subscription created');

    // Save subscription to Supabase
    const session = await getSession();
    if (session) {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: session.user.id,
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: arrayBufferToBase64(subscription.getKey('auth')),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,endpoint' });

      if (error) {
        console.error('[Push] Failed to save subscription:', error);
        return { subscription, error };
      }
    }

    return { subscription, error: null };
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return { subscription: null, error };
  }
}

/**
 * Unsubscribe user from push notifications
 */
export async function unsubscribeFromPush() {
  if (!swRegistration) return { error: null };

  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed');

      // Remove from Supabase
      const session = await getSession();
      if (session) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', session.user.id)
          .eq('endpoint', subscription.endpoint);
      }
    }
    return { error: null };
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return { error };
  }
}

/**
 * Check if user is currently subscribed
 */
export async function isPushSubscribed() {
  if (!swRegistration) return false;
  const subscription = await swRegistration.pushManager.getSubscription();
  return !!subscription;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { granted: false, error: 'Notifications not supported' };
  }

  if (Notification.permission === 'granted') {
    return { granted: true, error: null };
  }

  if (Notification.permission === 'denied') {
    return { granted: false, error: 'Permission denied' };
  }

  const permission = await Notification.requestPermission();
  return { granted: permission === 'granted', error: permission === 'granted' ? null : 'Permission denied' };
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Show a local notification (for testing)
 */
export async function showLocalNotification(title, body, options = {}) {
  if (!swRegistration) return;

  await swRegistration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    ...options
  });
}

/**
 * Initialize push notifications for the current user
 * Call this after user logs in
 */
export async function initPushNotifications() {
  // Skip if VAPID key not configured (development)
  if (!isValidVapidKey(VAPID_PUBLIC_KEY)) {
    console.log('[Push] VAPID key not configured, skipping push initialization');
    return { success: false, error: 'VAPID key not configured' };
  }

  const { granted, error } = await requestNotificationPermission();
  if (!granted) {
    console.log('[Push] Permission not granted:', error);
    return { success: false, error };
  }

  await registerServiceWorker();
  const { subscription, error: subError } = await subscribeToPush();
  if (subError) {
    return { success: false, error: subError };
  }

  console.log('[Push] Initialized successfully');
  return { success: true, subscription };
}

/**
 * Check and update push subscription status in UI
 * Call from settings page
 */
export async function updatePushUI() {
  const pushCheckbox = document.getElementById('notif-push');
  if (!pushCheckbox) return;

  const subscribed = await isPushSubscribed();
  pushCheckbox.checked = subscribed;

  // Update localStorage to match
  const NOTIF_KEY = 'palitrento_notifications';
  try {
    const stored = localStorage.getItem(NOTIF_KEY);
    const prefs = stored ? JSON.parse(stored) : {};
    prefs.push = subscribed;
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  } catch {}
}