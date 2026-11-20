import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { PREMIUM_TOKENS } from './tokens';

export interface PremiumGlassPanelProps {
  children: React.ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Frosted dark-bronze glass panel (`rgba(45, 24, 0, 0.66)` fill, `rgba(255, 230, 160, 0.28)` border)
 * guaranteeing >= 4.5:1 contrast for white text sitting over moving Liquid Chrome.
 */
export function PremiumGlassPanel({
  children,
  radius = 12,
  style,
}: PremiumGlassPanelProps) {
  return <View style={[styles.panel, { borderRadius: radius }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: PREMIUM_TOKENS.glassBackground,
    borderColor: PREMIUM_TOKENS.glassBorder,
    borderWidth: PREMIUM_TOKENS.glassBorderWidth,
  },
});
