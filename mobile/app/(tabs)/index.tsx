import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { StoreCard } from '../../components/StoreCard';
import { ProductCard } from '../../components/ProductCard';
import { LogoMark } from '../../components/LogoMark';
import { FeaturedMarqueeCarousel } from '../../components/effects';
import { ProPill } from '../../components/premium';
import {
  CATS,
  distanceMiles,
  getSrpStatus,
  greetingForHour,
  peso,
  TRENTO_CENTER,
  UNITS,
} from '../../lib/constants';
import {
  getFeaturedStores,
  getPremiumStoreIds,
  getProducts,
  getStores,
  hasAvailableQuantity,
  Product,
  Store,
} from '../../lib/data';
import { CATEGORY_VISUALS, COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const { unreadCount, refreshUnreadCount } = useNotifications();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredStores, setFeaturedStores] = useState<Store[]>([]);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [cappedProducts, setCappedProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [storeMap, setStoreMap] = useState<Record<string, Store>>({});

  const loadData = useCallback(async () => {
    try {
      const [featured, stores, premiumIds] = await Promise.all([
        getFeaturedStores(),
        getStores(),
        getPremiumStoreIds(),
      ]);
      featured.forEach((s) => {
        if (s.is_premium) premiumIds.add(s.id);
      });
      const enrichedStores = stores.map((s) => ({
        ...s,
        is_premium: Boolean(s.is_premium || premiumIds.has(s.id)),
      }));
      const products = await getProducts(enrichedStores);

      const map: Record<string, Store> = {};
      enrichedStores.forEach((s) => {
        map[s.id] = s;
      });
      setStoreMap(map);

      const market = enrichedStores.find((s) => s.trn_code === 'TRN-2024-012');
      const center =
        market?.lat != null && market?.lng != null
          ? { lat: market.lat, lng: market.lng }
          : TRENTO_CENTER;

      const nearby = enrichedStores
        .map((s) => ({
          store: s,
          dist: distanceMiles(center, s),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10)
        .map((x) => x.store);

      const available = products
        .filter(hasAvailableQuantity)
        .sort(
          (a, b) =>
            Number(Boolean(map[b.store_id]?.is_premium)) -
            Number(Boolean(map[a.store_id]?.is_premium))
        );
      const capped = available.filter((p) => p.lgu_srp_ceiling != null).slice(0, 5);

      setFeaturedStores(featured.slice(0, 10));
      setNearbyStores(nearby);
      setCappedProducts(capped);
      setPopularProducts(available.slice(0, 6));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fullName = (profile?.full_name || session?.user?.user_metadata?.full_name || '').trim();
  const firstName = fullName.split(/\s+/)[0];
  const initial = (firstName?.[0] || 'P').toUpperCase();

  const handleSearch = () => {
    const q = query.trim();
    router.push({ pathname: '/(tabs)/explore', params: q ? { q } : {} });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Pinned Top Bar (never collides with status bar) */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.push('/(tabs)/map')}
          style={styles.locHeaderLeft}
        >
          <View style={styles.locIconWrap}>
            <LogoMark size={32} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              {greetingForHour().toUpperCase()}
              {firstName ? `, ${firstName.toUpperCase()}` : ''}
            </Text>
            <View style={styles.locTitleRow}>
              <Text style={styles.locTitle} numberOfLines={1}>
                {profile?.barangay ? `${profile.barangay}, Trento` : 'Trento, Agusan del Sur'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.muted} />
            </View>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          <ProPill />
          <Pressable
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.8 }]}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={COLORS.ink} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText} allowFontScaling={false}>
                  {unreadCount > 9 ? '9+' : String(unreadCount)}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/account')}
            style={styles.avatarBtn}
            accessibilityLabel="Account"
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <LinearGradient
                colors={[COLORS.primaryMid, COLORS.primaryDark]}
                style={styles.avatarFallback}
              >
                <Text style={styles.avatarLetter}>{initial}</Text>
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
              refreshUnreadCount();
            }}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        {/* Modern Search Pill */}
        <View style={styles.searchSection}>
          <View style={styles.searchPill}>
            <Ionicons name="search" size={18} color={COLORS.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search stores, rice, botika..."
              placeholderTextColor={COLORS.muted}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <Pressable
              onPress={handleSearch}
              style={({ pressed }) => [styles.searchAction, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
            </Pressable>
          </View>
        </View>

        {/* Super-App Category Squircle Rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRail}
        >
          {Object.entries(CATS).map(([key, fullLabel]) => {
            const vis = CATEGORY_VISUALS[key] || {
              icon: 'grid',
              bg: COLORS.primarySoft,
              color: COLORS.primary,
              shortLabel: fullLabel,
            };
            return (
              <Pressable
                key={key}
                onPress={() => router.push({ pathname: '/(tabs)/explore', params: { cat: key } })}
                style={({ pressed }) => [styles.catItem, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                <View style={[styles.catSquircle, { backgroundColor: vis.bg }]}>
                  <Ionicons
                    name={vis.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={vis.color}
                  />
                </View>
                <Text style={styles.catLabel} allowFontScaling={false}>
                  {vis.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderText}>Finding local stores...</Text>
          </View>
        ) : (
          <>
            {/* Featured Stores */}
            {featuredStores.length > 0 && (
              <View style={styles.section}>
                <View style={styles.secHead}>
                  <View>
                    <Text style={styles.secTitle}>Featured in Trento</Text>
                    <Text style={styles.secSub}>Handpicked verified local shops</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(tabs)/explore')}
                    style={styles.seeAllBtn}
                  >
                    <Text style={styles.seeAllText}>See all</Text>
                    <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                  </Pressable>
                </View>

                <FeaturedMarqueeCarousel
                  data={featuredStores}
                  keyExtractor={(item) => item.id}
                  itemWidth={232}
                  gap={14}
                  speedPxPerSec={40}
                  fadeColor={COLORS.bg}
                  renderItem={(item) => (
                    <StoreCard
                      store={item}
                      onPress={() =>
                        router.push({ pathname: '/store/[trn]', params: { trn: item.trn_code } })
                      }
                    />
                  )}
                />
              </View>
            )}

            {/* Flagship Emerald Bantay Presyo Banner */}
            <View style={styles.section}>
              <LinearGradient
                colors={['#143520', '#1E4E30', '#255D3A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bantayCard}
              >
                <View style={styles.bantayGlow} />
                <View style={styles.bantayHead}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.bantayBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.bantayBadgeText}>MUNICIPAL PRICE WATCH</Text>
                    </View>
                    <Text style={styles.bantayTitle}>Bantay Presyo</Text>
                    <Text style={styles.bantaySub}>
                      Compare today's local prices against official LGU caps
                    </Text>
                  </View>
                  <View style={styles.bantayPeso}>
                    <Text style={styles.bantayPesoText}>₱</Text>
                  </View>
                </View>

                {cappedProducts.length === 0 ? (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/(tabs)/explore', params: { mode: 'products' } })
                    }
                    style={({ pressed }) => [styles.bantayCta, pressed && { opacity: 0.9 }]}
                  >
                    <Text style={styles.bantayCtaText}>Browse all local prices</Text>
                    <Ionicons name="arrow-forward" size={15} color={COLORS.primaryDark} />
                  </Pressable>
                ) : (
                  <View style={styles.bantayList}>
                    {cappedProducts.map((p) => {
                      const srp = getSrpStatus(p);
                      const unit = UNITS[p.unit] || p.unit || 'pc';
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() =>
                            router.push({ pathname: '/product/[id]', params: { id: p.id } })
                          }
                          style={({ pressed }) => [styles.bantayRow, pressed && { opacity: 0.85 }]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bantayItemName} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={styles.bantayItemCap}>
                              Cap {peso(p.lgu_srp_ceiling)} / {unit}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <Text style={styles.bantayItemPrice}>{peso(p.current_price)}</Text>
                            {srp && (
                              <Text
                                style={[
                                  styles.bantayItemStatus,
                                  { color: srp.ok ? '#86EFAC' : '#FCA5A5' },
                                ]}
                              >
                                {srp.text}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Popular Products Grid (when available) */}
            {popularProducts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.secHead}>
                  <View>
                    <Text style={styles.secTitle}>Fresh & Ready for Pickup</Text>
                    <Text style={styles.secSub}>Reserve items directly from Trento sellers</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/(tabs)/explore', params: { mode: 'products' } })
                    }
                    style={styles.seeAllBtn}
                  >
                    <Text style={styles.seeAllText}>All</Text>
                    <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                  </Pressable>
                </View>

                <View style={styles.prodGrid}>
                  {popularProducts.slice(0, 6).map((p) => (
                    <View key={p.id} style={styles.prodGridItem}>
                      <ProductCard
                        product={p}
                        store={storeMap[p.store_id]}
                        onPress={() =>
                          router.push({ pathname: '/product/[id]', params: { id: p.id } })
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Nearby Stores */}
            <View style={styles.section}>
              <View style={styles.secHead}>
                <View>
                  <Text style={styles.secTitle}>Near Trento Public Market</Text>
                  <Text style={styles.secSub}>Verified stores closest to town center</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/(tabs)/map')}
                  style={styles.seeAllBtn}
                >
                  <Text style={styles.seeAllText}>Map</Text>
                  <Ionicons name="map-outline" size={13} color={COLORS.primary} />
                </Pressable>
              </View>

              <View style={styles.nearbyList}>
                {nearbyStores.slice(0, 6).map((item) => (
                  <StoreCard
                    key={item.id}
                    store={item}
                    variant="row"
                    onPress={() =>
                      router.push({ pathname: '/store/[trn]', params: { trn: item.trn_code } })
                    }
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: COLORS.bg,
    gap: 12,
  },
  locHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    letterSpacing: 0.7,
    color: COLORS.muted,
  },
  locTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  locTitle: {
    fontSize: 14.5,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.bad,
    borderWidth: 1.5,
    borderColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 9.5,
    lineHeight: 12,
    includeFontPadding: false,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
    textAlign: 'center',
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 15,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingLeft: 16,
    paddingRight: 5,
    gap: 10,
    ...SHADOW.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    paddingVertical: 0,
  },
  searchAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRail: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },
  catItem: {
    alignItems: 'center',
    width: 72,
    gap: 6,
  },
  catSquircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    width: '100%',
    fontSize: 11,
    lineHeight: 15,
    includeFontPadding: false,
    fontFamily: FONTS.semibold,
    color: COLORS.inkSecondary,
    textAlign: 'center',
  },
  loaderWrap: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: COLORS.muted,
  },
  section: {
    marginTop: 22,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  secTitle: {
    fontSize: 17,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.35,
  },
  secSub: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    marginTop: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  hList: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  bantayCard: {
    marginHorizontal: 16,
    borderRadius: RADIUS.xl,
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOW.floating,
  },
  bantayGlow: {
    position: 'absolute',
    right: -45,
    top: -45,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(240,160,48,0.2)',
  },
  bantayHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bantayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FBC14E',
  },
  bantayBadgeText: {
    fontSize: 9.5,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.8,
    color: '#FBC14E',
  },
  bantayTitle: {
    fontSize: 20,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
    letterSpacing: -0.4,
  },
  bantaySub: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 3,
    lineHeight: 17,
  },
  bantayPeso: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(251,193,78,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,193,78,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bantayPesoText: {
    fontSize: 20,
    fontFamily: FONTS.extrabold,
    color: '#FBC14E',
  },
  bantayCta: {
    marginTop: 14,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: '#FBC14E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bantayCtaText: {
    fontSize: 13,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
  },
  bantayList: {
    marginTop: 14,
    gap: 8,
  },
  bantayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  bantayItemName: {
    fontSize: 13.5,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  bantayItemCap: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  bantayItemPrice: {
    fontSize: 14.5,
    fontFamily: FONTS.extrabold,
    color: '#FBC14E',
  },
  bantayItemStatus: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  prodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 12,
    overflow: 'visible',
  },
  prodGridItem: {
    width: '48%',
    overflow: 'visible',
  },
  nearbyList: {
    paddingHorizontal: 16,
    gap: 12,
    overflow: 'visible',
  },
});
