import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getMyOrders, OrderRecord } from '../../lib/data';
import { getPickupCountdown } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import { peso } from '../../lib/constants';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Pending', bg: COLORS.warnBg, color: COLORS.warn },
  CONFIRMED: { label: 'Confirmed', bg: COLORS.infoBg, color: COLORS.info },
  READY_FOR_PICKUP: { label: 'Ready for pickup', bg: COLORS.okBg, color: COLORS.ok },
  COMPLETED: { label: 'Completed', bg: COLORS.okBg, color: COLORS.ok },
  CANCELLED: { label: 'Cancelled', bg: COLORS.badBg, color: COLORS.bad },
  EXPIRED: { label: 'Expired - not picked up', bg: COLORS.badBg, color: COLORS.bad },
};

type FilterKey = 'all' | 'active' | 'done' | 'cancelled';

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const { session } = useAuth();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [highlightId, setHighlightId] = useState<string | null>(params.orderId || null);

  useEffect(() => {
    if (params.orderId) {
      setFilter('all');
      setHighlightId(params.orderId);
      const t = setTimeout(() => setHighlightId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [params.orderId]);

  const loadOrders = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    const list = await getMyOrders(session.user.id);
    setOrders(list);
    setNowMs(Date.now());
    setLoading(false);
    setRefreshing(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadOrders();
    if (!session?.user?.id) return;

    const ch = supabase
      .channel(`rn-orders-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${session.user.id}` },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadOrders, session?.user?.id]);

  // Live 72h pickup countdown ticker (updates every 30s when any order is READY_FOR_PICKUP)
  const hasReadyOrders = useMemo(
    () => orders.some((o) => o.status === 'READY_FOR_PICKUP'),
    [orders]
  );

  useEffect(() => {
    if (!hasReadyOrders) return;
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [hasReadyOrders]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'active') {
      return orders.filter((o) => ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP'].includes(o.status));
    }
    if (filter === 'done') return orders.filter((o) => o.status === 'COMPLETED');
    return orders.filter((o) => ['CANCELLED', 'EXPIRED'].includes(o.status));
  }, [orders, filter]);

  const cancelOrder = (orderId: string) => {
    Alert.alert('Cancel reservation?', 'This will release your reserved item back to the store.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('update_order_status', {
            p_order_id: orderId,
            p_new_status: 'CANCELLED',
            p_cancellation_reason: null,
          });
          if (error) {
            Alert.alert('Could not cancel', error.message);
          } else {
            loadOrders();
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.topTitle}>My Orders</Text>
        <View style={styles.tabsRow}>
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['done', 'Completed'],
              ['cancelled', 'Cancelled'],
            ] as [FilterKey, string][]
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              style={[styles.tabPill, filter === k && styles.tabPillActive]}
            >
              <Text style={[styles.tabPillText, filter === k && styles.tabPillTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPad}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadOrders();
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bag-check-outline" size={30} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>
                Reserve items from verified Trento stores and track pickup status right here.
              </Text>
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/(tabs)/explore', params: { mode: 'products' } })
                }
                style={styles.shopBtn}
              >
                <Text style={styles.shopBtnText}>Browse products</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] || STATUS_META.PENDING;
            const countdown =
              item.status === 'READY_FOR_PICKUP' ? getPickupCountdown(item.ready_at, nowMs) : null;
            const isHighlighted = highlightId === item.id;

            const countdownColors =
              countdown?.state === 'expired'
                ? { bg: COLORS.badBg, fg: COLORS.bad, border: 'rgba(220,38,38,0.28)' }
                : countdown?.state === 'warn'
                ? { bg: COLORS.warnBg, fg: COLORS.warn, border: 'rgba(180,83,9,0.28)' }
                : { bg: COLORS.okBg, fg: COLORS.ok, border: 'rgba(21,128,61,0.24)' };

            return (
              <View style={[styles.card, isHighlighted && styles.cardHighlighted]}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>{item.products?.name || 'Product'}</Text>
                    <Text style={styles.storeMeta}>
                      {item.stores?.business_name || 'Store'} • {item.stores?.barangay || 'Trento'}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.priceLine}>
                  <Text style={styles.qtyText}>
                    {item.quantity} × {peso(item.products?.current_price || 0)}
                  </Text>
                  <Text style={styles.totalVal}>{peso(item.total_price)}</Text>
                </View>

                {/* Live 72-hour pickup countdown */}
                {countdown && (
                  <View
                    style={[
                      styles.countdownBox,
                      {
                        backgroundColor: countdownColors.bg,
                        borderColor: countdownColors.border,
                      },
                    ]}
                  >
                    <View style={styles.countdownTop}>
                      <Ionicons
                        name={
                          countdown.state === 'expired'
                            ? 'alert-circle'
                            : countdown.state === 'warn'
                            ? 'alarm-outline'
                            : 'time-outline'
                        }
                        size={16}
                        color={countdownColors.fg}
                      />
                      <Text style={[styles.countdownLabel, { color: countdownColors.fg }]}>
                        PICKUP TIME REMAINING
                      </Text>
                    </View>
                    <Text style={[styles.countdownVal, { color: countdownColors.fg }]}>
                      {countdown.label}
                    </Text>
                    <Text style={[styles.countdownSub, { color: countdownColors.fg }]}>
                      {countdown.deadlineText
                        ? `Pick up by ${countdown.deadlineText}. Auto-cancels after 72 hours.`
                        : 'Please contact the store to confirm pickup.'}
                    </Text>
                  </View>
                )}

                {item.notes ? <Text style={styles.noteText}>Notes: {item.notes}</Text> : null}
                {item.cancellation_reason ? (
                  <Text style={styles.cancelReasonText}>
                    Cancellation reason: {item.cancellation_reason}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/chat/[orderId]', params: { orderId: item.id } })
                    }
                    style={styles.chatBtn}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={COLORS.primary} />
                    <Text style={styles.chatBtnText}>Chat seller</Text>
                  </Pressable>

                  {item.status === 'PENDING' && (
                    <Pressable onPress={() => cancelOrder(item.id)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                </View>

                <Text style={styles.dateText}>
                  Ordered {new Date(item.created_at).toLocaleString('en-PH')}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
  },
  topTitle: {
    fontSize: 22,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  tabsRow: { flexDirection: 'row', gap: 7 },
  tabPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  tabPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabPillText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  tabPillTextActive: { color: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listPad: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    gap: 9,
    ...SHADOW.card,
  },
  cardHighlighted: {
    borderColor: COLORS.amber,
    borderWidth: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  prodName: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.ink },
  storeMeta: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 10.5, fontFamily: FONTS.bold },
  priceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  qtyText: { fontSize: 12, color: COLORS.muted, fontFamily: FONTS.semibold },
  totalVal: { fontSize: 15.5, fontFamily: FONTS.extrabold, color: COLORS.primary },
  countdownBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  countdownTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countdownLabel: { fontSize: 9.5, fontFamily: FONTS.extrabold, letterSpacing: 0.7 },
  countdownVal: { fontSize: 15, fontFamily: FONTS.extrabold, letterSpacing: -0.2 },
  countdownSub: { fontSize: 11.5, fontFamily: FONTS.medium, opacity: 0.9, lineHeight: 16 },
  noteText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted },
  cancelReasonText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.bad },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  chatBtn: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chatBtnText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary },
  cancelBtn: {
    height: 40,
    paddingHorizontal: 15,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.badBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.bad },
  dateText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.muted },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 22,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.line,
    gap: 8,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.ink },
  emptySub: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  shopBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
  },
  shopBtnText: { color: COLORS.white, fontSize: 13, fontFamily: FONTS.bold },
});
