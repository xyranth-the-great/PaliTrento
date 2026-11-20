import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StoreCard } from '../../components/StoreCard';
import { ProductCard } from '../../components/ProductCard';
import { FeaturedMarqueeCarousel, PremiumChromePill } from '../../components/effects';
import { CATS, isStoreOpen } from '../../lib/constants';
import {
  getFeaturedStores,
  getPremiumStoreIds,
  getProducts,
  getProductSearchScore,
  getStores,
  hasAvailableQuantity,
  Product,
  searchProductsWithPriority,
  searchStoresWithPriority,
  Store,
} from '../../lib/data';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; cat?: string; mode?: string }>();

  const [mode, setMode] = useState<'stores' | 'products'>(
    params.mode === 'products' ? 'products' : 'stores'
  );
  const [query, setQuery] = useState(params.q || '');
  const [selectedStoreCat, setSelectedStoreCat] = useState<string>(
    params.mode === 'products' ? '' : params.cat || ''
  );
  const [selectedProdCat, setSelectedProdCat] = useState<string>(
    params.mode === 'products' ? params.cat || '' : ''
  );
  const [openOnly, setOpenOnly] = useState(false);
  const [cappedOnly, setCappedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [featuredStores, setFeaturedStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rpcStores, setRpcStores] = useState<Store[] | null>(null);
  const [rpcProducts, setRpcProducts] = useState<Product[] | null>(null);
  const searchSeqRef = useRef(0);

  useEffect(() => {
    if (params.q !== undefined) setQuery(params.q);
    if (params.mode === 'products') {
      setMode('products');
      if (params.cat !== undefined) setSelectedProdCat(params.cat);
    } else {
      if (params.cat !== undefined) {
        setMode('stores');
        setSelectedStoreCat(params.cat);
      }
    }
  }, [params.q, params.cat, params.mode]);

  const loadData = useCallback(async () => {
    try {
      const [allStores, featured, premiumIds] = await Promise.all([
        getStores(),
        getFeaturedStores(),
        getPremiumStoreIds(),
      ]);
      featured.forEach((s) => {
        if (s.is_premium) premiumIds.add(s.id);
      });
      const enriched = allStores
        .map((s) => ({
          ...s,
          is_premium: Boolean(s.is_premium || premiumIds.has(s.id)),
        }))
        .sort(
          (a, b) =>
            Number(Boolean(b.is_premium)) - Number(Boolean(a.is_premium)) ||
            a.business_name.localeCompare(b.business_name)
        );
      const allProducts = await getProducts(enriched);
      const available = allProducts.filter(hasAvailableQuantity).map((p) => ({
        ...p,
        is_premium_store: premiumIds.has(p.store_id),
      }));
      setStores(enriched);
      setFeaturedStores(
        featured.map((s) => ({
          ...s,
          is_premium: Boolean(s.is_premium || premiumIds.has(s.id)),
        }))
      );
      setProducts(available);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const storeById = useMemo(() => {
    const map: Record<string, Store> = {};
    stores.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [stores]);

  const productById = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const productCategories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  // Server-side priority search via RPCs when filters/query are active (mirrors explore.js & products.js)
  useEffect(() => {
    const q = query.trim();
    const storeFilterActive = Boolean(q || selectedStoreCat || openOnly);
    const prodFilterActive = Boolean(q || selectedProdCat || cappedOnly || inStockOnly);

    if (mode === 'stores' && !storeFilterActive) {
      setRpcStores(null);
      setSearching(false);
      return;
    }
    if (mode === 'products' && !prodFilterActive) {
      setRpcProducts(null);
      setSearching(false);
      return;
    }

    const seq = ++searchSeqRef.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      if (mode === 'stores') {
        const res = await searchStoresWithPriority({
          query: q,
          category: selectedStoreCat,
          openOnly,
        });
        if (seq !== searchSeqRef.current) return;
        setRpcStores(res);
      } else {
        const res = await searchProductsWithPriority({
          query: q,
          category: selectedProdCat,
          cappedOnly,
          inStockOnly,
        });
        if (seq !== searchSeqRef.current) return;
        setRpcProducts(res);
      }
      setSearching(false);
    }, 220);

    return () => clearTimeout(timer);
  }, [cappedOnly, inStockOnly, mode, openOnly, query, selectedProdCat, selectedStoreCat]);

  const displayedStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasFilter = Boolean(q || selectedStoreCat || openOnly);

    if (hasFilter && rpcStores) {
      // Merge with local store metadata (purok, badges) and preserve RPC premium-first order
      return rpcStores
        .filter((s) => !storeById[s.id]?.marketplace_removed_at)
        .map((s) => ({
          ...(storeById[s.id] || s),
          ...s,
          is_premium: Boolean(s.is_premium || storeById[s.id]?.is_premium),
        }));
    }

    // Fallback or default view (Premium first)
    const productHitStoreIds = q
      ? new Set(
          products
            .filter((p) => p.name.toLowerCase().includes(q))
            .map((p) => p.store_id)
        )
      : null;

    return stores
      .filter((s) => {
        if (selectedStoreCat && s.trade_category !== selectedStoreCat) return false;
        if (openOnly && !isStoreOpen(s)) return false;
        if (q) {
          const hay = `${s.business_name} ${s.barangay} ${s.description || ''} ${CATS[s.trade_category] || ''}`.toLowerCase();
          if (!hay.includes(q) && !productHitStoreIds?.has(s.id)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.is_premium)) - Number(Boolean(a.is_premium)) ||
          a.business_name.localeCompare(b.business_name)
      );
  }, [openOnly, products, query, rpcStores, selectedStoreCat, storeById, stores]);

  const displayedProducts = useMemo(() => {
    const q = query.trim();
    const hasFilter = Boolean(q || selectedProdCat || cappedOnly || inStockOnly);

    const sortPremiumFirst = (list: Product[]) =>
      [...list].sort((a, b) => {
        const aPrem = Boolean(a.is_premium_store ?? storeById[a.store_id]?.is_premium);
        const bPrem = Boolean(b.is_premium_store ?? storeById[b.store_id]?.is_premium);
        return (
          Number(bPrem) - Number(aPrem) ||
          getProductSearchScore(b, q, storeById[b.store_id]?.business_name) -
            getProductSearchScore(a, q, storeById[a.store_id]?.business_name) ||
          a.name.localeCompare(b.name)
        );
      });

    if (hasFilter && rpcProducts) {
      // Merge server priority results with local image_urls & fuzzy/synonym matches (mirrors products.js)
      const byId = new Map<string, Product>();
      rpcProducts.forEach((p) => {
        const local = productById[p.id];
        byId.set(p.id, {
          ...(local || p),
          ...p,
          image_urls: local?.image_urls ?? p.image_urls,
          is_premium_store: Boolean(p.is_premium_store ?? storeById[p.store_id]?.is_premium),
        });
      });
      if (q) {
        products
          .filter(
            (p) =>
              (!selectedProdCat || p.category === selectedProdCat) &&
              (!cappedOnly || p.lgu_srp_ceiling != null) &&
              (!inStockOnly || Boolean(p.in_stock)) &&
              getProductSearchScore(p, q, storeById[p.store_id]?.business_name) > 0
          )
          .forEach((p) => {
            if (!byId.has(p.id)) byId.set(p.id, p);
          });
      }
      return sortPremiumFirst([...byId.values()]);
    }

    const filtered = products.filter((p) => {
      if (selectedProdCat && p.category !== selectedProdCat) return false;
      if (cappedOnly && p.lgu_srp_ceiling == null) return false;
      if (inStockOnly && !p.in_stock) return false;
      if (q && getProductSearchScore(p, q, storeById[p.store_id]?.business_name) <= 0) {
        return false;
      }
      return true;
    });
    return sortPremiumFirst(filtered);
  }, [cappedOnly, inStockOnly, productById, products, query, rpcProducts, selectedProdCat, storeById]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.segmentWrap}>
          <Pressable
            onPress={() => setMode('stores')}
            style={[styles.segBtn, mode === 'stores' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, mode === 'stores' && styles.segTextActive]}>
              Stores ({displayedStores.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('products')}
            style={[styles.segBtn, mode === 'products' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, mode === 'products' && styles.segTextActive]}>
              Products ({displayedProducts.length})
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={mode === 'stores' ? 'Search stores or barangay...' : 'Search products...'}
            placeholderTextColor={COLORS.muted}
          />
          {searching ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filter Chip Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {mode === 'stores' ? (
            <>
              <Pressable
                onPress={() => setOpenOnly((v) => !v)}
                style={[styles.chip, openOnly && styles.chipActive]}
              >
                <Ionicons
                  name={openOnly ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                  color={openOnly ? COLORS.white : COLORS.primary}
                />
                <Text style={[styles.chipText, openOnly && styles.chipTextActive]}>Open now</Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedStoreCat('')}
                style={[styles.chip, !selectedStoreCat && styles.chipActive]}
              >
                <Text style={[styles.chipText, !selectedStoreCat && styles.chipTextActive]}>
                  All
                </Text>
              </Pressable>

              {Object.entries(CATS).map(([key, label]) => {
                const active = selectedStoreCat === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelectedStoreCat(active ? '' : key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </>
          ) : (
            <>
              <Pressable
                onPress={() => setCappedOnly((v) => !v)}
                style={[styles.chip, cappedOnly && styles.chipActive]}
              >
                <Ionicons
                  name={cappedOnly ? 'checkmark-circle' : 'pricetag-outline'}
                  size={14}
                  color={cappedOnly ? COLORS.white : COLORS.primary}
                />
                <Text style={[styles.chipText, cappedOnly && styles.chipTextActive]}>
                  Price-capped
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setInStockOnly((v) => !v)}
                style={[styles.chip, inStockOnly && styles.chipActive]}
              >
                <Ionicons
                  name={inStockOnly ? 'checkmark-circle' : 'cube-outline'}
                  size={14}
                  color={inStockOnly ? COLORS.white : COLORS.primary}
                />
                <Text style={[styles.chipText, inStockOnly && styles.chipTextActive]}>
                  In stock
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedProdCat('')}
                style={[styles.chip, !selectedProdCat && styles.chipActive]}
              >
                <Text style={[styles.chipText, !selectedProdCat && styles.chipTextActive]}>All</Text>
              </Pressable>

              {productCategories.map((cat) => {
                const active = selectedProdCat === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedProdCat(active ? '' : cat)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : mode === 'stores' ? (
        <FlatList
          key="stores-list"
          data={displayedStores}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={false}
          contentContainerStyle={styles.listPad}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            !query.trim() && !selectedStoreCat && !openOnly && featuredStores.length > 0 ? (
              <View style={styles.featuredHeaderWrap}>
                <View style={styles.featuredTitleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featuredTitle}>Featured Stores</Text>
                    <Text style={styles.featuredSub}>Spotlit & Premium verified shops</Text>
                  </View>
                  <PremiumChromePill size="xs" label="Featured" />
                </View>
                <FeaturedMarqueeCarousel
                  data={featuredStores}
                  keyExtractor={(item) => item.id}
                  itemWidth={228}
                  gap={14}
                  speedPxPerSec={40}
                  fadeColor={COLORS.bg}
                  style={{ marginHorizontal: -14 }}
                  renderItem={(item) => (
                    <StoreCard
                      store={item}
                      onPress={() =>
                        router.push({ pathname: '/store/[trn]', params: { trn: item.trn_code } })
                      }
                    />
                  )}
                />
                <Text style={styles.allStoresHeading}>All Stores</Text>
              </View>
            ) : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={34} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No stores matched</Text>
              <Text style={styles.emptySub}>Try clearing a filter or searching another keyword.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <StoreCard
              store={item}
              variant="row"
              onPress={() =>
                router.push({ pathname: '/store/[trn]', params: { trn: item.trn_code } })
              }
            />
          )}
        />
      ) : (
        <FlatList
          key="products-grid"
          data={displayedProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          removeClippedSubviews={false}
          columnWrapperStyle={{ gap: 12, overflow: 'visible' }}
          contentContainerStyle={styles.productsListPad}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="basket-outline" size={34} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySub}>Try another search term or category.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, overflow: 'visible' }}>
              <ProductCard
                product={item}
                store={storeById[item.store_id]}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: RADIUS.md,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: COLORS.white,
  },
  segText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: FONTS.bold,
    color: 'rgba(255,255,255,0.88)',
  },
  segTextActive: {
    color: COLORS.primaryDark,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    paddingVertical: 0,
  },
  filterBar: {
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  filterScroll: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 7,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.inkSecondary,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listPad: {
    padding: 14,
    paddingBottom: 24,
  },
  productsListPad: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 28,
  },
  featuredHeaderWrap: {
    marginBottom: 14,
    overflow: 'visible',
  },
  featuredTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  featuredTitle: {
    fontSize: 16.5,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  featuredSub: {
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    marginTop: 1,
  },
  allStoresHeading: {
    fontSize: 14.5,
    fontFamily: FONTS.extrabold,
    color: COLORS.inkSecondary,
    marginTop: 10,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.line,
    gap: 6,
    ...SHADOW.card,
  },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  emptySub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.muted, textAlign: 'center' },
});
