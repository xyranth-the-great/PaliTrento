import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { ProductCard } from '../../components/ProductCard';
import { PremiumChromePill, PremiumGoldFrame } from '../../components/effects';
import { CATS, formatHours, isStoreOpen, PAY } from '../../lib/constants';
import {
  formatPurok,
  getProducts,
  getStoreByTrn,
  hasAvailableQuantity,
  isStorePubliclyVisible,
  Product,
  Store,
} from '../../lib/data';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function StoreDetailScreen() {
  const { trn } = useLocalSearchParams<{ trn: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!trn) {
        setLoading(false);
        return;
      }
      const s = await getStoreByTrn(String(trn));
      if (!active) return;
      setStore(s);
      if (s && isStorePubliclyVisible(s)) {
        // getProducts already excludes marketplace_removed_at & locked products
        const all = await getProducts([s]);
        if (active) {
          setProducts(all.filter((p) => p.store_id === s.id && hasAvailableQuantity(p)));
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [trn]);

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="storefront-outline" size={38} color={COLORS.muted} />
        <Text style={styles.notFoundTitle}>Store not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backPill}>
          <Text style={styles.backPillText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const open = isStoreOpen(store);
  const acceptedPayments = (store.accepted_payments || [])
    .map((p) => PAY[p])
    .filter(Boolean)
    .join(', ');
  const isOwnStore = Boolean(session && session.user.id === store.user_id);
  const canReport =
    Boolean(session) &&
    !isOwnStore &&
    (store.verification_status === 'VERIFIED' || store.approval_status === 'APPROVED');
  const purokLabel = formatPurok(store.purok);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
      >
        {/* Cover */}
        <View style={styles.coverWrap}>
          {store.storefront_image_url ? (
            <Image source={{ uri: store.storefront_image_url }} style={styles.coverImg} fadeDuration={0} />
          ) : (
            <View style={[styles.coverImg, styles.coverFallback]}>
              <Ionicons name="storefront" size={50} color="rgba(255,255,255,0.35)" />
            </View>
          )}
          <Pressable
            onPress={() => router.back()}
            style={[styles.floatingBack, { top: insets.top + 10 }]}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </Pressable>

          {canReport && (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/report-business', params: { storeId: store.id } })
              }
              style={[styles.floatingReport, { top: insets.top + 10 }]}
              accessibilityLabel="Report Business"
            >
              <Ionicons name="flag-outline" size={18} color={COLORS.white} />
            </Pressable>
          )}
        </View>

        {/* Overlapping Profile Card */}
        {store.is_premium ? (
          <View style={styles.profileCardPremiumWrap}>
            <PremiumGoldFrame borderRadius={RADIUS.xl} borderWidth={3} glowIntensity="soft">
              <View style={styles.profileCardInner}>
                <View style={styles.catRow}>
                  <Text style={styles.catText}>
                    {CATS[store.trade_category] || store.trade_category}
                  </Text>
                  <View style={styles.pillRow}>
                    <PremiumChromePill size="sm" label="Premium" />
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: open ? COLORS.okBg : COLORS.mutedBg },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: open ? COLORS.ok : COLORS.muted }]}>
                        {open ? 'Open now' : 'Closed'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.storeName}>{store.business_name}</Text>
                {store.description ? <Text style={styles.desc}>{store.description}</Text> : null}

                <View style={styles.actionRow}>
                  {store.contact_number ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${store.contact_number}`)}
                      style={styles.callBtn}
                    >
                      <Ionicons name="call" size={16} color={COLORS.primaryDark} />
                      <Text style={styles.callBtnText}>Call</Text>
                    </Pressable>
                  ) : null}
                  {store.lat != null && store.lng != null ? (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(
                          `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`
                        )
                      }
                      style={styles.dirBtn}
                    >
                      <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.dirBtnText}>Directions</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </PremiumGoldFrame>
          </View>
        ) : (
          <View style={styles.profileCard}>
            <View style={styles.catRow}>
              <Text style={styles.catText}>
                {CATS[store.trade_category] || store.trade_category}
              </Text>
              <View style={styles.pillRow}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: open ? COLORS.okBg : COLORS.mutedBg },
                  ]}
                >
                  <Text style={[styles.statusText, { color: open ? COLORS.ok : COLORS.muted }]}>
                    {open ? 'Open now' : 'Closed'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.storeName}>{store.business_name}</Text>
            {store.description ? <Text style={styles.desc}>{store.description}</Text> : null}

            <View style={styles.actionRow}>
              {store.contact_number ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${store.contact_number}`)}
                  style={styles.callBtn}
                >
                  <Ionicons name="call" size={16} color={COLORS.primaryDark} />
                  <Text style={styles.callBtnText}>Call</Text>
                </Pressable>
              ) : null}
              {store.lat != null && store.lng != null ? (
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`
                    )
                  }
                  style={styles.dirBtn}
                >
                  <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.dirBtnText}>Directions</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {/* Details Card */}
        <View style={styles.infoCard}>
          <InfoRow label="Owner" value={store.proprietor_name || '—'} />
          <InfoRow label="Hours" value={formatHours(store)} />
          <InfoRow
            label="Address"
            value={[purokLabel, store.barangay, 'Trento'].filter(Boolean).join(', ')}
          />
          {store.landmark_reference ? (
            <InfoRow label="Landmark" value={store.landmark_reference} />
          ) : null}
          <InfoRow label="Accepts" value={acceptedPayments || 'Cash'} />
          <InfoRow label="Store ID" value={store.trn_code} last />
        </View>

        {/* Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products & Prices ({products.length})</Text>
          {products.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No products listed yet.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {products.map((p) => (
                <View key={p.id} style={styles.gridItem}>
                  <ProductCard
                    product={p}
                    store={store}
                    onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Report Business Link */}
        {canReport && (
          <View style={styles.reportWrap}>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/report-business', params: { storeId: store.id } })
              }
              style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.78 }]}
            >
              <Ionicons name="flag-outline" size={15} color={COLORS.muted} />
              <Text style={styles.reportBtnText}>Report this business</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Subtle dark top scrim so light status-bar icons stay legible over bright covers & scrolled cards */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(17, 29, 21, 0.52)', 'rgba(17, 29, 21, 0.16)', 'transparent']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 28,
          zIndex: 10,
        }}
      />
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centerScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  notFoundTitle: { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.ink },
  backPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  backPillText: { color: COLORS.white, fontFamily: FONTS.bold },
  coverWrap: { height: 210, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverFallback: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBack: {
    position: 'absolute',
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20,53,31,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingReport: {
    position: 'absolute',
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20,53,31,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCardPremiumWrap: {
    marginTop: -24,
    marginHorizontal: 14,
    overflow: 'visible',
  },
  profileCardInner: {
    padding: 15,
  },
  profileCard: {
    marginTop: -24,
    marginHorizontal: 14,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
    ...SHADOW.card,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryDark,
  },
  premiumPillText: { fontSize: 10, fontFamily: FONTS.extrabold, color: '#FBC14E' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.pill },
  statusText: { fontSize: 11, fontFamily: FONTS.bold },
  storeName: {
    fontSize: 20,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
    letterSpacing: -0.3,
  },
  desc: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 19, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  callBtn: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  callBtnText: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.primaryDark },
  dirBtn: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dirBtnText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.primary },
  infoCard: {
    marginTop: 14,
    marginHorizontal: 14,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    ...SHADOW.card,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    gap: 12,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lineSubtle },
  infoLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.muted },
  infoValue: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.ink, flex: 1, textAlign: 'right' },
  section: { marginTop: 18, paddingHorizontal: 14 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, overflow: 'visible', paddingTop: 6 },
  gridItem: { width: '48%', overflow: 'visible' },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.muted },
  reportWrap: { paddingHorizontal: 14, marginTop: 22, alignItems: 'center' },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  reportBtnText: { fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.muted },
});
