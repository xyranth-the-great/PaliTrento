import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { ProductCard } from '../../components/ProductCard';
import {
  FirePriceUnderline,
  FireShowcaseFrame,
  getProductShowcaseTheme,
  PikachuPriceUnderline,
  PikachuShowcaseFrame,
  PremiumChromePill,
  PremiumGoldFrame,
} from '../../components/effects';
import { CATS, getSrpStatus, PAY, peso, UNITS } from '../../lib/constants';
import {
  getProductById,
  getProductImages,
  getRelatedProducts,
  Product,
  Store,
} from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [relatedStores, setRelatedStores] = useState<Record<string, Store>>({});
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setRelated([]);
      const res = await getProductById(String(id), session?.user?.id);
      if (!active) return;
      if (res) {
        setProduct(res.product);
        setStore(res.store);
        const accepted = res.store.accepted_payments || ['CASH'];
        if (accepted.length > 0) setPaymentMethod(accepted[0]);
        setLoading(false);

        // Load "You may also like" in the background so main view renders fast
        const rel = await getRelatedProducts(res.product, Boolean(res.store.is_premium));
        if (active) {
          setRelated(rel.products);
          setRelatedStores(rel.storeMap);
        }
      } else {
        setProduct(null);
        setStore(null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, session?.user?.id]);

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!product || !store) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="basket-outline" size={38} color={COLORS.muted} />
        <Text style={styles.notFoundTitle}>Product unavailable</Text>
        <Text style={styles.notFoundSub}>
          This listing may have been removed or locked by the seller.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backPill}>
          <Text style={styles.backPillText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const images = getProductImages(product);
  const srp = getSrpStatus(product);
  const unit = UNITS[product.unit] || product.unit || 'pc';
  const maxQty = product.quantity != null ? Math.max(1, Number(product.quantity)) : 99;
  const acceptedPayments =
    Array.isArray(store.accepted_payments) && store.accepted_payments.length > 0
      ? store.accepted_payments
      : ['CASH'];
  const isOwnProduct = Boolean(session && session.user.id === store.user_id);
  const outOfStock = !product.in_stock || (product.quantity != null && Number(product.quantity) <= 0);
  const canReport =
    Boolean(session) &&
    !isOwnProduct &&
    (store.verification_status === 'VERIFIED' || store.approval_status === 'APPROVED');
  const total = Number(product.current_price) * qty;
  const showcase = getProductShowcaseTheme(product);
  const showcaseImgW = width - 52;
  const showcaseImgH = Math.round(showcaseImgW * 0.96);

  const handleReserve = async () => {
    if (!session?.user?.id) {
      router.push('/(auth)/login');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('orders').insert({
        buyer_id: session.user.id,
        store_id: store.id,
        product_id: product.id,
        quantity: qty,
        total_price: total,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        status: 'PENDING',
      });
      if (error) throw error;
      Alert.alert(
        'Reserved for pickup!',
        `${qty} × ${product.name} (${peso(total)}) has been sent to ${store.business_name}.`,
        [{ text: 'View My Orders', onPress: () => router.replace('/(tabs)/orders') }]
      );
    } catch (e: any) {
      Alert.alert('Could not reserve', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (!isOwnProduct && !outOfStock ? 110 : 32) + insets.bottom }}
      >
        {/* Image Gallery or Custom Collector Showcase Stage */}
        {showcase ? (
          <View style={styles.showcaseStage}>
            <LinearGradient
              colors={
                showcase === 'fire'
                  ? ['#260D06', '#461708', '#6B240C', COLORS.bg]
                  : ['#241D03', '#443504', '#634E06', COLORS.bg]
              }
              locations={[0, 0.36, 0.72, 1]}
              style={styles.showcaseBg}
            />

            <View style={[styles.showcasePad, { paddingTop: insets.top + 58 }]}>
              {showcase === 'fire' ? (
                <FireShowcaseFrame
                  variant="detail"
                  borderRadius={20}
                  style={{ width: showcaseImgW + 8, height: showcaseImgH + 8 }}
                  innerStyle={{ width: showcaseImgW, height: showcaseImgH }}
                >
                  {images.length > 1 ? (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ width: showcaseImgW, height: showcaseImgH }}
                    >
                      {images.map((uri, idx) => (
                        <Image
                          key={`${uri}-${idx}`}
                          source={{ uri }}
                          style={{ width: showcaseImgW, height: showcaseImgH, resizeMode: 'cover' }}
                        />
                      ))}
                    </ScrollView>
                  ) : images.length === 1 ? (
                    <Image
                      source={{ uri: images[0] }}
                      style={{ width: showcaseImgW, height: showcaseImgH, resizeMode: 'cover' }}
                    />
                  ) : (
                    <View
                      style={[
                        styles.galleryPlaceholder,
                        { width: showcaseImgW, height: showcaseImgH },
                      ]}
                    >
                      <Ionicons name="flame" size={56} color="#FF8A1F" />
                    </View>
                  )}
                </FireShowcaseFrame>
              ) : (
                <PikachuShowcaseFrame
                  variant="detail"
                  borderRadius={20}
                  style={{ width: showcaseImgW + 8, height: showcaseImgH + 8 }}
                  innerStyle={{ width: showcaseImgW, height: showcaseImgH }}
                >
                  {images.length > 1 ? (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ width: showcaseImgW, height: showcaseImgH }}
                    >
                      {images.map((uri, idx) => (
                        <Image
                          key={`${uri}-${idx}`}
                          source={{ uri }}
                          style={{ width: showcaseImgW, height: showcaseImgH, resizeMode: 'cover' }}
                        />
                      ))}
                    </ScrollView>
                  ) : images.length === 1 ? (
                    <Image
                      source={{ uri: images[0] }}
                      style={{ width: showcaseImgW, height: showcaseImgH, resizeMode: 'cover' }}
                    />
                  ) : (
                    <View
                      style={[
                        styles.galleryPlaceholder,
                        { width: showcaseImgW, height: showcaseImgH },
                      ]}
                    >
                      <Ionicons name="flash" size={56} color="#F5B400" />
                    </View>
                  )}
                </PikachuShowcaseFrame>
              )}

              <View
                style={[
                  styles.showcasePill,
                  showcase === 'fire' ? styles.showcasePillFire : styles.showcasePillPk,
                ]}
              >
                <Ionicons
                  name={showcase === 'fire' ? 'flame' : 'flash'}
                  size={13}
                  color={showcase === 'fire' ? '#FFB02E' : '#FFE14D'}
                />
                <Text style={styles.showcasePillText}>
                  {showcase === 'fire'
                    ? 'Ember Foil Showcase · Drag card to tilt 3D'
                    : 'Electric Foil Showcase · Drag card to tilt 3D'}
                </Text>
              </View>
            </View>

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
                  router.push({ pathname: '/report-product', params: { productId: product.id } })
                }
                style={[styles.floatingReport, { top: insets.top + 10 }]}
                accessibilityLabel="Report Product"
              >
                <Ionicons name="flag-outline" size={18} color={COLORS.white} />
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.galleryWrap}>
            {images.length > 0 ? (
              <FlatList
                data={images}
                keyExtractor={(uri, idx) => `${uri}-${idx}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <Image source={{ uri: item }} style={styles.galleryImg} />}
              />
            ) : (
              <View style={[styles.galleryImg, styles.galleryPlaceholder]}>
                <Ionicons name="basket-outline" size={56} color={COLORS.primary} />
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
                  router.push({ pathname: '/report-product', params: { productId: product.id } })
                }
                style={[styles.floatingReport, { top: insets.top + 10 }]}
                accessibilityLabel="Report Product"
              >
                <Ionicons name="flag-outline" size={18} color={COLORS.white} />
              </Pressable>
            )}
          </View>
        )}

        {/* Product Summary */}
        <View style={styles.card}>
          <View style={styles.metaTopRow}>
            <Text style={styles.catMeta}>
              {CATS[product.category] || product.category} • per {unit}
            </Text>
            {store.is_premium && <PremiumChromePill size="sm" label="Premium" />}
          </View>
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.priceRow}>
            <View style={{ alignSelf: 'flex-start' }}>
              <Text style={styles.price}>{peso(product.current_price)}</Text>
              {showcase === 'fire' && <FirePriceUnderline height={4} style={{ marginTop: 4 }} />}
              {showcase === 'pikachu' && <PikachuPriceUnderline style={{ marginTop: 4 }} />}
            </View>
            {srp && (
              <View style={[styles.pill, { backgroundColor: srp.ok ? COLORS.okBg : COLORS.badBg }]}>
                <Text style={[styles.pillText, { color: srp.ok ? COLORS.ok : COLORS.bad }]}>
                  {srp.text}
                </Text>
              </View>
            )}
          </View>

          {product.lgu_srp_ceiling != null && (
            <Text style={styles.capNote}>
              Official LGU price cap: {peso(product.lgu_srp_ceiling)} / {unit}
            </Text>
          )}

          {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Availability</Text>
              <Text style={[styles.statVal, { color: outOfStock ? COLORS.bad : COLORS.ok }]}>
                {outOfStock ? 'Out of stock' : 'In stock'}
              </Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Stock left</Text>
              <Text style={styles.statVal}>
                {product.quantity != null ? `${product.quantity} ${unit}` : 'Available'}
              </Text>
            </View>
          </View>
        </View>

        {/* Store Card */}
        {store.is_premium ? (
          <Pressable
            onPress={() => router.push({ pathname: '/store/[trn]', params: { trn: store.trn_code } })}
            style={styles.storeCardPremiumWrap}
          >
            <PremiumGoldFrame borderRadius={RADIUS.lg} borderWidth={2.5} glowIntensity="soft">
              <View style={styles.storeCardInner}>
                <View style={styles.storeIcon}>
                  <Ionicons name="storefront-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeLabel}>Sold by</Text>
                  <View style={styles.storeNameRow}>
                    <Text style={styles.storeName} numberOfLines={1}>
                      {store.business_name}
                    </Text>
                    <PremiumChromePill size="xs" label="Premium" />
                  </View>
                  <Text style={styles.storeLoc}>{store.barangay}, Trento</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
              </View>
            </PremiumGoldFrame>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push({ pathname: '/store/[trn]', params: { trn: store.trn_code } })}
            style={styles.storeCard}
          >
            <View style={styles.storeIcon}>
              <Ionicons name="storefront-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeLabel}>Sold by</Text>
              <View style={styles.storeNameRow}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {store.business_name}
                </Text>
              </View>
              <Text style={styles.storeLoc}>{store.barangay}, Trento</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        )}

        {/* Reservation Form */}
        {!isOwnProduct && !outOfStock && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reserve for Pickup</Text>

            <View style={styles.qtyRow}>
              <Text style={styles.fieldLabel}>Quantity</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="remove" size={18} color={COLORS.ink} />
                </Pressable>
                <Text style={styles.stepVal}>{qty}</Text>
                <Pressable
                  onPress={() => setQty((q) => Math.min(maxQty, q + 1))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="add" size={18} color={COLORS.ink} />
                </Pressable>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12, marginBottom: 6 }]}>
              Payment method
            </Text>
            <View style={styles.payRow}>
              {acceptedPayments.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setPaymentMethod(m)}
                  style={[styles.payChip, paymentMethod === m && styles.payChipActive]}
                >
                  <Text style={[styles.payChipText, paymentMethod === m && styles.payChipTextActive]}>
                    {PAY[m] || m}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12, marginBottom: 6 }]}>
              Notes for seller (optional)
            </Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. I'll pick this up around 4 PM"
              placeholderTextColor={COLORS.muted}
              multiline
            />
          </View>
        )}

        {/* Report Product Button */}
        {canReport && (
          <View style={styles.reportWrap}>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/report-product', params: { productId: product.id } })
              }
              style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.78 }]}
            >
              <Ionicons name="flag-outline" size={15} color={COLORS.muted} />
              <Text style={styles.reportBtnText}>Report this product</Text>
            </Pressable>
          </View>
        )}

        {/* "You may also like" Related Products */}
        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>You may also like</Text>
            <Text style={styles.relatedSub}>More {product.category} listings in Trento</Text>
            <View style={styles.relatedGrid}>
              {related.map((item) => (
                <View key={item.id} style={styles.relatedItem}>
                  <ProductCard
                    product={item}
                    store={relatedStores[item.store_id]}
                    onPress={() =>
                      router.push({ pathname: '/product/[id]', params: { id: item.id } })
                    }
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Reserve Bar */}
      {!isOwnProduct && !outOfStock && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View>
            <Text style={styles.totalLabel}>Total ({qty})</Text>
            <Text style={styles.totalVal}>{peso(total)}</Text>
          </View>
          <Pressable
            onPress={handleReserve}
            disabled={submitting}
            style={({ pressed }) => [styles.reserveBtn, (pressed || submitting) && { opacity: 0.88 }]}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.primaryDark} />
            ) : (
              <Text style={styles.reserveBtnText}>Reserve for Pickup</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Subtle dark top scrim so light status-bar icons stay legible over bright photos & scrolled cards */}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centerScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  notFoundTitle: { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.ink },
  notFoundSub: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    textAlign: 'center',
  },
  backPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  backPillText: { color: COLORS.white, fontFamily: FONTS.bold },
  galleryWrap: { width, height: width * 0.85, position: 'relative' },
  galleryImg: { width, height: width * 0.85, resizeMode: 'cover' },
  showcaseStage: {
    width,
    position: 'relative',
    overflow: 'visible',
  },
  showcaseBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  showcasePad: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    alignItems: 'center',
    overflow: 'visible',
  },
  showcasePill: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  showcasePillFire: {
    backgroundColor: 'rgba(38, 13, 6, 0.82)',
    borderColor: 'rgba(255, 176, 46, 0.5)',
  },
  showcasePillPk: {
    backgroundColor: 'rgba(36, 29, 3, 0.84)',
    borderColor: 'rgba(255, 225, 77, 0.55)',
  },
  showcasePillText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: '#FFF7D6',
  },
  galleryPlaceholder: {
    backgroundColor: COLORS.primarySoft,
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
  card: {
    marginTop: 12,
    marginHorizontal: 14,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 15,
    ...SHADOW.card,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  catMeta: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
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
  name: {
    fontSize: 20,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  price: { fontSize: 23, fontFamily: FONTS.extrabold, color: COLORS.primary },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.pill },
  pillText: { fontSize: 11, fontFamily: FONTS.bold },
  capNote: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 4 },
  desc: { fontSize: 13, fontFamily: FONTS.medium, lineHeight: 20, color: COLORS.ink, marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 10,
  },
  statLabel: { fontSize: 11, color: COLORS.muted, fontFamily: FONTS.semibold },
  statVal: { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.ink, marginTop: 2 },
  storeCardPremiumWrap: {
    marginTop: 12,
    marginHorizontal: 14,
    overflow: 'visible',
  },
  storeCardInner: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeCard: {
    marginTop: 12,
    marginHorizontal: 14,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...SHADOW.card,
  },
  storeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLabel: { fontSize: 11, color: COLORS.muted, fontFamily: FONTS.semibold },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  storeName: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.ink, flexShrink: 1 },
  storeLoc: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted },
  sectionTitle: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.primaryDark, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  stepBtn: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 32, textAlign: 'center', fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  payRow: { flexDirection: 'row', gap: 8 },
  payChip: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1.2,
    borderColor: COLORS.line,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  payChipText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.muted },
  payChipTextActive: { color: COLORS.primary },
  notesInput: {
    minHeight: 68,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 10,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
  reportWrap: { paddingHorizontal: 14, marginTop: 16, alignItems: 'center' },
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
  relatedSection: { marginTop: 22, paddingHorizontal: 14 },
  relatedTitle: {
    fontSize: 17,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  relatedSub: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2, marginBottom: 12 },
  relatedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, overflow: 'visible', paddingTop: 6 },
  relatedItem: { width: '48%', overflow: 'visible' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    ...SHADOW.floating,
  },
  totalLabel: { fontSize: 11, color: COLORS.muted, fontFamily: FONTS.semibold },
  totalVal: { fontSize: 18, fontFamily: FONTS.extrabold, color: COLORS.primary },
  reserveBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveBtnText: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.primaryDark },
});
