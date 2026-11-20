import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CATS, isStoreOpen } from '../lib/constants';
import { Store } from '../lib/data';
import { COLORS, FONTS, RADIUS } from '../lib/theme';
import { PREMIUM_GEOMETRY, PremiumCardChip, PremiumCardRing } from './premium';

interface StoreCardProps {
  store: Store;
  variant?: 'carousel' | 'row';
  onPress: () => void;
}

export function StoreCard({ store, variant = 'carousel', onPress }: StoreCardProps) {
  const open = isStoreOpen(store);
  const categoryLabel = CATS[store.trade_category] || store.trade_category;
  const purok =
    store.purok && /^\d+$/.test(store.purok.trim()) ? `Purok ${store.purok.trim()}` : store.purok;
  const location = [store.barangay, purok].filter(Boolean).join(', ');
  const isPremium = Boolean(store.is_premium);

  if (variant === 'row') {
    const rowContent = (
      <View style={styles.rowInner}>
        <View style={styles.rowImgWrap}>
          {store.storefront_image_url ? (
            <Image source={{ uri: store.storefront_image_url }} style={styles.rowImg} />
          ) : (
            <LinearGradient
              colors={['#EAF3ED', '#D7E8DD']}
              style={[styles.rowImg, styles.imgPlaceholder]}
            >
              <Ionicons name="storefront-outline" size={24} color={COLORS.primary} />
            </LinearGradient>
          )}
          {isPremium && (
            <View style={styles.rowPremiumDot}>
              <Ionicons name="sparkles" size={10} color="#FFF4DC" />
            </View>
          )}
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {store.business_name}
            </Text>
            <View style={[styles.statusChip, open ? styles.statusOpen : styles.statusClosed]}>
              <View style={[styles.statusDot, { backgroundColor: open ? '#16A34A' : '#94A3B8' }]} />
              <Text style={[styles.statusText, open ? styles.statusOpenText : styles.statusClosedText]}>
                {open ? 'Open' : 'Closed'}
              </Text>
            </View>
          </View>

          <Text style={styles.meta} numberOfLines={1}>
            {categoryLabel} • {location || 'Trento'}
          </Text>

          <View style={styles.badgeRow}>
            {isPremium && <PremiumCardChip />}
            {store.srp_compliant && (
              <View style={styles.tagSoftOk}>
                <Ionicons name="shield-checkmark" size={10} color={COLORS.ok} />
                <Text style={styles.tagSoftOkText}>Price-cap verified</Text>
              </View>
            )}
            {store.dti_registered && (
              <View style={styles.tagSoftNeutral}>
                <Text style={styles.tagSoftNeutralText}>DTI</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );

    if (isPremium) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.rowPremiumWrap, pressed && styles.pressed]}
        >
          {({ pressed }) => <PremiumCardRing pressed={pressed}>{rowContent}</PremiumCardRing>}
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
      >
        {rowContent}
      </Pressable>
    );
  }

  const carouselInner = (
    <>
      <View style={styles.carouselMedia}>
        {store.storefront_image_url ? (
          <Image source={{ uri: store.storefront_image_url }} style={styles.carouselImg} />
        ) : (
          <LinearGradient
            colors={['#1E4D31', '#143520']}
            style={[styles.carouselImg, styles.imgPlaceholder]}
          >
            <Ionicons name="storefront-outline" size={32} color="rgba(255,255,255,0.45)" />
          </LinearGradient>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.02)', 'rgba(12,28,18,0.58)']}
          style={styles.scrim}
        />

        {/* Top badges */}
        <View style={styles.mediaTopRow}>
          {isPremium ? <PremiumCardChip /> : <View />}

          <View style={styles.statusGlass}>
            <View style={[styles.statusDot, { backgroundColor: open ? '#4ADE80' : '#CBD5E1' }]} />
            <Text style={styles.statusGlassText}>{open ? 'Open' : 'Closed'}</Text>
          </View>
        </View>

        {/* Category pill over bottom-left of image */}
        <View style={styles.catOverlay}>
          <Text style={styles.catOverlayText}>{categoryLabel}</Text>
        </View>
      </View>

      <View style={styles.carouselBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {store.business_name}
        </Text>
        <View style={styles.locRow}>
          <Ionicons name="location" size={12} color={COLORS.amber} />
          <Text style={styles.locText} numberOfLines={1}>
            {location || 'Trento, Agusan del Sur'}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={COLORS.muted} />
        </View>
      </View>
    </>
  );

  if (isPremium) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.carouselPremiumWrap, pressed && styles.pressed]}
      >
        {({ pressed }) => <PremiumCardRing pressed={pressed}>{carouselInner}</PremiumCardRing>}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.carouselCard, pressed && styles.pressed]}
    >
      {carouselInner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  carouselPremiumWrap: {
    width: 232,
    overflow: 'visible',
  },
  carouselCard: {
    width: 232,
    backgroundColor: COLORS.card,
    borderRadius: PREMIUM_GEOMETRY.freeCardRadius,
    borderWidth: PREMIUM_GEOMETRY.freeCardBorderWidth,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  carouselMedia: {
    width: '100%',
    height: 132,
    position: 'relative',
  },
  carouselImg: {
    width: '100%',
    height: '100%',
  },
  imgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 68,
  },
  mediaTopRow: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(17, 29, 21, 0.65)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusGlassText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  catOverlay: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  catOverlayText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.primaryDark,
  },
  carouselBody: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
  },
  cardTitle: {
    fontSize: 14.5,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locText: {
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    flex: 1,
  },

  // Row variant
  rowPremiumWrap: {
    overflow: 'visible',
  },
  rowCard: {
    backgroundColor: COLORS.card,
    borderRadius: PREMIUM_GEOMETRY.freeCardRadius,
    borderWidth: PREMIUM_GEOMETRY.freeCardBorderWidth,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  rowInner: {
    flexDirection: 'row',
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  rowImgWrap: {
    position: 'relative',
  },
  rowImg: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.md,
  },
  rowPremiumDot: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: '#8A5A0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F2C94C',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  statusOpen: {
    backgroundColor: COLORS.okBg,
  },
  statusClosed: {
    backgroundColor: COLORS.mutedBg,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  statusOpenText: {
    color: COLORS.ok,
  },
  statusClosedText: {
    color: COLORS.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  tagSoftOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.okBg,
  },
  tagSoftOkText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.ok,
  },
  tagSoftNeutral: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.mutedBg,
  },
  tagSoftNeutralText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.inkSecondary,
  },
});
