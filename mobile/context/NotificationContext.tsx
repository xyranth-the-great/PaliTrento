import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchAllNotifications,
  getMessageNotificationOrders,
  getNotificationPreferences,
  getOwnedStoreIds,
  ORDER_STATUS_LABELS,
  pickupDeadlineNotice,
  resolveAdvisoryAction,
} from '../lib/notifications';
import {
  initNativeNotifications,
  presentLocalPushNotification,
  PushRegistrationResult,
  registerDevicePushToken,
  resolveNotificationTapRoute,
  saveDevicePushToken,
  syncAppBadgeCount,
} from '../lib/push';
import type { Tone } from '../components/ui';

export interface InAppToast {
  id: string;
  tag: string;
  title: string;
  body: string;
  tone: Tone;
  onPress?: () => void;
}

interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  activeToast: InAppToast | null;
  showToast: (toast: Omit<InAppToast, 'id'>) => void;
  dismissToast: () => void;
  pushState: PushRegistrationResult;
  refreshPushRegistration: () => Promise<PushRegistrationResult>;
}

const DEFAULT_PUSH_STATE: PushRegistrationResult = {
  status: Platform.OS === 'web' ? 'web' : 'disabled',
  token: null,
  message: Platform.OS === 'web' ? 'Web preview mode' : 'Checking push status…',
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { session, profile, restriction, needsRoleChoice } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef<string[]>([]);
  segmentsRef.current = segments as string[];

  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState<InAppToast | null>(null);
  const [pushState, setPushState] = useState<PushRegistrationResult>(DEFAULT_PUSH_STATE);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = session?.user?.id || null;
  const isBusinessOwner = (profile?.role ?? session?.user?.user_metadata?.role) === 'business_owner';
  const enabled = Boolean(userId && !restriction && !needsRoleChoice);

  const dismissToast = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  const showToast = useCallback((toast: Omit<InAppToast, 'id'>) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    setActiveToast({ ...toast, id: `${Date.now()}-${Math.random()}` });
    dismissTimerRef.current = setTimeout(() => {
      setActiveToast(null);
      dismissTimerRef.current = null;
    }, 6500);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled || !userId) {
      setUnreadCount(0);
      syncAppBadgeCount(0);
      return;
    }
    try {
      const items = await fetchAllNotifications(userId, isBusinessOwner);
      const count = items.filter((i) => !i.isRead).length;
      setUnreadCount(count);
      syncAppBadgeCount(count);
    } catch {
      // Keep previous unread count if offline/transient error
    }
  }, [enabled, isBusinessOwner, userId]);

  const refreshPushRegistration = useCallback(async (): Promise<PushRegistrationResult> => {
    if (Platform.OS === 'web') {
      const webState: PushRegistrationResult = {
        status: 'web',
        token: null,
        message: 'Web preview mode',
      };
      setPushState(webState);
      return webState;
    }
    if (!enabled || !userId) {
      const idle: PushRegistrationResult = {
        status: 'disabled',
        token: null,
        message: 'Sign in to enable push notifications.',
      };
      setPushState(idle);
      return idle;
    }

    const prefs = await getNotificationPreferences(userId);
    if (!prefs.push) {
      const off: PushRegistrationResult = {
        status: 'disabled',
        token: null,
        message: 'Push notifications are turned off in Settings.',
      };
      setPushState(off);
      return off;
    }

    const res = await registerDevicePushToken(userId);
    setPushState(res);
    return res;
  }, [enabled, userId]);

  // Initialize Android channels + notification handler once
  useEffect(() => {
    initNativeNotifications();
  }, []);

  // Sync unread count + FCM device token registration on auth change
  useEffect(() => {
    refreshUnreadCount();
    refreshPushRegistration();
  }, [refreshPushRegistration, refreshUnreadCount]);

  // Listen for native notification taps (foreground, background, and cold-start)
  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return;
    let active = true;
    let responseSub: { remove: () => void } | null = null;
    let receivedSub: { remove: () => void } | null = null;
    let tokenSub: { remove: () => void } | null = null;

    const handleTapData = (data?: Record<string, unknown> | null) => {
      const target = resolveNotificationTapRoute(data);
      router.push(
        target.params
          ? ({ pathname: target.pathname, params: target.params } as any)
          : (target.pathname as any)
      );
    };

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!active) return;

        // Cold-start tap check
        const last = Notifications.getLastNotificationResponse();
        if (last?.notification?.request?.content?.data) {
          const data = last.notification.request.content.data as Record<string, unknown>;
          Notifications.clearLastNotificationResponse();
          handleTapData(data);
        }

        // Foreground / background tap listener
        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response?.notification?.request?.content?.data as
            | Record<string, unknown>
            | undefined;
          handleTapData(data);
        });

        // Refresh inbox count when remote FCM push arrives while foregrounded
        receivedSub = Notifications.addNotificationReceivedListener(() => {
          refreshUnreadCount();
        });

        // Sync rotated FCM token automatically when OS refreshes it
        if (userId) {
          tokenSub = Notifications.addPushTokenListener(async (newToken) => {
            if (typeof newToken?.data === 'string' && newToken.data.trim()) {
              const res = await saveDevicePushToken(userId, newToken.data.trim());
              if (active) setPushState(res);
            }
          });
        }
      } catch (e) {
        console.warn('[push] listener setup error:', e);
      }
    })();

    return () => {
      active = false;
      responseSub?.remove();
      receivedSub?.remove();
      tokenSub?.remove();
    };
  }, [enabled, refreshUnreadCount, router, userId]);

  // Refresh unread count when app returns to foreground
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUnreadCount();
    });
    return () => sub.remove();
  }, [enabled, refreshUnreadCount]);

  // Live Supabase Realtime listeners (advisories, order status, reservations, chat messages)
  useEffect(() => {
    if (!enabled || !userId) return;

    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    (async () => {
      // 1. Live advisories
      const advisoryCh = supabase
        .channel(`rn-advisory-toast-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'advisories' },
          async (payload) => {
            if (cancelled) return;
            const adv = payload.new as any;
            if (!adv) return;
            if (adv.recipient_id && adv.recipient_id !== userId) return;
            if (adv.published_at && Date.parse(adv.published_at) > Date.now() + 60_000) return;
            if (adv.expires_at && Date.parse(adv.expires_at) <= Date.now()) return;

            refreshUnreadCount();

            const prefs = await getNotificationPreferences(userId);
            if (adv.category === 'PRICE_CAP' && !prefs.price_caps) return;
            if (
              (adv.category === 'ANNOUNCEMENT' || adv.category === 'GENERAL') &&
              !prefs.store_announcements
            ) {
              return;
            }

            const catTone: Record<string, Tone> = {
              PRICE_CAP: 'ok',
              ANNOUNCEMENT: 'info',
              EMERGENCY: 'bad',
              GENERAL: 'warn',
            };
            const mapped = resolveAdvisoryAction(adv.action_url);
            const title = adv.title || 'New advisory';
            const body = adv.body || '';

            showToast({
              tag: String(adv.category || 'ADVISORY').replace(/_/g, ' '),
              title,
              body,
              tone: catTone[adv.category] || 'warn',
              onPress: () =>
                mapped
                  ? router.push(
                      mapped.params
                        ? ({ pathname: mapped.pathname, params: mapped.params } as any)
                        : (mapped.pathname as any)
                    )
                  : router.push('/notifications'),
            });

            if (prefs.push) {
              presentLocalPushNotification({
                title,
                body,
                channelId: 'advisories',
                data: mapped
                  ? { pathname: mapped.pathname, params: mapped.params }
                  : { pathname: '/notifications' },
              });
            }
          }
        )
        .subscribe();
      channels.push(advisoryCh);

      // 2. Order status changes (live toast + native push + bell refresh)
      const orderStatusCh = supabase
        .channel(`rn-order-toast-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `buyer_id=eq.${userId}`,
          },
          async (payload) => {
            if (cancelled) return;
            const order = payload.new as any;
            const oldOrder = payload.old as any;
            const notifying = ['CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
            if (!order || order.status === oldOrder?.status || !notifying.includes(order.status)) {
              return;
            }

            refreshUnreadCount();

            const prefs = await getNotificationPreferences(userId);
            const mandatory = ['READY_FOR_PICKUP', 'EXPIRED'].includes(order.status);
            if (!prefs.orders && !mandatory) return;

            const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
            const statusMessages: Record<string, string> = {
              CONFIRMED: 'Your order has been confirmed!',
              READY_FOR_PICKUP: `Ready for pickup. ${pickupDeadlineNotice(order.ready_at)}`,
              COMPLETED: 'Your order has been completed!',
              CANCELLED:
                order.cancellation_actor === 'CUSTOMER'
                  ? 'You cancelled this reservation.'
                  : order.cancellation_actor === 'BUSINESS_OWNER'
                  ? `Store cancelled your reservation.${order.cancellation_reason ? ` Reason: ${order.cancellation_reason}` : ''}`
                  : `Reservation cancelled.${order.cancellation_reason ? ` Reason: ${order.cancellation_reason}` : ''}`,
              EXPIRED:
                order.cancellation_reason ||
                'Your reservation expired because it was not picked up within 72 hours.',
            };
            const statusTone: Record<string, Tone> = {
              CONFIRMED: 'ok',
              READY_FOR_PICKUP: 'info',
              COMPLETED: 'ok',
              CANCELLED: 'bad',
              EXPIRED: 'bad',
            };
            const title = `Order ${statusLabel} (#${String(order.id).slice(0, 8)})`;
            const body = statusMessages[order.status] || `Status updated to ${statusLabel}`;

            showToast({
              tag: `ORDER ${statusLabel.toUpperCase()}`,
              title: `Order #${String(order.id).slice(0, 8)}`,
              body,
              tone: statusTone[order.status] || 'info',
              onPress: () =>
                router.push({ pathname: '/(tabs)/orders', params: { orderId: order.id } }),
            });

            if (prefs.push || mandatory) {
              presentLocalPushNotification({
                title,
                body,
                channelId: 'orders',
                data: { pathname: '/(tabs)/orders', params: { orderId: order.id } },
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'order_status_notifications',
            filter: `buyer_id=eq.${userId}`,
          },
          () => {
            if (!cancelled) refreshUnreadCount();
          }
        )
        .subscribe();
      channels.push(orderStatusCh);

      // 3. Reservation notifications (business owners)
      if (isBusinessOwner) {
        const storeIds = await getOwnedStoreIds(userId);
        if (!cancelled && storeIds.length > 0) {
          const resCh = supabase
            .channel(`rn-res-notif-${userId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'reservation_notifications',
                filter: `owner_id=eq.${userId}`,
              },
              async (payload) => {
                if (cancelled) return;
                refreshUnreadCount();
                if (payload.eventType === 'INSERT') {
                  const prefs = await getNotificationPreferences(userId);
                  if (!prefs.orders) return;
                  const row = payload.new as any;
                  const title = 'New customer reservation';
                  const body = `Order #${String(row?.order_id || '').slice(0, 8)} is waiting for confirmation.`;
                  showToast({
                    tag: 'NEW RESERVATION',
                    title,
                    body,
                    tone: 'info',
                    onPress: () => router.push('/(tabs)/store'),
                  });
                  if (prefs.push) {
                    presentLocalPushNotification({
                      title,
                      body,
                      channelId: 'orders',
                      data: { pathname: '/(tabs)/store' },
                    });
                  }
                }
              }
            )
            .subscribe();
          channels.push(resCh);
        }
      }

      // 4. Unread chat messages on user's orders
      const orders = await getMessageNotificationOrders(userId);
      if (!cancelled && orders.length > 0) {
        const orderIds = orders.map((o) => o.id);
        const msgCh = supabase
          .channel(`rn-msg-notif-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `order_id=in.(${orderIds.join(',')})`,
            },
            async (payload) => {
              if (cancelled) return;
              const msg = payload.new as any;
              if (!msg || msg.sender_id === userId) return;
              const prefs = await getNotificationPreferences(userId);
              if (!prefs.messages) return;

              refreshUnreadCount();

              // Avoid interrupting while already reading chat
              if (segmentsRef.current[0] === 'chat') return;

              const title = `New message • Order #${String(msg.order_id).slice(0, 8)}`;
              const body = msg.content || 'Sent you a message';
              showToast({
                tag: 'NEW MESSAGE',
                title: `Order #${String(msg.order_id).slice(0, 8)}`,
                body,
                tone: 'info',
                onPress: () =>
                  router.push({ pathname: '/chat/[orderId]', params: { orderId: msg.order_id } }),
              });
              if (prefs.push) {
                presentLocalPushNotification({
                  title,
                  body,
                  channelId: 'messages',
                  data: { pathname: '/chat/[orderId]', params: { orderId: msg.order_id } },
                });
              }
            }
          )
          .subscribe();
        channels.push(msgCh);
      }
    })();

    return () => {
      cancelled = true;
      channels.forEach((ch) => {
        supabase.removeChannel(ch);
      });
    };
  }, [enabled, isBusinessOwner, refreshUnreadCount, router, showToast, userId]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        activeToast,
        showToast,
        dismissToast,
        pushState,
        refreshPushRegistration,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
