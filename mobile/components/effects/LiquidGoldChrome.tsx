import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADIUS } from '../../lib/theme';
import { GOLD_CHROME } from './showcaseConfig';

interface LiquidGoldSurfaceProps {
  children: React.ReactNode;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  showShine?: boolean;
}

/**
 * Animated molten liquid-gold chrome surface recreating the website's WebGL
 * liquid-chrome shader (`js/liquid-chrome.js`) at 60fps using native-driver transforms.
 */
export function LiquidGoldSurface({
  children,
  borderRadius = RADIUS.xl,
  style,
  contentStyle,
  showShine = false,
}: LiquidGoldSurfaceProps) {
  const waveA = useRef(new Animated.Value(0)).current;
  const waveB = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(waveA, {
          toValue: 1,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveA, {
          toValue: 0,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(waveB, {
          toValue: 1,
          duration: 6400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveB, {
          toValue: 0,
          duration: 6400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loopA.start();
    loopB.start();

    let loopShine: Animated.CompositeAnimation | null = null;
    if (showShine) {
      loopShine = Animated.loop(
        Animated.sequence([
          Animated.timing(shineAnim, {
            toValue: 1,
            duration: 1850,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(3150),
          Animated.timing(shineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      loopShine.start();
    }

    return () => {
      loopA.stop();
      loopB.stop();
      loopShine?.stop();
    };
  }, [shineAnim, showShine, waveA, waveB]);

  const txA = waveA.interpolate({ inputRange: [0, 1], outputRange: [-42, 42] });
  const tyA = waveA.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const txB = waveB.interpolate({ inputRange: [0, 1], outputRange: [38, -38] });
  const tyB = waveB.interpolate({ inputRange: [0, 1], outputRange: [16, -16] });
  const shineX = shineAnim.interpolate({ inputRange: [0, 1], outputRange: [-140, 420] });

  return (
    <View style={[styles.surfaceOuter, { borderRadius }, style]}>
      <View style={[styles.surfaceClip, { borderRadius }]}>
        {/* Base molten gold backdrop */}
        <LinearGradient
          colors={[
            GOLD_CHROME.deepBronze,
            GOLD_CHROME.antiqueGold,
            GOLD_CHROME.metallicGold,
            GOLD_CHROME.brightGold,
            GOLD_CHROME.pillBase,
          ]}
          locations={[0, 0.24, 0.52, 0.78, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.absFill}
        />

        {/* Molten wave layer 1 */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.waveLayer,
            { transform: [{ translateX: txA }, { translateY: tyA }, { rotate: '-14deg' }] },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255, 212, 92, 0)',
              'rgba(255, 212, 92, 0.55)',
              'rgba(255, 248, 224, 0.48)',
              'rgba(184, 134, 11, 0.42)',
              'rgba(58, 32, 0, 0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.7 }}
            style={styles.absFill}
          />
        </Animated.View>

        {/* Counter-flowing specular liquid chrome wave 2 */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.waveLayer,
            { transform: [{ translateX: txB }, { translateY: tyB }, { rotate: '18deg' }] },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(58, 32, 0, 0)',
              'rgba(58, 32, 0, 0.36)',
              'rgba(242, 201, 76, 0.52)',
              'rgba(255, 250, 232, 0.56)',
              'rgba(58, 32, 0, 0)',
            ]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.9 }}
            style={styles.absFill}
          />
        </Animated.View>

        {/* Top glass specular highlight */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 255, 255, 0.30)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.55 }}
          style={styles.absFill}
        />

        {/* Optional periodic diagonal specular shine beam */}
        {showShine && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shineBeam,
              { transform: [{ translateX: shineX }, { skewX: '-18deg' }] },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0)',
                'rgba(255, 255, 255, 0.58)',
                'rgba(255, 255, 255, 0)',
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.absFill}
            />
          </Animated.View>
        )}

        <View style={[styles.surfaceContent, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

interface PremiumGoldFrameProps {
  children: React.ReactNode;
  borderRadius?: number;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  glowIntensity?: 'soft' | 'normal';
}

/**
 * Animated molten-gold border frame (`.premium-frame`) for Premium StoreCard & ProductCard.
 * Features a continuously spinning molten liquid-gold border ring, pulsing golden outer halo,
 * and an inset rounded white card container.
 */
export function PremiumGoldFrame({
  children,
  borderRadius = RADIUS.lg,
  borderWidth = 3,
  style,
  innerStyle,
  glowIntensity = 'normal',
}: PremiumGoldFrameProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState({ w: 240, h: 240 });

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 5400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    spinLoop.start();
    glowLoop.start();
    return () => {
      spinLoop.stop();
      glowLoop.stop();
    };
  }, [glow, spin]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (
      width > 0 &&
      height > 0 &&
      width < 1200 &&
      height < 1200 &&
      (Math.abs(width - box.w) > 4 || Math.abs(height - box.h) > 4)
    ) {
      setBox({ w: width, h: height });
    }
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: glowIntensity === 'soft' ? [0.24, 0.48] : [0.34, 0.64],
  });

  const diag = Math.min(1100, Math.ceil(Math.hypot(box.w, box.h) * 1.18));
  const innerRadius = Math.max(4, borderRadius - borderWidth);

  return (
    <View style={[styles.frameWrap, style]}>
      {/* Layered golden outer halo (renders visibly on both Android & iOS) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.goldHaloOuter,
          { borderRadius: borderRadius + 5, opacity: glowOpacity },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.goldHaloInner,
          { borderRadius: borderRadius + 2, opacity: glowOpacity },
        ]}
      />

      {/* Clipped rotating liquid-gold border frame */}
      <View onLayout={onLayout} style={[styles.frameClip, { borderRadius, padding: borderWidth }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: diag,
              height: diag,
              left: (box.w - diag) / 2,
              top: (box.h - diag) / 2,
              transform: [{ rotate }],
            },
          ]}
        >
          <LinearGradient
            colors={[
              '#4A2A02',
              '#B8860B',
              '#FFD45C',
              '#FFF7D6',
              '#D49415',
              '#754906',
              '#F2C94C',
              '#4A2A02',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.absFill}
          />
        </Animated.View>

        {/* Subtle metallic top specular rim */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 255, 255, 0.50)', 'rgba(255, 255, 255, 0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.28 }}
          style={styles.absFill}
        />

        {/* Inner rounded card surface */}
        <View style={[styles.frameInner, { borderRadius: innerRadius }, innerStyle]}>
          {children}
        </View>
      </View>
    </View>
  );
}

interface PremiumChromePillProps {
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/**
 * Exact `.chrome-pill` metallic gold-chrome badge (`✦ Premium`) with `#F2C94C` rim,
 * top glass reflection, and periodic sheen sweep.
 */
export function PremiumChromePill({
  label = 'Premium',
  size = 'sm',
  style,
}: PremiumChromePillProps) {
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(3400),
        Animated.timing(sheen, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sheen]);

  const tx = sheen.interpolate({ inputRange: [0, 1], outputRange: [-48, 128] });

  const padH = size === 'xs' ? 7 : size === 'md' ? 11 : 9;
  const padV = size === 'xs' ? 2.5 : size === 'md' ? 5 : 3.5;
  const fontSize = size === 'xs' ? 9 : size === 'md' ? 11.5 : 10;
  const iconSize = size === 'xs' ? 9 : size === 'md' ? 12 : 10;

  return (
    <View style={[styles.pillOuter, style]}>
      <LinearGradient
        colors={['#5B3705', '#A8790A', '#E3A728', '#B8860B', '#6B4408']}
        locations={[0, 0.25, 0.52, 0.78, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pillBg, { paddingHorizontal: padH, paddingVertical: padV }]}
      >
        {/* Top glass reflection */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.44)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={styles.absFill}
        />

        {/* Animated diagonal glint */}
        <Animated.View
          pointerEvents="none"
          style={[styles.pillSheen, { transform: [{ translateX: tx }, { skewX: '-22deg' }] }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.68)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.absFill}
          />
        </Animated.View>

        <Ionicons
          name="sparkles"
          size={iconSize}
          color="#FFF7D6"
          style={styles.pillIconShadow}
        />
        <Text style={[styles.pillText, { fontSize }]} allowFontScaling={false}>
          {label}
        </Text>
      </LinearGradient>
    </View>
  );
}

interface PremiumUpgradeButtonProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/**
 * Exact `.free-upgrade-btn` CTA from `css/styles.css:1902-1934`:
 * Liquid gold chrome surface + pulsing golden glow + periodic sweeping shine!
 */
export function PremiumUpgradeButton({
  title,
  onPress,
  style,
  disabled,
}: PremiumUpgradeButtonProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.upgradeWrap,
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 },
        disabled && { opacity: 0.55 },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.upgradeHalo, { opacity: glowOpacity }]}
      />
      <LiquidGoldSurface
        borderRadius={RADIUS.md}
        showShine
        contentStyle={styles.upgradeContent}
      >
        <Ionicons name="sparkles" size={16} color="#FFF7D6" />
        <Text style={styles.upgradeText}>{title}</Text>
      </LiquidGoldSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  absFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  surfaceOuter: {
    borderWidth: 1,
    borderColor: GOLD_CHROME.edgeGold,
    shadowColor: '#D99B16',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.36,
    shadowRadius: 14,
    elevation: 6,
    backgroundColor: GOLD_CHROME.pillBase,
  },
  surfaceClip: {
    overflow: 'hidden',
    position: 'relative',
  },
  waveLayer: {
    position: 'absolute',
    top: '-45%',
    left: '-45%',
    right: '-45%',
    bottom: '-45%',
  },
  shineBeam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 90,
  },
  surfaceContent: {
    position: 'relative',
    zIndex: 2,
  },
  frameWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  goldHaloOuter: {
    position: 'absolute',
    top: -5,
    right: -5,
    bottom: -5,
    left: -5,
    backgroundColor: 'rgba(242, 201, 76, 0.24)',
  },
  goldHaloInner: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    backgroundColor: 'rgba(255, 204, 68, 0.36)',
  },
  frameClip: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: GOLD_CHROME.metallicGold,
    shadowColor: '#E3A728',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 5,
  },
  frameInner: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    zIndex: 2,
  },
  pillOuter: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: GOLD_CHROME.edgeGold,
    overflow: 'hidden',
    shadowColor: '#F2C94C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
    alignSelf: 'flex-start',
  },
  pillBg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  pillSheen: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: 0,
    width: 28,
  },
  pillIconShadow: {
    zIndex: 2,
  },
  pillText: {
    zIndex: 2,
    fontFamily: FONTS.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.45,
    includeFontPadding: false,
    textShadowColor: GOLD_CHROME.textShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  upgradeWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  upgradeHalo: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: RADIUS.md + 4,
    backgroundColor: 'rgba(255, 200, 110, 0.38)',
  },
  upgradeContent: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  upgradeText: {
    fontSize: 14.5,
    fontFamily: FONTS.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.15,
    textShadowColor: GOLD_CHROME.textShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
