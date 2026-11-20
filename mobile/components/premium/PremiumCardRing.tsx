import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FONTS } from '../../lib/theme';
import { PremiumChrome } from './PremiumChrome';
import { PremiumGlassPanel } from './PremiumGlassPanel';
import {
  PREMIUM_COPY,
  PREMIUM_GEOMETRY,
  PREMIUM_LIQUID,
  PREMIUM_MOTION,
  PREMIUM_TOKENS,
} from './tokens';

let ringCounter = 0;

const INNER_RADIUS = PREMIUM_GEOMETRY.premiumCardRadius - PREMIUM_GEOMETRY.ringWidth;

export interface PremiumCardRingProps {
  children: React.ReactNode;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  pressed?: boolean;
}

/**
 * Premium 4 px Liquid Chrome card ring (radius 20, inner radius 16, 55 s loop,
 * shared 12-ring engine budget, warm golden glow from `tokens.ts`).
 */
export function PremiumCardRing({
  children,
  visible = true,
  style,
  innerStyle,
  pressed = false,
}: PremiumCardRingProps) {
  const phaseRef = useRef<number | null>(null);
  if (phaseRef.current === null) {
    phaseRef.current = ((ringCounter++ * PREMIUM_MOTION.ringIndexPhaseStep) % 1) * Math.PI * 2;
  }

  const [box, setBox] = useState({ w: 220, h: 240 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (
      width > 0 &&
      height > 0 &&
      width < 1200 &&
      height < 1200 &&
      (Math.abs(width - box.w) > 2 || Math.abs(height - box.h) > 2)
    ) {
      setBox({ w: width, h: height });
    }
  };

  return (
      <View style={[styles.ringOuter, style]}>
      {/* Soft ambient glow halo behind ring */}
      <View pointerEvents="none" style={styles.glowHalo} />

      <View onLayout={onLayout} style={[styles.ringClip, pressed && styles.ringPressed]}>
        <PremiumChrome
          width={box.w}
          height={box.h}
          radius={PREMIUM_GEOMETRY.premiumCardRadius}
          loopSeconds={PREMIUM_LIQUID.ringLoopSeconds}
          zoom={PREMIUM_MOTION.ringZoom}
          mode="ring"
          visible={visible}
          phaseOffset={phaseRef.current}
          style={styles.chromeBg}
        />
        <View style={[styles.ringInner, innerStyle]}>{children}</View>
      </View>
    </View>
  );
}

export interface PremiumCardChipProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Small "✦ Premium" photo chip using a fixed still chrome fill and a frosted
 * glass panel behind the white text.
 */
export function PremiumCardChip({ style }: PremiumCardChipProps) {
  const [box, setBox] = useState({ w: 86, h: 22 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (Math.abs(width - box.w) > 1 || Math.abs(height - box.h) > 1)) {
      setBox({ w: width, h: height });
    }
  };

  return (
    <View onLayout={onLayout} style={[styles.chipOuter, style]}>
      <PremiumChrome
        width={box.w}
        height={box.h}
        radius={PREMIUM_GEOMETRY.pillRadius}
        zoom={PREMIUM_MOTION.chipZoom}
        still
        style={styles.chromeBg}
      />
      <PremiumGlassPanel radius={PREMIUM_GEOMETRY.pillRadius} style={styles.chipGlass}>
        <Text style={styles.chipText} allowFontScaling={false}>
          {PREMIUM_COPY.cardChip}
        </Text>
      </PremiumGlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  ringOuter: {
    position: 'relative',
    overflow: 'visible',
  },
  glowHalo: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: PREMIUM_GEOMETRY.premiumCardRadius + 4,
    backgroundColor: PREMIUM_TOKENS.ringGlowColor,
    opacity: 0.35,
  },
  ringClip: {
    borderRadius: PREMIUM_GEOMETRY.premiumCardRadius,
    padding: PREMIUM_GEOMETRY.ringWidth,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: PREMIUM_TOKENS.edge,
    shadowColor: PREMIUM_TOKENS.ringGlowShadowColor,
    shadowOffset: PREMIUM_TOKENS.ringGlowOffset,
    shadowOpacity: PREMIUM_TOKENS.ringGlowOpacity,
    shadowRadius: PREMIUM_TOKENS.ringGlowRadius,
    elevation: PREMIUM_LIQUID.cardElevation,
  },
  ringPressed: {
    shadowOpacity: PREMIUM_TOKENS.hoverGlowOpacity,
    shadowRadius: PREMIUM_TOKENS.hoverGlowRadius,
  },
  chromeBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  ringInner: {
    borderRadius: INNER_RADIUS,
    backgroundColor: PREMIUM_TOKENS.cardSurface,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  chipOuter: {
    position: 'relative',
    borderRadius: PREMIUM_GEOMETRY.pillRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PREMIUM_TOKENS.edge,
    alignSelf: 'flex-start',
  },
  chipGlass: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'relative',
    zIndex: 2,
  },
  chipText: {
    fontSize: 9.5,
    lineHeight: 13,
    includeFontPadding: false,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
    letterSpacing: 0.3,
    textShadowColor: PREMIUM_TOKENS.textShadowColor,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
