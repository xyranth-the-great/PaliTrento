import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { peso } from '../../lib/constants';
import { Store } from '../../lib/data';
import {
  activatePremiumSubscription,
  createFeaturedStorePromo,
  FREE_LISTING_QUOTA,
  freeListingsUsed,
  getSubscriptionData,
  isPremiumActive,
  LockedProductRecord,
  unlockLockedProducts,
} from '../../lib/seller';
import { DemoPaymentConfig } from '../DemoPaymentModal';
import { Button, Card, SectionLabel, StatusPill } from '../ui';
import { WelcomePremiumCelebration } from '../effects';
import {
  PREMIUM_COPY,
  PREMIUM_LIMITS,
  PremiumChromeButton,
  PremiumMembershipBanner,
  PremiumUpgradeSheet,
  ProSheet,
} from '../premium';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

const LOCK_REASONS: Record<string, string> = {
  GRACE_PERIOD: 'Grace Period',
  SUBSCRIPTION_EXPIRED: 'Subscription Expired',
  UNPAID_LISTING: 'Unpaid Listing',
};

let premiumSplashShownForPayment = false;

interface SubscriptionTabProps {
  userId: string;
  store: Store & Record<string, any>;
  sub: any;
  productCount: number;
  lockedProducts: LockedProductRecord[];
  onRefresh: () => Promise<void>;
  onStartPayment: (cfg: DemoPaymentConfig) => void;
  onAddProduct: () => void;
}

export function SubscriptionTab({
  userId,
  store,
  sub,
  productCount,
  lockedProducts,
  onRefresh,
  onStartPayment,
  onAddProduct,
}: SubscriptionTabProps) {
  const { profile, refreshProfile } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showFeaturedModal, setShowFeaturedModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showProSheet, setShowProSheet] = useState(false);
  const [selectedLocked, setSelectedLocked] = useState<Set<string>>(() => new Set());

  const subscription = sub?.subscription || null;
  const planDetails = sub?.plan_details || {
    code: 'FREE',
    name: 'Free Plan',
    free_listing_quota: FREE_LISTING_QUOTA,
    featured_promo_price_cents: 1000,
  };
  const entitlement = sub?.entitlement || {
    free_listings_used: 0,
    paid_listings_count: 0,
    total_listings_allowed: FREE_LISTING_QUOTA,
    remaining_free: FREE_LISTING_QUOTA,
  };
  const locksSummary = sub?.locks || {
    total_locked: lockedProducts.length,
    grace_period_locked: 0,
    subscription_expired_locked: 0,
  };
  const featuredPromos: any[] = Array.isArray(sub?.featured_promotions)
    ? sub.featured_promotions
    : [];

  const premium = isPremiumActive(sub);
  const status = subscription?.status || 'FREE';
  const isGrace = status === 'PAST_DUE';
  const isExpired = status === 'EXPIRED' || status === 'CANCELLED';

  const quota =
    Number.isFinite(Number(planDetails.free_listing_quota)) && Number(planDetails.free_listing_quota) >= 0
      ? Number(planDetails.free_listing_quota)
      : FREE_LISTING_QUOTA;
  const used = freeListingsUsed(sub, productCount);
  const remainingFree = Math.max(0, quota - Math.min(used, quota));
  const progressPct = quota > 0 ? Math.min(100, (Math.min(used, quota) / quota) * 100) : 0;

  const storeHasActivePromo = useMemo(
    () =>
      featuredPromos.some(
        (p) => p.store_id === store.id && Date.parse(p.expires_at) > Date.now()
      ),
    [featuredPromos, store.id]
  );

  const renewalDateText = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const graceDaysLeft = subscription?.grace_period_ends_at
    ? Math.max(0, Math.ceil((Date.parse(subscription.grace_period_ends_at) - Date.now()) / 86400_000))
    : 0;

  const startUpgradePayment = () => {
    premiumSplashShownForPayment = false;
    const wasPremium = premium;
    const paymentRef = `demo-premium-${Date.now()}`;
    setShowUpgradeModal(false);
    onStartPayment({
      amount: 49,
      title: isGrace || isExpired ? 'Renew Premium Plan' : 'Upgrade to Premium',
      description:
        'Activate Premium subscription for ₱49/month. Unlimited listings, Premium badge, priority search, and automatic Featured Store eligibility.',
      successMessage: 'Premium subscription is now active!',
      onPay: async () => {
        await activatePremiumSubscription(userId, paymentRef);
      },
      onDone: async () => {
        await onRefresh();
        await refreshProfile().catch(() => {});
        if (!wasPremium) {
          try {
            const freshSub = await getSubscriptionData(userId);
            if (isPremiumActive(freshSub)) {
              const splashKey = String(
                freshSub?.subscription?.current_period_end || paymentRef
              );
              const lastShown = await AsyncStorage.getItem('premium-splash-shown');
              if (lastShown !== splashKey && !premiumSplashShownForPayment) {
                await AsyncStorage.setItem('premium-splash-shown', splashKey);
                premiumSplashShownForPayment = true;
                setShowWelcomeModal(true);
              }
            }
          } catch {
            // Do not show splash if server confirmation fails
          }
        }
      },
    });
  };

  const startFeaturedPayment = () => {
    if (premium || storeHasActivePromo) return;
    setShowFeaturedModal(false);
    onStartPayment({
      amount: 10,
      title: 'Feature Store Promotion',
      description: `Feature "${store.business_name}" in the Featured Stores rail for 7 days.`,
      successMessage: `${store.business_name} is now featured for 7 days!`,
      onPay: async () => {
        await createFeaturedStorePromo(userId, store.id, `demo-featured-${Date.now()}`);
      },
      onDone: async () => {
        await onRefresh();
      },
    });
  };

  const toggleLocked = (productId: string) => {
    setSelectedLocked((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const startBulkUnlock = () => {
    const ids = [...selectedLocked];
    if (ids.length === 0) return;
    onStartPayment({
      amount: ids.length,
      title: 'Unlock Locked Products',
      description: `Unlock ${ids.length} hidden product${ids.length === 1 ? '' : 's'} for ${peso(ids.length)} (₱1 each).`,
      successMessage: `${ids.length} product${ids.length === 1 ? '' : 's'} unlocked and restored to the marketplace!`,
      onPay: async () => {
        await unlockLockedProducts(userId, ids, `demo-bulk-${Date.now()}`);
      },
      onDone: async () => {
        setSelectedLocked(new Set());
        await onRefresh();
      },
    });
  };

  const showLockedCard =
    lockedProducts.length > 0 || (locksSummary.total_locked || 0) > 0 || isGrace || isExpired;

  return (
    <View style={{ gap: 12 }}>
      {/* Plan Status Card */}
      {premium ? (
        <PremiumMembershipBanner
          currentPeriodEnd={profile?.premium_details?.current_period_end ?? null}
          onManage={() => setShowProSheet(true)}
        />
      ) : isGrace ? (
        <Card style={[styles.statusCard, { borderColor: 'rgba(180,83,9,0.35)' }]}>
          <View style={styles.planHeadRow}>
            <Text style={styles.planTitle}>Premium Plan (Grace Period)</Text>
            <StatusPill label="Grace Period" tone="warn" />
          </View>
          <Text style={styles.planDesc}>
            Your subscription expired. Renew within {graceDaysLeft} day{graceDaysLeft === 1 ? '' : 's'} to keep all listings live without interruption.
          </Text>
          <PremiumChromeButton title={PREMIUM_COPY.renewCta} onPress={startUpgradePayment} />
        </Card>
      ) : isExpired ? (
        <Card style={[styles.statusCard, { borderColor: 'rgba(220,38,38,0.35)' }]}>
          <View style={styles.planHeadRow}>
            <Text style={styles.planTitle}>Premium Plan (Expired)</Text>
            <StatusPill label="Expired" tone="bad" />
          </View>
          <Text style={styles.planDesc}>
            Your first 15 listings remain active. Additional products are locked until unlocked (₱1 each) or Premium is renewed.
          </Text>
          <PremiumChromeButton title={PREMIUM_COPY.renewCta} onPress={startUpgradePayment} />
        </Card>
      ) : (
        <Card style={styles.statusCard}>
          <View style={styles.planHeadRow}>
            <Text style={styles.planTitle}>{PREMIUM_COPY.freePlanTitle}</Text>
            <StatusPill label={PREMIUM_COPY.freePill} tone="ok" />
          </View>
          <Text style={styles.planDesc}>{PREMIUM_COPY.freeSubtitle}</Text>
          <View style={styles.quotaHeader}>
            <Text style={styles.quotaLabel}>Free listings used</Text>
            <Text style={styles.quotaNum}>
              {Math.min(used, quota)} / {quota}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor:
                    used >= quota
                      ? COLORS.bad
                      : progressPct >= PREMIUM_LIMITS.nearLimitRatio * 100
                        ? COLORS.warn
                        : COLORS.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.quotaHint}>
            {remainingFree > 0
              ? `${remainingFree} free listing${remainingFree === 1 ? '' : 's'} remaining.`
              : 'All 15 free listings used. Extra listings are ₱1 each.'}
          </Text>
          <PremiumChromeButton
            title={PREMIUM_COPY.upgradeCta}
            onPress={() => setShowUpgradeModal(true)}
          />
        </Card>
      )}

      {/* Listing Entitlement Breakdown */}
      <Card>
        <Text style={styles.cardHeading}>Listing Allowance</Text>
        <View style={styles.entGrid}>
          <EntTile
            label="Total allowed"
            value={premium || planDetails.free_listing_quota === -1 ? '∞' : String(entitlement.total_listings_allowed ?? quota)}
          />
          <EntTile label="Free used" value={String(used)} />
          <EntTile label="Paid listings" value={String(entitlement.paid_listings_count ?? 0)} />
          <EntTile
            label="Remaining free"
            value={premium || entitlement.remaining_free === 999999 ? '∞' : String(remainingFree)}
          />
        </View>
      </Card>

      {/* Featured Store Promotions Card */}
      <Card style={{ gap: 10 }}>
        <View style={styles.planHeadRow}>
          <Text style={styles.cardHeading}>{PREMIUM_COPY.featureStoreTitle}</Text>
          {!premium && storeHasActivePromo ? <StatusPill label="Featured" tone="ok" /> : null}
        </View>

        {premium ? (
          <View style={styles.includedBox}>
            <Text style={styles.includedText}>{PREMIUM_COPY.includedWithPremium}</Text>
          </View>
        ) : (
          <>
            {featuredPromos.length > 0 ? (
              featuredPromos.map((promo, i) => (
                <View key={promo.id || i} style={styles.promoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoName}>{store.business_name}</Text>
                    <Text style={styles.promoExp}>
                      Expires{' '}
                      {new Date(promo.expires_at).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <StatusPill
                    label={promo.price_paid_cents === 0 ? 'Premium Included' : 'Paid Promo'}
                    tone={promo.price_paid_cents === 0 ? 'ok' : 'info'}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.planDesc}>{PREMIUM_COPY.featureStoreCaption}</Text>
            )}

            <Button
              title={
                storeHasActivePromo ? 'Store Currently Featured' : PREMIUM_COPY.featureStoreCta
              }
              icon="star-outline"
              variant={storeHasActivePromo ? 'outline' : 'soft'}
              disabled={storeHasActivePromo}
              small
              onPress={() => setShowFeaturedModal(true)}
            />
          </>
        )}
      </Card>

      {/* Locked Products Card */}
      {showLockedCard && (
        <Card style={{ gap: 10 }}>
          <View style={styles.planHeadRow}>
            <Text style={styles.cardHeading}>Locked Products</Text>
            <StatusPill
              label={`${lockedProducts.length} locked`}
              tone={lockedProducts.length > 0 ? 'warn' : 'ok'}
            />
          </View>

          {lockedProducts.length === 0 ? (
            <Text style={styles.planDesc}>None of your products are currently locked.</Text>
          ) : (
            <>
              <Text style={styles.planDesc}>
                Locked products are hidden from customers. Renew Premium to unlock all, or select items to unlock individually for ₱1 each.
              </Text>

              <View style={styles.selectRow}>
                <Pressable
                  onPress={() => setSelectedLocked(new Set(lockedProducts.map((l) => l.product_id)))}
                  style={styles.selectBtn}
                >
                  <Text style={styles.selectBtnText}>Select all</Text>
                </Pressable>
                {selectedLocked.size > 0 && (
                  <Pressable onPress={() => setSelectedLocked(new Set())} style={styles.selectBtn}>
                    <Text style={styles.selectBtnText}>Clear ({selectedLocked.size})</Text>
                  </Pressable>
                )}
              </View>

              <View style={{ gap: 8 }}>
                {lockedProducts.map((lock) => {
                  const p = lock.products;
                  const checked = selectedLocked.has(lock.product_id);
                  const img = (Array.isArray(p?.image_urls) && p?.image_urls[0]) || p?.image_url;
                  return (
                    <Pressable
                      key={lock.id}
                      onPress={() => toggleLocked(lock.product_id)}
                      style={[styles.lockItem, checked && styles.lockItemActive]}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={checked ? COLORS.primary : COLORS.muted}
                      />
                      {img ? (
                        <Image source={{ uri: img }} style={styles.lockThumb} />
                      ) : (
                        <View style={[styles.lockThumb, styles.lockThumbEmpty]}>
                          <Ionicons name="bag-outline" size={16} color={COLORS.muted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lockName} numberOfLines={1}>
                          {p?.name || 'Product'}
                        </Text>
                        <Text style={styles.lockMeta}>
                          {peso(p?.current_price || 0)} •{' '}
                          {LOCK_REASONS[lock.lock_reason] || lock.lock_reason}
                        </Text>
                      </View>
                      <Text style={styles.lockCost}>₱1</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                title={
                  selectedLocked.size > 0
                    ? `Unlock ${selectedLocked.size} selected (${peso(selectedLocked.size)})`
                    : 'Select products to unlock'
                }
                icon="lock-open-outline"
                disabled={selectedLocked.size === 0}
                onPress={startBulkUnlock}
              />
            </>
          )}
        </Card>
      )}

      {/* Upgrade Perks Modal */}
      <PremiumUpgradeSheet
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={startUpgradePayment}
      />

      {/* Featured Promo Confirm Modal */}
      <Modal
        visible={showFeaturedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeaturedModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.scrim} onPress={() => setShowFeaturedModal(false)} />
          <View style={[styles.modalCard, { padding: 18, gap: 12 }]}>
            <Text style={styles.planTitle}>Feature Your Store?</Text>
            <Text style={styles.planDesc}>
              Spotlight {store.business_name} in the Featured Stores carousel on Home & Explore for 7 days for ₱10.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Cancel" variant="outline" onPress={() => setShowFeaturedModal(false)} style={{ flex: 1 }} />
              <Button title="Continue (₱10)" onPress={startFeaturedPayment} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Welcome to Premium Celebration Modal */}
      <WelcomePremiumCelebration
        visible={showWelcomeModal}
        perks={[...PREMIUM_COPY.benefits]}
        renewalDateText={renewalDateText}
        onAddProduct={() => {
          setShowWelcomeModal(false);
          onAddProduct();
        }}
        onClose={() => setShowWelcomeModal(false)}
      />

      {/* Premium Membership Summary Sheet */}
      <ProSheet visible={showProSheet} onClose={() => setShowProSheet(false)} />
    </View>
  );
}

function EntTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.entTile}>
      <Text style={styles.entVal}>{value}</Text>
      <Text style={styles.entLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  planHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusCard: { gap: 10 },
  planTitle: { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.ink },
  planDesc: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 18 },
  quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quotaLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  quotaNum: { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.primary },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.mutedBg,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  quotaHint: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
  cardHeading: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  entGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  entTile: {
    width: '48.2%',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 11,
    borderWidth: 1,
    borderColor: COLORS.lineSubtle,
  },
  entVal: { fontSize: 19, fontFamily: FONTS.extrabold, color: COLORS.primaryDark },
  entLabel: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.muted, marginTop: 2 },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderLeftWidth: 3.5,
    borderLeftColor: COLORS.primary,
  },
  promoName: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.ink },
  promoExp: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  includedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  includedText: { flex: 1, fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.primaryDark, lineHeight: 17 },
  selectRow: { flexDirection: 'row', gap: 8 },
  selectBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  selectBtnText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.primary },
  lockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  lockItemActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  lockThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.mutedBg },
  lockThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  lockName: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.ink },
  lockMeta: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 1 },
  lockCost: { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.primary },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    position: 'relative',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,29,21,0.6)',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.floating,
  },
  modalHero: { padding: 18, gap: 6 },
  modalHeroTitle: { fontSize: 21, fontFamily: FONTS.extrabold, color: COLORS.white },
  modalHeroPrice: { fontSize: 15, fontFamily: FONTS.bold, color: '#FBC14E' },
  welcomeCard: {
    borderRadius: RADIUS.xl,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    ...SHADOW.floating,
  },
  welcomeEmblem: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(251,193,78,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(251,193,78,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.white, textAlign: 'center' },
  welcomeSub: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 19,
  },
});
