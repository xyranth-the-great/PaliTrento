import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { resolveAdvisoryAction } from './notifications';

export const FCM_TOKEN_STORAGE_KEY = 'palitrento_fcm_token';

export type PushChannelId = 'default' | 'orders' | 'messages' | 'advisories';

export type PushPermissionState = 'granted' | 'denied' | 'undetermined' | 'web';

export type PushRegistrationStatus =
  | 'registered'
  | 'token_local_only'
  | 'firebase_not_configured'
  | 'permission_denied'
  | 'disabled'
  | 'web'
  | 'error';

export interface PushRegistrationResult {
  status: PushRegistrationStatus;
  token: string | null;
  message: string;
}

let initialized = false;

/**
 * Configures foreground notification presentation and creates Android
 * notification channels once per app lifecycle. Safe no-op on Web.
 */
export async function initNativeNotifications(): Promise<void> {
  if (Platform.OS === 'web' || initialized) return;
  initialized = true;

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      const imp = Notifications.AndroidImportance;
      await Promise.all([
        Notifications.setNotificationChannelAsync('default', {
          name: 'General alerts',
          importance: imp.HIGH,
          sound: 'default',
          vibrationPattern: [0, 200, 120, 200],
          lightColor: '#1B4329',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        }),
        Notifications.setNotificationChannelAsync('orders', {
          name: 'Orders & pickup updates',
          description: 'Reservation confirmations, ready-for-pickup notices, and 72h deadlines',
          importance: imp.MAX,
          sound: 'default',
          vibrationPattern: [0, 240, 140, 240],
          lightColor: '#1B4329',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        }),
        Notifications.setNotificationChannelAsync('messages', {
          name: 'Order chat messages',
          description: 'Direct messages from buyers and sellers',
          importance: imp.HIGH,
          sound: 'default',
          vibrationPattern: [0, 180, 100, 180],
          lightColor: '#1B4329',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        }),
        Notifications.setNotificationChannelAsync('advisories', {
          name: 'Bantay Presyo & advisories',
          description: 'Official Municipality of Trento price caps and public alerts',
          importance: imp.MAX,
          sound: 'default',
          vibrationPattern: [0, 260, 140, 260],
          lightColor: '#F0A030',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        }),
      ]);
    }
  } catch (e) {
    console.warn('[push] initNativeNotifications error:', e);
  }
}

export async function getPushPermissionStatus(): Promise<PushPermissionState> {
  if (Platform.OS === 'web') return 'web';
  try {
    const Notifications = await import('expo-notifications');
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return 'granted';
    return perm.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (Platform.OS === 'web') return 'web';
  try {
    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return 'granted';
    const asked = await Notifications.requestPermissionsAsync();
    if (asked.granted) return 'granted';
    return asked.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function syncAppBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(count)));
  } catch {
    // Non-fatal on launchers that ignore badges
  }
}

/**
 * Presents a real native Android/iOS system notification immediately.
 * Works even without Firebase — gives users heads-up banners, sound, and tap navigation.
 */
export async function presentLocalPushNotification(params: {
  title: string;
  body: string;
  channelId?: PushChannelId;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await initNativeNotifications();
    const perm = await getPushPermissionStatus();
    if (perm !== 'granted') return false;

    const Notifications = await import('expo-notifications');
    const channelId = params.channelId || 'default';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        sound: 'default',
        color: '#1B4329',
        data: params.data || { pathname: '/notifications' },
      },
      trigger: Platform.OS === 'android' ? { channelId } : null,
    });
    return true;
  } catch (e) {
    console.warn('[push] presentLocalPushNotification error:', e);
    return false;
  }
}

/**
 * Sends an immediate local Android test notification so the user can verify
 * status-bar alerts, sound, and tap-to-open routing on device.
 */
export async function sendTestPushNotification(): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    return { ok: false, error: 'Native push test is available on Android devices.' };
  }
  const perm = await requestPushPermission();
  if (perm !== 'granted') {
    return {
      ok: false,
      error: 'Notification permission is not granted. Enable notifications in Android Settings.',
    };
  }
  const sent = await presentLocalPushNotification({
    title: 'PaliTrento notifications are active',
    body: 'Tap this notification to open your Notifications inbox.',
    channelId: 'advisories',
    data: { pathname: '/notifications', source: 'test' },
  });
  return sent
    ? { ok: true }
    : { ok: false, error: 'Could not schedule test notification.' };
}

/**
 * Obtains the native FCM device push token (when Firebase google-services.json is configured)
 * and syncs it to Supabase `mobile_push_tokens` when the migration table exists.
 * Degrades cleanly without crashing when Firebase or the SQL table is not configured yet.
 */
export async function registerDevicePushToken(userId: string): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'web', token: null, message: 'Web preview mode' };
  }

  await initNativeNotifications();
  const perm = await getPushPermissionStatus();
  if (perm !== 'granted') {
    return {
      status: 'permission_denied',
      token: null,
      message: 'Notification permission not granted yet.',
    };
  }

  let token: string | null = null;
  try {
    const Notifications = await import('expo-notifications');
    const tokenObj = await Notifications.getDevicePushTokenAsync();
    token = typeof tokenObj?.data === 'string' && tokenObj.data.trim() ? tokenObj.data.trim() : null;
  } catch (e: any) {
    const raw = String(e?.message || e || '');
    const isFirebaseMissing =
      /firebase|google-services|default firebaseapp|fcm|sender|gms/i.test(raw);
    if (isFirebaseMissing) {
      return {
        status: 'firebase_not_configured',
        token: null,
        message: 'Local & live alerts ready. Add google-services.json to enable background FCM.',
      };
    }
    return {
      status: 'error',
      token: null,
      message: raw || 'Could not obtain device push token.',
    };
  }

  if (!token) {
    return {
      status: 'firebase_not_configured',
      token: null,
      message: 'No device push token returned. Verify Firebase setup.',
    };
  }

  return saveDevicePushToken(userId, token);
}

export async function saveDevicePushToken(
  userId: string,
  token: string
): Promise<PushRegistrationResult> {
  try {
    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  } catch {
    // non-fatal
  }

  try {
    const { error } = await supabase.from('mobile_push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return {
          status: 'token_local_only',
          token,
          message:
            'FCM token obtained on device. Run docs/batch6-mobile-push-migration.sql in Supabase to sync.',
        };
      }
      return {
        status: 'token_local_only',
        token,
        message: `FCM token active locally (sync pending: ${error.message})`,
      };
    }

    return {
      status: 'registered',
      token,
      message: 'Background FCM push active and synced.',
    };
  } catch (e: any) {
    return {
      status: 'token_local_only',
      token,
      message: e?.message || 'FCM token active on device.',
    };
  }
}

export async function unregisterDevicePushToken(userId: string): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (cached) {
      await supabase
        .from('mobile_push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', cached);
      await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Non-fatal if table does not exist yet
  }
}

/**
 * Maps a tapped notification's `data` payload (from either local or remote FCM push)
 * into an Expo Router navigation target.
 */
export function resolveNotificationTapRoute(
  data?: Record<string, unknown> | null
): { pathname: string; params?: Record<string, string> } {
  if (!data || typeof data !== 'object') {
    return { pathname: '/notifications' };
  }

  if (typeof data.pathname === 'string' && data.pathname.startsWith('/')) {
    const rawParams =
      data.params && typeof data.params === 'object'
        ? Object.fromEntries(
            Object.entries(data.params as Record<string, unknown>)
              .filter(([, v]) => v != null)
              .map(([k, v]) => [k, String(v)])
          )
        : undefined;
    return { pathname: data.pathname, params: rawParams };
  }

  if (typeof data.orderId === 'string' && data.orderId) {
    if (data.type === 'message') {
      return { pathname: '/chat/[orderId]', params: { orderId: data.orderId } };
    }
    return { pathname: '/(tabs)/orders', params: { orderId: data.orderId } };
  }

  const url =
    typeof data.action_url === 'string'
      ? data.action_url
      : typeof data.url === 'string'
        ? data.url
        : null;
  if (url) {
    const mapped = resolveAdvisoryAction(url);
    if (mapped) return mapped;
  }

  return { pathname: '/notifications' };
}
