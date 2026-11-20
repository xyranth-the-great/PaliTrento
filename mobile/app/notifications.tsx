import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Button, Chip, EmptyState, ScreenHeader, StatusPill, Tone } from '../components/ui';
import { SwipeTabContent } from '../components/SwipeTabContent';
import { LIST_PERF_PROPS } from '../lib/perf';
import {
  dismissNotifications,
  fetchAllNotifications,
  formatRelativeTime,
  markAdvisoryRead,
  markAllNotificationsRead,
  markOrderStatusRead,
  markReservationRead,
  resolveAdvisoryAction,
  UnifiedNotification,
} from '../lib/notifications';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

const NOTIF_STATUS_KEYS = ['all', 'unread', 'read'] as const;
const extractNotifKey = (item: UnifiedNotification) => `${item.type}:${item.id}`;
const NotifListSeparator = () => <View style={{ height: 10 }} />;

const CAT_META: Record<string, { label: string; tone: Tone; icon: keyof typeof Ionicons.glyphMap }> = {
  PRICE_CAP: { label: 'Price Cap', tone: 'ok', icon: 'pricetag-outline' },
  ANNOUNCEMENT: { label: 'Announcement', tone: 'info', icon: 'megaphone-outline' },
  EMERGENCY: { label: 'Emergency', tone: 'bad', icon: 'warning-outline' },
  GENERAL: { label: 'General', tone: 'warn', icon: 'information-circle-outline' },
  MESSAGE: { label: 'Message', tone: 'info', icon: 'chatbubble-ellipses-outline' },
  ORDER_STATUS: { label: 'Order Update', tone: 'ok', icon: 'bag-check-outline' },
  RESERVATION: { label: 'Reservation', tone: 'info', icon: 'receipt-outline' },
};

type StatusFilter = 'all' | 'unread' | 'read';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { refreshUnreadCount } = useNotifications();

  const userId = session?.user?.id || null;
  const isBusinessOwner = (profile?.role ?? session?.user?.user_metadata?.role) === 'business_owner';

  const [items, setItems] = useState<UnifiedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [catFilter, setCatFilter] = useState<string>('');
  const [selectedAdvisory, setSelectedAdvisory] = useState<UnifiedNotification | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await fetchAllNotifications(userId, isBusinessOwner);
      setItems(data);
    } catch {
      // keep existing items on transient error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isBusinessOwner, userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadTotal = useMemo(() => items.filter((n) => !n.isRead).length, [items]);

  const categoryOptions = useMemo(() => {
    const base = [
      { value: '', label: 'All' },
      { value: 'ORDER_STATUS', label: 'Orders' },
      { value: 'MESSAGE', label: 'Messages' },
      { value: 'PRICE_CAP', label: 'Price Cap' },
      { value: 'ANNOUNCEMENT', label: 'Announcements' },
      { value: 'EMERGENCY', label: 'Emergency' },
      { value: 'GENERAL', label: 'General' },
    ];
    if (isBusinessOwner) {
      base.splice(2, 0, { value: 'RESERVATION', label: 'Reservations' });
    }
    return base;
  }, [isBusinessOwner]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      if (statusFilter === 'unread' && n.isRead) return false;
      if (statusFilter === 'read' && !n.isRead) return false;
      if (catFilter && n.category !== catFilter) return false;
      if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [catFilter, items, query, statusFilter]);

  const handleOpenItem = async (item: UnifiedNotification) => {
    if (!userId) return;

    if (item.type === 'message' && item.order_id) {
      router.push({ pathname: '/chat/[orderId]', params: { orderId: item.order_id } });
      return;
    }

    if (item.type === 'order_status') {
      if (!item.isRead) {
        const { error } = await markOrderStatusRead(userId, item.id);
        if (!error) {
          setItems((prev) =>
            prev.map((x) => (x.id === item.id && x.type === item.type ? { ...x, isRead: true } : x))
          );
          refreshUnreadCount();
        }
      }
      if (item.order_id) {
        router.push({ pathname: '/(tabs)/orders', params: { orderId: item.order_id } });
      } else {
        router.push('/(tabs)/orders');
      }
      return;
    }

    if (item.type === 'reservation') {
      if (!item.isRead) {
        const { error } = await markReservationRead(userId, item.id);
        if (!error) {
          setItems((prev) =>
            prev.map((x) => (x.id === item.id && x.type === item.type ? { ...x, isRead: true } : x))
          );
          refreshUnreadCount();
        }
      }
      router.push('/(tabs)/store');
      return;
    }

    // Advisory: open detail modal and mark as read
    setSelectedAdvisory(item);
    if (!item.isRead) {
      await markAdvisoryRead(userId, item.id);
      setItems((prev) =>
        prev.map((x) => (x.id === item.id && x.type === item.type ? { ...x, isRead: true } : x))
      );
      refreshUnreadCount();
    }
  };

  const handleDismissOne = async (item: UnifiedNotification) => {
    if (!userId) return;
    // Optimistically remove
    setItems((prev) => prev.filter((x) => !(x.id === item.id && x.type === item.type)));
    const { error } = await dismissNotifications(userId, [{ type: item.type, id: item.id }]);
    if (error) {
      Alert.alert('Could not dismiss', error.message);
      loadNotifications();
    } else {
      refreshUnreadCount();
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId || unreadTotal === 0 || busyAction) return;
    setBusyAction(true);
    try {
      await markAllNotificationsRead(userId, isBusinessOwner);
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      await refreshUnreadCount();
    } finally {
      setBusyAction(false);
    }
  };

  const handleClearAll = () => {
    if (!userId || items.length === 0 || busyAction) return;
    Alert.alert(
      'Clear all notifications?',
      `Dismiss all ${items.length} notifications from your inbox? This will not delete your orders, messages, or advisories.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            setBusyAction(true);
            try {
              const { error } = await dismissNotifications(
                userId,
                items.map((n) => ({ type: n.type, id: n.id }))
              );
              if (error) {
                Alert.alert('Could not clear', error.message);
              } else {
                setItems([]);
                await refreshUnreadCount();
              }
            } finally {
              setBusyAction(false);
            }
          },
        },
      ]
    );
  };

  const advisoryActionRoute = useMemo(
    () => resolveAdvisoryAction(selectedAdvisory?.action_url),
    [selectedAdvisory?.action_url]
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Notifications"
        subtitle={
          loading
            ? 'Loading inbox...'
            : `${items.length} total${unreadTotal > 0 ? ` • ${unreadTotal} unread` : ''}`
        }
        right={
          items.length > 0 ? (
            <View style={styles.headerActions}>
              {unreadTotal > 0 && (
                <Pressable
                  onPress={handleMarkAllRead}
                  disabled={busyAction}
                  style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
                  accessibilityLabel="Mark all read"
                >
                  <Ionicons name="checkmark-done-outline" size={19} color={COLORS.primary} />
                </Pressable>
              )}
              <Pressable
                onPress={handleClearAll}
                disabled={busyAction}
                style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
                accessibilityLabel="Clear all notifications"
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.muted} />
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* Search + Filters */}
      <View style={styles.controlsWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search advisories, orders, messages..."
            placeholderTextColor={COLORS.muted}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={COLORS.muted} />
            </Pressable>
          )}
        </View>

        {/* Status segmented pills */}
        <View style={styles.statusRow}>
          {(
            [
              ['all', 'All'],
              ['unread', `Unread${unreadTotal > 0 ? ` (${unreadTotal})` : ''}`],
              ['read', 'Read'],
            ] as [StatusFilter, string][]
          ).map(([val, lbl]) => (
            <Pressable
              key={val}
              onPress={() => setStatusFilter(val)}
              style={[styles.statusTab, statusFilter === val && styles.statusTabActive]}
            >
              <Text
                style={[styles.statusTabText, statusFilter === val && styles.statusTabTextActive]}
              >
                {lbl}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {categoryOptions.map((c) => (
            <Chip
              key={c.value || 'all'}
              label={c.label}
              active={catFilter === c.value}
              onPress={() => setCatFilter(c.value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <SwipeTabContent
          activeKey={statusFilter}
          keys={NOTIF_STATUS_KEYS}
          onChangeKey={(k) => setStatusFilter(k as StatusFilter)}
          style={{ flex: 1 }}
        >
          <FlatList
            data={filtered}
            keyExtractor={extractNotifKey}
            {...LIST_PERF_PROPS}
            contentContainerStyle={[styles.listPad, { paddingBottom: insets.bottom + 24 }]}
            ItemSeparatorComponent={NotifListSeparator}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
                refreshUnreadCount();
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title={items.length === 0 ? 'All caught up!' : 'No matching notifications'}
              text={
                items.length === 0
                  ? 'Price cap advisories, order updates, and messages will appear right here.'
                  : 'Try clearing a filter or searching with another keyword.'
              }
            />
          }
          renderItem={({ item }) => {
            const meta =
              item.isExpired
                ? { label: 'Expired', tone: 'bad' as Tone, icon: 'time-outline' as const }
                : CAT_META[item.category] || {
                    label: item.category.replace(/_/g, ' '),
                    tone: 'warn' as Tone,
                    icon: 'notifications-outline' as const,
                  };

            return (
              <Pressable
                onPress={() => handleOpenItem(item)}
                style={({ pressed }) => [
                  styles.notifCard,
                  !item.isRead && styles.notifUnread,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.notifTop}>
                  <StatusPill label={meta.label} tone={meta.tone} />
                  <View style={styles.notifTopRight}>
                    <Text style={styles.timeText}>{formatRelativeTime(item.published_at)}</Text>
                    {!item.isRead && <View style={styles.unreadDot} />}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDismissOne(item);
                      }}
                      hitSlop={10}
                      style={styles.dismissBtn}
                      accessibilityLabel="Dismiss notification"
                    >
                      <Ionicons name="close" size={15} color={COLORS.muted} />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBody} numberOfLines={3}>
                  {item.body}
                </Text>

                <View style={styles.notifFoot}>
                  <Text style={styles.notifMeta}>
                    {new Date(item.published_at).toLocaleString('en-PH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                    {item.barangay ? ` • ${item.barangay}` : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.muted} />
                </View>
              </Pressable>
            );
          }}
          />
        </SwipeTabContent>
      )}

      {/* Advisory Detail Modal */}
      <Modal
        visible={Boolean(selectedAdvisory)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAdvisory(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalScrim}
            onPress={() => setSelectedAdvisory(null)}
          />
          {selectedAdvisory && (
            <View style={styles.modalSheet}>
              <View style={styles.modalHead}>
                <StatusPill
                  label={
                    CAT_META[selectedAdvisory.category]?.label ||
                    selectedAdvisory.category.replace(/_/g, ' ')
                  }
                  tone={CAT_META[selectedAdvisory.category]?.tone || 'warn'}
                />
                <Pressable
                  onPress={() => setSelectedAdvisory(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color={COLORS.ink} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selectedAdvisory.title}</Text>
                <Text style={styles.modalMeta}>
                  {new Date(selectedAdvisory.published_at).toLocaleString('en-PH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {selectedAdvisory.barangay ? ` • ${selectedAdvisory.barangay}` : ''}
                </Text>
                <Text style={styles.modalBody}>{selectedAdvisory.body}</Text>
              </ScrollView>

              <View style={styles.modalFoot}>
                {advisoryActionRoute ? (
                  <Button
                    title={selectedAdvisory.action_label || 'View details'}
                    onPress={() => {
                      const target = advisoryActionRoute;
                      setSelectedAdvisory(null);
                      router.push(target as any);
                    }}
                    style={{ flex: 1 }}
                  />
                ) : null}
                <Button
                  title="Close"
                  variant={advisoryActionRoute ? 'outline' : 'primary'}
                  onPress={() => setSelectedAdvisory(null)}
                  style={advisoryActionRoute ? undefined : { flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
    backgroundColor: COLORS.bg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    paddingVertical: 0,
  },
  statusRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.sm,
    padding: 3,
    gap: 3,
  },
  statusTab: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTabActive: {
    backgroundColor: COLORS.card,
    ...SHADOW.card,
  },
  statusTabText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: FONTS.bold,
    color: COLORS.muted,
  },
  statusTabTextActive: { color: COLORS.primaryDark },
  catScroll: { gap: 7, paddingVertical: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listPad: { padding: 14 },
  notifCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 13,
    gap: 7,
    ...SHADOW.card,
  },
  notifUnread: {
    backgroundColor: '#F4FAF6',
    borderColor: 'rgba(27, 67, 41, 0.22)',
  },
  notifTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notifTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  timeText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.muted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 14.5,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
    lineHeight: 20,
  },
  notifBody: {
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: COLORS.inkSecondary,
    lineHeight: 18,
  },
  notifFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  notifMeta: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    position: 'relative',
  },
  modalScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 29, 21, 0.55)',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 18,
    gap: 12,
    ...SHADOW.floating,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  modalMeta: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    marginTop: 4,
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.inkSecondary,
    lineHeight: 21,
  },
  modalFoot: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
