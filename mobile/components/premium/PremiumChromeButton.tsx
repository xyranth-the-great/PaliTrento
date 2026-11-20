import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../../lib/theme';
import { PremiumChrome } from './PremiumChrome';
import { PremiumGlassPanel } from './PremiumGlassPanel';
import {
  PREMIUM_LIQUID,
  PREMIUM_MOTION,
  PREMIUM_PALETTE,
  PREMIUM_TOKENS,
} from './tokens';

export interface PremiumChromeButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Liquid Chrome upgrade CTA button with self-measuring fill chrome,
 * frosted glass label (radius 10, paddingHorizontal 16), soft pulse,
 * and diagonal shine sweep.
 */
export function PremiumChromeButton({
  title,
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
}: PremiumChromeButtonProps) {
  const [btnWidth, setBtnWidth] = useState(0);
  const [motionPaused, setMotionPaused] = useState(true);

  const pulse = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    const updateMotion = async () => {
      try {
        const reduced = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) setMotionPaused(reduced || AppState.currentState !== 'active');
      } catch {
        if (mounted) setMotionPaused(true);
      }
    };
    updateMotion();
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) =>
      setMotionPaused(reduced || AppState.currentState !== 'active')
    );
    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setMotionPaused(true);
      else updateMotion();
    });
    return () => {
      mounted = false;
      motionSub.remove();
      appSub.remove();
    };
  }, []);

  useEffect(() => {
    if (motionPaused || disabled || btnWidth <= 0) {
      pulse.stopAnimation();
      shine.stopAnimation();
      pulse.setValue(0);
      shine.setValue(0);
      return;
    }

    const halfPulse = Math.round(PREMIUM_MOTION.upgradePulseMs / 2);
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: halfPulse,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: halfPulse,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const sweepDuration = Math.round(PREMIUM_MOTION.upgradeShineMs * 0.28);
    const sweepPause = Math.max(0, PREMIUM_MOTION.upgradeShineMs - sweepDuration);
    const shineAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, {
          toValue: 1,
          duration: sweepDuration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shine, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(sweepPause),
      ])
    );

    pulseAnim.start();
    shineAnim.start();

    return () => {
      pulseAnim.stop();
      shineAnim.stop();
    };
  }, [motionPaused, disabled, btnWidth, pulse, shine]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const nextWidth = e.nativeEvent.layout.width;
    if (nextWidth > 0 && Math.abs(nextWidth - btnWidth) > 0.5) {
      setBtnWidth(nextWidth);
    }
  };

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });

  const shineTranslateX = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-Math.max(120, btnWidth * 0.5), Math.max(240, btnWidth * 1.2)],
  });

  return (
    <Animated.View
      style={[styles.outer, { transform: [{ scale }] }, disabled && styles.disabled, style]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled }}
        onLayout={handleLayout}
        style={({ pressed }) => [styles.pressable, pressed && !disabled && styles.pressed]}
      >
        <PremiumChrome
          fill
          radius={PREMIUM_TOKENS.glassRadius}
          loopSeconds={PREMIUM_LIQUID.defaultLoopSeconds}
          still={disabled}
          style={styles.chromeBg}
        />

        {!motionPaused && !disabled && btnWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shineStrip,
              {
                transform: [{ translateX: shineTranslateX }, { skewX: '-22deg' }],
              },
            ]}
          >
            <LinearGradient
              colors={PREMIUM_TOKENS.upgradeShineColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.fill}
            />
          </Animated.View>
        ) : null}

        <PremiumGlassPanel radius={10} style={styles.labelPanel}>
          <Text style={styles.label} numberOfLines={1}>
            {title}
          </Text>
        </PremiumGlassPanel>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: PREMIUM_TOKENS.glassRadius,
    shadowColor: PREMIUM_TOKENS.edge,
    shadowOpacity: 0.35,
    shadowRadius: PREMIUM_TOKENS.ringGlowRadius,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  chromeBg: { zIndex: 0 },
  pressable: {
    position: 'relative',
    minHeight: 48,
    borderRadius: PREMIUM_TOKENS.glassRadius,
    borderWidth: PREMIUM_TOKENS.glassBorderWidth,
    borderColor: PREMIUM_TOKENS.glassBorder,
    overflow: 'hidden',
    backgroundColor: PREMIUM_PALETTE.darkest,
    padding: 5,
    justifyContent: 'center',
  },
  shineStrip: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    width: 72,
    zIndex: 0,
  },
  labelPanel: {
    position: 'relative',
    zIndex: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13.5,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
});
