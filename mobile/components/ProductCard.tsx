import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSrpStatus, peso, UNITS } from '../lib/constants';
import { getProductImages, Product, Store } from '../lib/data';
import { COLORS, FONTS, RADIUS } from '../lib/theme';
import {
  FirePriceUnderline,
  FireShowcaseFrame,
  getProductShowcaseTheme,
  PikachuPriceUnderline,
  PikachuShowcaseFrame,
} from './effects';
import {
  PREMIUM_GEOMETRY,
  PremiumCardRing,
} from './premium';

interface ProductCardProps {
  product: Product;
  store?: Store;
  onPress: () => void;
}

function ProductCardBase({ product, store, onPress }: ProductCardProps) {
  const images = getProductImages(product);
  const srp = getSrpStatus(product);
  const unit = UNITS[product.unit] || product.unit || 'pc';
  const isPremium = Boolean(store?.is_premium || product.is_premium_store);
  const showcase = getProductShowcaseTheme(product);

  const cardInner = (
    <>
      <View style={styles.media}>
        {images[0] ? (
          <Image source={{ uri: images[0] }} style={styles.img} fadeDuration={0} />
        ) : (
          <View style={[styles.img, styles.placeholder]}>
            <Ionicons name="bag-handle-outline" size={26} color={COLORS.primary} />
          </View>
        )}
        {srp && (
          <View style={[styles.srpBadge, srp.ok ? styles.srpOk : styles.srpBad]}>
            <Text style={[styles.srpText, srp.ok ? styles.srpOkText : styles.srpBadText]}>
              {srp.text}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceWrap}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{peso(product.current_price)}</Text>
            <Text style={styles.unit}>/{unit}</Text>
          </View>
          {showcase === 'fire' && <FirePriceUnderline height={3} style={styles.priceFx} />}
          {showcase === 'pikachu' && <PikachuPriceUnderline style={styles.priceFx} />}
        </View>
        {store && (
          <View style={styles.storeRow}>
            <Ionicons name="storefront-outline" size={11} color={COLORS.muted} />
            <Text style={styles.store} numberOfLines={1}>
              {store.business_name}
            </Text>
          </View>
        )}
      </View>
    </>
  );

  // Showcase priority matches website (`js/ui.js`): Fire & Pikachu override the Premium gold frame
  if (showcase === 'fire') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.showcasePressable, pressed && styles.pressed]}
      >
        <FireShowcaseFrame variant="card" borderRadius={RADIUS.lg} style={styles.flexFill}>
          {cardInner}
        </FireShowcaseFrame>
      </Pressable>
    );
  }

  if (showcase === 'pikachu') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.showcasePressable, pressed && styles.pressed]}
      >
        <PikachuShowcaseFrame variant="card" borderRadius={RADIUS.lg} style={styles.flexFill}>
          {cardInner}
        </PikachuShowcaseFrame>
      </Pressable>
    );
  }

  if (isPremium) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.showcasePressable, pressed && styles.pressed]}
      >
        {({ pressed }) => <PremiumCardRing style={styles.flexFill} pressed={pressed}>{cardInner}</PremiumCardRing>}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {cardInner}
    </Pressable>
  );
}

export const ProductCard = React.memo(
  ProductCardBase,
  (prev, next) => prev.product === next.product && prev.store === next.store
);

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  showcasePressable: {
    flex: 1,
    overflow: 'visible',
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: PREMIUM_GEOMETRY.freeCardRadius,
    borderWidth: PREMIUM_GEOMETRY.freeCardBorderWidth,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  media: {
    width: '100%',
    aspectRatio: 1.05,
    position: 'relative',
    backgroundColor: COLORS.mutedBg,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  srpBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    zIndex: 6,
  },
  srpOk: { backgroundColor: 'rgba(231, 248, 238, 0.95)' },
  srpBad: { backgroundColor: 'rgba(254, 226, 226, 0.95)' },
  srpText: { fontSize: 9.5, fontFamily: FONTS.bold },
  srpOkText: { color: COLORS.ok },
  srpBadText: { color: COLORS.bad },
  body: {
    padding: 10,
    gap: 4,
  },
  name: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
    lineHeight: 17,
    minHeight: 34,
  },
  priceWrap: {
    alignSelf: 'flex-start',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceFx: {
    marginTop: 2,
  },
  price: {
    fontSize: 15.5,
    fontFamily: FONTS.extrabold,
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  unit: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  store: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    flex: 1,
  },
});
