import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { FONTS } from '../../lib/theme';
import { PremiumChrome } from './PremiumChrome';
import { PremiumGlassPanel } from './PremiumGlassPanel';
import { ProSheet } from './ProSheet';
import {
  PREMIUM_COPY,
  PREMIUM_GEOMETRY,
  PREMIUM_MOTION,
  PREMIUM_TOKENS,
} from './tokens';

export interface ProPillProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Small header "PRO" pill with a fixed still Liquid Chrome fill and a frosted
 * glass panel behind the text. Renders ONLY when server-backed `profile.is_premium` is true.
 * Tapping opens `ProSheet`.
 */
export function ProPill({ style }: ProPillProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ w: 48, h: 26 });

  if (profile?.is_premium !== true) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (Math.abs(width - box.w) > 1 || Math.abs(height - box.h) > 1)) {
      setBox({ w: width, h: height });
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Premium membership details"
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed, style]}
      >
        <View onLayout={onLayout} style={styles.pillOuter}>
          <PremiumChrome
            width={box.w}
            height={box.h}
            radius={PREMIUM_GEOMETRY.pillRadius}
            zoom={PREMIUM_MOTION.chipZoom}
            still
            style={styles.chromeBg}
          />
          <PremiumGlassPanel radius={PREMIUM_GEOMETRY.pillRadius} style={styles.pillGlass}>
            <Text style={styles.pillText} allowFontScaling={false}>
              {PREMIUM_COPY.headerProPill}
            </Text>
          </PremiumGlassPanel>
        </View>
      </Pressable>

      <ProSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  pillOuter: {
    position: 'relative',
    borderRadius: PREMIUM_GEOMETRY.pillRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PREMIUM_TOKENS.edge,
  },
  chromeBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pillGlass: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'relative',
    zIndex: 2,
  },
  pillText: {
    fontSize: 10.5,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
    letterSpacing: 0.8,
    textShadowColor: PREMIUM_TOKENS.textShadowColor,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
