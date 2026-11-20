import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CATS, peso, PRODUCT_CATEGORY_LABELS, UNITS } from '../../lib/constants';
import { getProductImages, Product, Store } from '../../lib/data';
import { getPickupCountdown } from '../../lib/notifications';
import {
  BusinessCompliance,
  canManageProducts,
  computeDetailedAnalytics,
  computeStats,
  deleteProduct,
  FREE_LISTING_QUOTA,
  freeListingsUsed,
  getBusinessCompliance,
  getLockedProducts,
  getMyStore,
  getStoreDisplayStatus,
  getStoreOrders,
  getStoreProducts,
  getSubscriptionData,
  isPremiumActive,
  LockedProductRecord,
  SellerOrder,
  StoreDisplayStatus,
  storeStatusInfo,
  updateOrderStatus,
} from '../../lib/seller';
import { DemoPaymentConfig, DemoPaymentModal } from '../../components/DemoPaymentModal';
import { SubscriptionTab } from '../../components/seller/SubscriptionTab';
import { VerificationTab } from '../../components/seller/VerificationTab';
import { AnalyticsTab } from '../../components/seller/AnalyticsTab';
import { PremiumChromePill } from '../../components/effects';
import { ProPill } from '../../components/premium';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ORDER_STATUS,
  StatusBarCover,
  StatusPill,
} from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

type Tab = 'orders' | 'products' | 'subscription' | 'verification' | 'analytics';
type OrderFilter = 'active' | 'all' | 'done';

const NEXT_ACTION: Record<
  string,
  { status: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  PENDING: { status: 'CONFIRMED', label: 'Confirm', icon: 'checkmark' },
  CONFIRMED: { status: 'READY_FOR_PICKUP', label: 'Mark ready', icon: 'cube-outline' },
  READY_FOR_PICKUP: { status: 'COMPLETED', label: 'Complete', icon: 'checkmark-done' },
};

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: accent + '1A' }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function SellerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [store, setStore] = useState<(Store & Record<string, any>) | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [displayStatus, setDisplayStatus] = useState<StoreDisplayStatus | null>(null);
  const [compliance, setCompliance] = useState<BusinessCompliance | null>(null);
  const [lockedProducts, setLockedProducts] = useState<LockedProductRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('orders');
  const [filter, setFilter] = useState<OrderFilter>('active');
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SellerOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [paymentConfig, setPaymentConfig] = useState<DemoPaymentConfig | null>(null);

  useEffect(() => {
    if (
      params.tab === 'orders' ||
      params.tab === 'products' ||
      params.tab === 'subscription' ||
      params.tab === 'verification' ||
      params.tab === 'analytics'
    ) {
      setTab(params.tab);
    }
  }, [params.tab]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const s = await getMyStore(userId);
      setStore(s);
      if (s) {
        const [p, o, sd, ds, comp, locked] = await Promise.all([
          getStoreProducts(s.id),
          getStoreOrders(s.id),
          getSubscriptionData(userId),
          getStoreDisplayStatus(s.id),
          getBusinessCompliance(s.id),
          getLockedProducts(userId),
        ]);
        setProducts(p);
        setOrders(o);
        setSub(sd);
        setDisplayStatus(ds);
        setCompliance(comp);
        setLockedProducts(locked);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!store?.id) return;
    const ch = supabase
      .channel(`rn-seller-orders-${store.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` },
        () => {
          getStoreOrders(store.id).then(setOrders);
          getStoreProducts(store.id).then(setProducts);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [store?.id]);

  const stats = useMemo(() => computeStats(products, orders), [products, orders]);
  const analytics = useMemo(() => computeDetailedAnalytics(products, orders), [products, orders]);
  const premium = isPremiumActive(sub);
  const used = freeListingsUsed(sub, products.length);
  const manageable = canManageProducts(store);
  const lockedIdSet = useMemo(
    () => new Set(lockedProducts.map((l) => l.product_id)),
    [lockedProducts]
  );

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'active')
      return orders.filter((o) => ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP'].includes(o.status));
    return orders.filter((o) => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status));
  }, [orders, filter]);

  const advanceOrder = async (order: SellerOrder) => {
    const next = NEXT_ACTION[order.status];
    if (!next) return;
    setBusyOrder(order.id);
    try {
      await updateOrderStatus(order.id, next.status);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update order', e?.message || 'Please try again.');
    } finally {
      setBusyOrder(null);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      Alert.alert('Reason required', 'Tell the customer why this reservation is cancelled.');
      return;
    }
    setBusyOrder(cancelTarget.id);
    try {
      await updateOrderStatus(cancelTarget.id, 'CANCELLED', reason);
      setCancelTarget(null);
      setCancelReason('');
      await load();
    } catch (e: any) {
      Alert.alert('Could not cancel', e?.message || 'Please try again.');
    } finally {
      setBusyOrder(null);
    }
  };

  const confirmDelete = (p: Product) => {
    Alert.alert('Delete product?', `"${p.name}" will be removed from your store.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(p);
            await load();
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const startAddProduct = () => {
    if (!manageable) {
      Alert.alert('Store not approved yet', 'You can add products after Admin approves your store.');
      return;
    }
    if (!premium && used >= FREE_LISTING_QUOTA) {
      Alert.alert(
        'Free listings used up',
        `You've used all ${FREE_LISTING_QUOTA} free listings. Each extra product is a ₱1 demo payment, or upgrade to Premium for unlimited listings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Premium', onPress: () => setTab('subscription') },
          {
            text: 'Continue (₱1)',
            onPress: () => router.push({ pathname: '/seller/product-form', params: { paid: '1' } }),
          },
        ]
      );
      return;
    }
    router.push('/seller/product-form');
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 16 }]}>
        <StatusBar style="dark" />
        <Text style={styles.pageTitle}>My Store</Text>
        <EmptyState
          icon="storefront-outline"
          title="Set up your store"
          text="Add your business details, location, and permits. Admin reviews new stores within 3–5 business days."
          action={
            <Button
              title="Start store setup"
              icon="arrow-forward"
              onPress={() => router.push('/seller/store-setup')}
              style={{ marginTop: 10, alignSelf: 'stretch' }}
            />
          }
        />
      </View>
    );
  }

  const status = storeStatusInfo(store);
  const needsAck =
    displayStatus?.status === 'VERIFIED' &&
    displayStatus?.approval_notice_acknowledged !== true &&
    compliance?.approval_notice_acknowledged !== true;

  const tabs: { key: Tab; label: string; badge?: boolean }[] = [
    { key: 'orders', label: `Orders (${orders.length})` },
    { key: 'products', label: `Products (${products.length})` },
    { key: 'subscription', label: premium ? '✦ Plan' : 'Plan', badge: lockedProducts.length > 0 },
    { key: 'verification', label: 'Verification', badge: needsAck || Boolean(store.marketplace_removed_at) },
    { key: 'analytics', label: 'Analytics' },
  ];

  const remainingFree = Math.max(0, FREE_LISTING_QUOTA - Math.min(used, FREE_LISTING_QUOTA));
  const usagePct = Math.min(100, (Math.min(used, FREE_LISTING_QUOTA) / FREE_LISTING_QUOTA) * 100);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>My Store</Text>
          <View style={styles.topLinks}>
            <ProPill />
            {manageable && (
              <Pressable
                onPress={() => router.push('/seller/standee')}
                style={styles.viewLink}
              >
                <Ionicons name="qr-code-outline" size={13} color={COLORS.primary} />
                <Text style={styles.viewLinkText}>QR Standee</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push({ pathname: '/store/[trn]', params: { trn: store.trn_code } })}
              style={styles.viewLink}
            >
              <Text style={styles.viewLinkText}>Public</Text>
              <Ionicons name="open-outline" size={13} color={COLORS.primary} />
            </Pressable>
          </View>
        </View>

        <LinearGradient
          colors={['#143520', '#1E4E30']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroRow}>
            {store.storefront_image_url ? (
              <Image source={{ uri: store.storefront_image_url }} style={styles.heroImg} />
            ) : (
              <View style={[styles.heroImg, styles.heroImgEmpty]}>
                <Ionicons name="storefront" size={26} color="#FBC14E" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName} numberOfLines={1}>
                {store.business_name}
              </Text>
              <Text style={styles.heroMeta} numberOfLines={1}>
                {CATS[store.trade_category] || store.trade_category} • {store.barangay}
              </Text>
              <View style={{ marginTop: 7 }}>
                <StatusPill label={status.label} tone={status.tone} />
              </View>
            </View>
          </View>
          <Text style={styles.heroMsg}>{status.message}</Text>
          <View style={styles.heroActions}>
            <Button
              title="Edit store"
              icon="create-outline"
              variant="amber"
              small
              onPress={() => router.push('/seller/store-setup')}
              style={{ flex: 1 }}
            />
            {premium ? (
              <Pressable onPress={() => setTab('subscription')}>
                <PremiumChromePill size="md" label="Premium Plan" />
              </Pressable>
            ) : (
              <Pressable onPress={() => setTab('subscription')} style={styles.quotaTag}>
                <Text style={styles.quotaTagText}>
                  {`${Math.min(used, FREE_LISTING_QUOTA)}/${FREE_LISTING_QUOTA} free`}
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#FBC14E" />
              </Pressable>
            )}
          </View>
        </LinearGradient>

        {/* Quick 2x2 Summary Stats */}
        <View style={styles.statsGrid}>
          <StatTile icon="time-outline" label="New orders" value={String(stats.pendingCount)} accent={COLORS.warn} />
          <StatTile icon="receipt-outline" label="Total orders" value={String(stats.orderCount)} accent={COLORS.info} />
          <StatTile icon="pricetags-outline" label="Products" value={String(stats.productCount)} accent={COLORS.primary} />
          <StatTile icon="cash-outline" label="Revenue" value={peso(stats.revenue)} accent={COLORS.ok} />
        </View>

        {/* Horizontally Scrollable 5-Tab Pill Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
          style={styles.tabScrollWrap}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                  {t.label}
                </Text>
                {t.badge && <View style={styles.tabDot} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* TAB 1: ORDERS */}
        {tab === 'orders' ? (
          <>
            <View style={styles.filterRow}>
              <Chip label="Active" active={filter === 'active'} onPress={() => setFilter('active')} />
              <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label="Finished" active={filter === 'done'} onPress={() => setFilter('done')} />
            </View>
            {filteredOrders.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title={filter === 'active' ? 'No active orders' : 'No orders here'}
                text="New reservations from customers appear here instantly."
              />
            ) : (
              <View style={{ gap: 10 }}>
                {filteredOrders.map((o) => {
                  const meta = ORDER_STATUS[o.status] || ORDER_STATUS.PENDING;
                  const next = NEXT_ACTION[o.status];
                  const unit = UNITS[o.products?.unit || ''] || o.products?.unit || 'pc';
                  const live = o.status !== 'CANCELLED' && o.status !== 'EXPIRED';
                  const pickup =
                    o.status === 'READY_FOR_PICKUP' ? getPickupCountdown(o.ready_at) : null;
                  return (
                    <View key={o.id} style={styles.card}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {o.products?.name || 'Product'}
                          </Text>
                          <Text style={styles.cardSub} numberOfLines={1}>
                            {o.buyer_name || 'Customer'} •{' '}
                            {new Date(o.created_at).toLocaleString('en-PH', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </Text>
                        </View>
                        <StatusPill label={meta.label} tone={meta.tone} />
                      </View>
                      <View style={styles.orderLine}>
                        <Text style={styles.orderQty}>
                          {o.quantity} {unit} × {peso(o.products?.current_price || 0)}
                          {o.payment_method
                            ? ` • ${o.payment_method === 'GCASH' ? 'GCash' : 'Cash'}`
                            : ''}
                        </Text>
                        <Text style={styles.orderTotal}>{peso(o.total_price)}</Text>
                      </View>
                      {pickup && (
                        <View
                          style={[
                            styles.pickupPill,
                            pickup.state === 'expired'
                              ? { backgroundColor: COLORS.badBg }
                              : pickup.state === 'warn'
                              ? { backgroundColor: COLORS.warnBg }
                              : { backgroundColor: COLORS.okBg },
                          ]}
                        >
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color={
                              pickup.state === 'expired'
                                ? COLORS.bad
                                : pickup.state === 'warn'
                                ? COLORS.warn
                                : COLORS.ok
                            }
                          />
                          <Text
                            style={[
                              styles.pickupText,
                              {
                                color:
                                  pickup.state === 'expired'
                                    ? COLORS.bad
                                    : pickup.state === 'warn'
                                    ? COLORS.warn
                                    : COLORS.ok,
                              },
                            ]}
                          >
                            Pickup window: {pickup.label}
                          </Text>
                        </View>
                      )}
                      {o.notes ? <Text style={styles.note}>Note: {o.notes}</Text> : null}
                      {o.cancellation_reason ? (
                        <Text style={styles.note}>Cancelled: {o.cancellation_reason}</Text>
                      ) : null}
                      {live ? (
                        <View style={styles.actions}>
                          {next ? (
                            <Button
                              title={next.label}
                              icon={next.icon}
                              small
                              loading={busyOrder === o.id}
                              onPress={() => advanceOrder(o)}
                              style={{ flex: 1 }}
                            />
                          ) : null}
                          <Button
                            title="Chat"
                            icon="chatbubble-ellipses-outline"
                            variant="soft"
                            small
                            onPress={() =>
                              router.push({ pathname: '/chat/[orderId]', params: { orderId: o.id } })
                            }
                            style={next ? undefined : { flex: 1 }}
                          />
                          {next ? (
                            <Button
                              title="Cancel"
                              variant="danger"
                              small
                              onPress={() => {
                                setCancelReason('');
                                setCancelTarget(o);
                              }}
                            />
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : tab === 'products' ? (
          /* TAB 2: PRODUCTS */
          <>
            {/* Listing Usage Bar */}
            <Card style={{ marginBottom: 12, gap: 6 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.usageLabel}>
                  {premium ? 'Product listings' : 'Free listings used'}
                </Text>
                <Text style={styles.usageVal}>
                  {premium ? 'Unlimited ✦' : `${Math.min(used, FREE_LISTING_QUOTA)} of ${FREE_LISTING_QUOTA}`}
                </Text>
              </View>
              {!premium && (
                <View style={styles.usageTrack}>
                  <View
                    style={[
                      styles.usageFill,
                      {
                        width: `${usagePct}%`,
                        backgroundColor:
                          used >= FREE_LISTING_QUOTA
                            ? COLORS.bad
                            : usagePct >= 80
                            ? COLORS.warn
                            : COLORS.primary,
                      },
                    ]}
                  />
                </View>
              )}
              <Text style={styles.usageCaption}>
                {premium
                  ? 'Unlimited listings & Featured Store eligibility included with Premium.'
                  : remainingFree > 0
                  ? `${remainingFree} free listing${remainingFree === 1 ? '' : 's'} remaining.`
                  : 'All 15 free listings used. Extra listings are ₱1 each, or upgrade to Premium.'}
              </Text>
              {!premium && used >= FREE_LISTING_QUOTA && (
                <Button
                  title="Upgrade to Premium — ₱49/mo"
                  icon="sparkles-outline"
                  variant="amber"
                  small
                  onPress={() => setTab('subscription')}
                  style={{ marginTop: 4 }}
                />
              )}
            </Card>

            {/* Add / Bulk Add Actions */}
            <View style={styles.addRow}>
              <Button
                title={manageable ? 'Add product' : 'Approval needed'}
                icon="add"
                onPress={startAddProduct}
                disabled={!manageable}
                style={{ flex: 1 }}
              />
              <Button
                title="Bulk Add"
                icon="layers-outline"
                variant="soft"
                disabled={!manageable}
                onPress={() => router.push('/seller/bulk-products')}
              />
            </View>

            {products.length === 0 ? (
              <EmptyState
                icon="pricetags-outline"
                title="No products yet"
                text="Add your first product with a photo, price, and stock so customers can reserve it."
              />
            ) : (
              <View style={{ gap: 10 }}>
                {products.map((p) => {
                  const img = getProductImages(p)[0];
                  const out = p.in_stock === false || (p.quantity != null && Number(p.quantity) <= 0);
                  const isLocked = lockedIdSet.has(p.id);
                  const disabledByAdmin = Boolean(
                    p.marketplace_removed_at || store.marketplace_removed_at
                  );
                  return (
                    <View
                      key={p.id}
                      style={[
                        styles.card,
                        disabledByAdmin && { borderColor: 'rgba(220,38,38,0.35)' },
                      ]}
                    >
                      {disabledByAdmin && (
                        <View style={styles.disabledBanner}>
                          <Ionicons name="ban-outline" size={14} color={COLORS.bad} />
                          <Text style={styles.disabledBannerText}>
                            Disabled in marketplace by Admin
                          </Text>
                        </View>
                      )}
                      <View style={styles.prodRow}>
                        {img ? (
                          <Image source={{ uri: img }} style={styles.prodImg} />
                        ) : (
                          <View style={[styles.prodImg, styles.prodImgEmpty]}>
                            <Ionicons name="image-outline" size={20} color={COLORS.muted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.cardSub} numberOfLines={1}>
                            {PRODUCT_CATEGORY_LABELS[p.category] || CATS[p.category] || p.category}
                          </Text>
                          <View style={styles.prodMetaRow}>
                            <Text style={styles.prodPrice}>{peso(p.current_price)}</Text>
                            <Text style={styles.cardSub}>/{UNITS[p.unit] || p.unit}</Text>
                            <StatusPill
                              label={
                                out
                                  ? 'Out of stock'
                                  : p.quantity != null
                                  ? `${p.quantity} left`
                                  : 'In stock'
                              }
                              tone={out ? 'bad' : 'ok'}
                            />
                          </View>
                          {isLocked && (
                            <Pressable
                              onPress={() => setTab('subscription')}
                              style={styles.lockedTag}
                            >
                              <Ionicons name="lock-closed" size={11} color={COLORS.warn} />
                              <Text style={styles.lockedTagText}>
                                Hidden · Tap to unlock (₱1)
                              </Text>
                            </Pressable>
                          )}
                        </View>
                        <View style={{ gap: 6 }}>
                          <Pressable
                            onPress={() =>
                              router.push({ pathname: '/seller/product-form', params: { id: p.id } })
                            }
                            style={styles.iconBtn}
                            disabled={!manageable}
                          >
                            <Ionicons name="create-outline" size={17} color={COLORS.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => confirmDelete(p)}
                            style={[styles.iconBtn, { backgroundColor: COLORS.badBg }]}
                            disabled={!manageable}
                          >
                            <Ionicons name="trash-outline" size={16} color={COLORS.bad} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : tab === 'subscription' ? (
          /* TAB 3: SUBSCRIPTION & PROMOTIONS */
          userId ? (
            <SubscriptionTab
              userId={userId}
              store={store}
              sub={sub}
              productCount={products.length}
              lockedProducts={lockedProducts}
              onRefresh={load}
              onStartPayment={setPaymentConfig}
              onAddProduct={startAddProduct}
            />
          ) : null
        ) : tab === 'verification' ? (
          /* TAB 4: VERIFICATION & PERMITS */
          <VerificationTab
            store={store}
            displayStatus={displayStatus}
            compliance={compliance}
            onAcknowledged={load}
            onOpenStoreSetup={() => router.push('/seller/store-setup')}
          />
        ) : (
          /* TAB 5: ANALYTICS */
          <AnalyticsTab analytics={analytics} />
        )}
      </ScrollView>
      <StatusBarCover />

      {/* Cancel Order Sheet */}
      <Modal
        visible={!!cancelTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelTarget(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCancelTarget(null)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Cancel reservation</Text>
          <Text style={styles.sheetSub}>
            {cancelTarget?.products?.name} for {cancelTarget?.buyer_name || 'customer'}. The held
            stock will be released.
          </Text>
          <TextInput
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Reason (e.g. item no longer available)"
            placeholderTextColor={COLORS.muted}
            multiline
            style={styles.sheetInput}
          />
          <View style={styles.actions}>
            <Button
              title="Keep order"
              variant="outline"
              onPress={() => setCancelTarget(null)}
              style={{ flex: 1 }}
            />
            <Button
              title="Cancel order"
              variant="danger"
              loading={!!cancelTarget && busyOrder === cancelTarget.id}
              onPress={submitCancel}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Modal>

      {/* Demo QR Checkout Modal */}
      <DemoPaymentModal config={paymentConfig} onClose={() => setPaymentConfig(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  topLinks: { flexDirection: 'row', gap: 7 },
  pageTitle: {
    fontSize: 22,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  viewLinkText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  hero: { borderRadius: RADIUS.xl, padding: 16, overflow: 'hidden', ...SHADOW.floating },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(240,160,48,0.2)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroImg: {
    width: 62,
    height: 62,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  heroImgEmpty: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.white },
  heroMeta: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  heroMsg: {
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 12,
    lineHeight: 18,
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  quotaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  quotaTagText: { fontSize: 11.5, fontFamily: FONTS.bold, color: '#FBC14E' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statTile: {
    width: '48.4%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    gap: 4,
    ...SHADOW.card,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 18, fontFamily: FONTS.extrabold, color: COLORS.ink, letterSpacing: -0.3 },
  statLabel: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.muted },
  tabScrollWrap: { marginTop: 16, marginBottom: 12, marginHorizontal: -16 },
  tabScroll: { paddingHorizontal: 16, gap: 8 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  tabPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabPillText: {
    fontSize: 12.5,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: FONTS.bold,
    color: COLORS.inkSecondary,
  },
  tabPillTextActive: { color: COLORS.white },
  tabDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.amber },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 13,
    gap: 9,
    ...SHADOW.card,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 14.5, fontFamily: FONTS.bold, color: COLORS.ink },
  cardSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  orderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  orderQty: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.muted, flex: 1 },
  orderTotal: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.primary },
  pickupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  pickupText: { fontSize: 11.5, fontFamily: FONTS.bold },
  note: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.inkSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  usageLabel: { fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.ink },
  usageVal: { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.primary },
  usageTrack: { height: 7, borderRadius: 4, backgroundColor: COLORS.mutedBg, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 4 },
  usageCaption: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.badBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  disabledBannerText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.bad },
  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prodImg: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: COLORS.mutedBg },
  prodImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  prodMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  prodPrice: { fontSize: 14.5, fontFamily: FONTS.extrabold, color: COLORS.primary },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.warnBg,
  },
  lockedTagText: { fontSize: 10.5, fontFamily: FONTS.bold, color: COLORS.warn },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,20,14,0.45)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.line,
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.ink },
  sheetSub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 18 },
  sheetInput: {
    minHeight: 84,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
});
