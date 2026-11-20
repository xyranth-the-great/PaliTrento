import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADIUS } from '../../lib/theme';
import { GOLD_CHROME } from './showcaseConfig';
import { LiquidGoldSurface } from './LiquidGoldChrome';

const SPARK_VECTORS: readonly [number, number, number, number][] = [
  [-74, -56, 13, 0],
  [76, -50, 11, 60],
  [-88, 6, 10, 110],
  [90, 10, 14, 40],
  [-66, 66, 12, 140],
  [72, 62, 11, 90],
  [-18, -86, 12, 70],
  [24, -82, 10, 130],
  [-48, -78, 9, 170],
  [54, -74, 13, 20],
  [-34, 78, 9, 150],
  [40, 74, 12, 100],
];

interface WelcomePremiumCelebrationProps {
  visible: boolean;
  perks: string[];
  renewalDateText?: string | null;
  onAddProduct: () => void;
  onClose: () => void;
}

/**
 * Mirrors the website's `.premium-splash-card` celebration (`css/styles.css:2208-2402`):
 * - Molten liquid-gold chrome backdrop
 * - Popping golden emblem with expanding halo ring (`splash-ring`)
 * - 12 bursting 4-point golden star sparks (`splash-spark`)
 * - Staggered benefit list entrance
 */
export function WelcomePremiumCelebration({
  visible,
  perks,
  renewalDateText,
  onAddProduct,
  onClose,
}: WelcomePremiumCelebrationProps) {
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const emblemScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const sparksProg = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!visible) return;
    cardScale.setValue(0.9);
    cardOpacity.setValue(0);
    emblemScale.setValue(0);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0.85);
    sparksProg.setValue(0);
    listOpacity.setValue(0);
    listY.setValue(10);

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 7,
          tension: 75,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(emblemScale, {
          toValue: 1,
          friction: 5,
          tension: 95,
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 2.25,
          duration: 950,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 950,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sparksProg, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.parallel([
            Animated.timing(listOpacity, {
              toValue: 1,
              duration: 340,
              useNativeDriver: true,
            }),
            Animated.timing(listY, {
              toValue: 0,
              duration: 340,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [
    cardOpacity,
    cardScale,
    emblemScale,
    listOpacity,
    listY,
    ringOpacity,
    ringScale,
    sparksProg,
    visible,
  ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <Animated.View
          style={{
            width: '100%',
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          }}
        >
          <LiquidGoldSurface
            borderRadius={24}
            showShine
            contentStyle={styles.cardContent}
          >
            {/* Emblem + Ripple Ring + Bursting 4-Point Sparks */}
            <View style={styles.emblemWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ring,
                  { opacity: ringOpacity, transform: [{ scale: ringScale }] },
                ]}
              />

              {SPARK_VECTORS.map(([dx, dy, size], idx) => {
                const tx = sparksProg.interpolate({
                  inputRange: [0, 0.65, 1],
                  outputRange: [0, dx, dx * 1.06],
                });
                const ty = sparksProg.interpolate({
                  inputRange: [0, 0.65, 1],
                  outputRange: [0, dy, dy * 1.06],
                });
                const sc = sparksProg.interpolate({
                  inputRange: [0, 0.2, 0.65, 1],
                  outputRange: [0, 1.1, 1, 0.5],
                });
                const op = sparksProg.interpolate({
                  inputRange: [0, 0.12, 0.72, 1],
                  outputRange: [0, 1, 0.9, 0],
                });
                return (
                  <Animated.View
                    key={idx}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      opacity: op,
                      transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
                    }}
                  >
                    <Svg width={size} height={size} viewBox="0 0 24 24">
                      <Polygon
                        points="12,0 15,9 24,12 15,15 12,24 9,15 0,12 9,9"
                        fill={idx % 2 === 0 ? '#FFF4DC' : '#FFD45C'}
                      />
                    </Svg>
                  </Animated.View>
                );
              })}

              <Animated.View
                style={[styles.emblemCircle, { transform: [{ scale: emblemScale }] }]}
              >
                <Ionicons name="sparkles" size={32} color="#FFF4DC" />
              </Animated.View>
            </View>

            <View style={styles.headingGlass}>
              <Text style={styles.title}>Welcome to Premium!</Text>
              <Text style={styles.subtitle}>
                Your store is now highlighted with Liquid Gold Chrome across PaliTrento.
              </Text>
            </View>

            <Animated.View
              style={[
                styles.benefitsGlass,
                { opacity: listOpacity, transform: [{ translateY: listY }] },
              ]}
            >
              {perks.map((perk) => (
                <View key={perk} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={17} color="#FFE3A5" />
                  <Text style={styles.benefitText}>{perk}</Text>
                </View>
              ))}
            </Animated.View>

            {renewalDateText ? (
              <View style={styles.renewalPill}>
                <Text style={styles.renewalText}>Active through {renewalDateText}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onAddProduct}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#2C2216" />
                <Text style={styles.primaryBtnText}>Add a product</Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.secondaryBtnText}>Continue</Text>
              </Pressable>
            </View>
          </LiquidGoldSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    position: 'relative',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 10, 0, 0.64)',
  },
  cardContent: {
    padding: 22,
    alignItems: 'center',
    gap: 14,
  },
  emblemWrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255, 227, 165, 0.85)',
  },
  emblemCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(58, 32, 0, 0.45)',
    borderWidth: 1.5,
    borderColor: GOLD_CHROME.edgeGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingGlass: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: GOLD_CHROME.glass,
    borderWidth: 1,
    borderColor: GOLD_CHROME.glassBorder,
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.extrabold,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: GOLD_CHROME.textShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: 'rgba(255, 248, 230, 0.92)',
    textAlign: 'center',
    lineHeight: 18,
  },
  benefitsGlass: {
    width: '100%',
    padding: 13,
    borderRadius: 14,
    backgroundColor: GOLD_CHROME.glass,
    borderWidth: 1,
    borderColor: GOLD_CHROME.glassBorder,
    gap: 9,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  benefitText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: FONTS.semibold,
    color: '#FFFFFF',
    lineHeight: 17,
    textShadowColor: GOLD_CHROME.textShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  renewalPill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: GOLD_CHROME.glass,
    borderWidth: 1,
    borderColor: GOLD_CHROME.glassBorder,
  },
  renewalText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: '#FFF4DC',
  },
  actions: {
    width: '100%',
    gap: 9,
    marginTop: 2,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#FFF4DC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontFamily: FONTS.extrabold,
    color: '#2C2216',
  },
  secondaryBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    backgroundColor: 'rgba(30, 14, 0, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
});
