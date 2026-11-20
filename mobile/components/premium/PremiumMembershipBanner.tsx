import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../lib/theme';
import { PremiumChrome } from './PremiumChrome';
import { PremiumGlassPanel } from './PremiumGlassPanel';
import { formatPremiumRenewalLine } from './ProSheet';
import {
  PREMIUM_COPY,
  PREMIUM_GEOMETRY,
  PREMIUM_LIQUID,
  PREMIUM_PALETTE,
  PREMIUM_TOKENS,
} from './tokens';

export interface PremiumMembershipBannerProps {
  currentPeriodEnd?: string | null;
  onManage?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Live 30-second Liquid Chrome membership banner.
 * Every text block, chip, and action sits on a frosted PremiumGlassPanel
 * so no bare text ever touches raw chrome.
 */
export function PremiumMembershipBanner({
  currentPeriodEnd,
  onManage,
  style,
}: PremiumMembershipBannerProps) {
  const renewalLine = formatPremiumRenewalLine(currentPeriodEnd);

  return (
    <View style={[styles.outer, style]}>
      <View style={styles.chromeContainer}>
        <PremiumChrome
          fill
          radius={PREMIUM_GEOMETRY.bannerRadius}
          loopSeconds={PREMIUM_LIQUID.defaultLoopSeconds}
          style={styles.chromeBg}
        />

        <View style={styles.content}>
          <View style={styles.topRow}>
            <PremiumGlassPanel radius={PREMIUM_GEOMETRY.pillRadius} style={styles.statusChip}>
              <View style={styles.activeDot} />
              <Text style={styles.statusText}>{PREMIUM_COPY.memberStatusActive}</Text>
            </PremiumGlassPanel>

            <PremiumGlassPanel radius={PREMIUM_GEOMETRY.pillRadius} style={styles.renewalChip}>
              <Text style={styles.renewalText}>{renewalLine}</Text>
            </PremiumGlassPanel>
          </View>

          <PremiumGlassPanel style={styles.subtitlePanel}>
            <Text style={styles.subtitleText}>{PREMIUM_COPY.memberSubtitle}</Text>
          </PremiumGlassPanel>

          <View style={styles.benefitsGrid}>
            {PREMIUM_COPY.benefits.map((benefit) => (
              <PremiumGlassPanel
                key={benefit}
                radius={PREMIUM_TOKENS.glassRadius}
                style={styles.benefitChip}
              >
                <Ionicons name="checkmark-circle" size={14} color={PREMIUM_PALETTE.highlight} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </PremiumGlassPanel>
            ))}
          </View>

          {onManage ? (
            <Pressable
              onPress={onManage}
              accessibilityRole="button"
              accessibilityLabel={PREMIUM_COPY.manageMembership}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <PremiumGlassPanel radius={PREMIUM_TOKENS.glassRadius} style={styles.managePanel}>
                <Text style={styles.manageText}>{PREMIUM_COPY.manageMembership}</Text>
                <Ionicons name="arrow-forward" size={15} color={PREMIUM_TOKENS.textOnChrome} />
              </PremiumGlassPanel>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: PREMIUM_GEOMETRY.bannerRadius,
    borderWidth: PREMIUM_TOKENS.glassBorderWidth,
    borderColor: PREMIUM_TOKENS.edge,
    shadowColor: PREMIUM_TOKENS.edge,
    shadowOpacity: 0.35,
    shadowRadius: PREMIUM_TOKENS.ringGlowRadius,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  chromeContainer: {
    position: 'relative',
    borderRadius: PREMIUM_GEOMETRY.bannerRadius,
    overflow: 'hidden',
    backgroundColor: PREMIUM_PALETTE.darkest,
  },
  chromeBg: {
    zIndex: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    padding: 16,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: PREMIUM_TOKENS.activeDot,
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
    letterSpacing: 0.1,
  },
  renewalChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  renewalText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: PREMIUM_TOKENS.textMutedOnChrome,
  },
  subtitlePanel: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  subtitleText: {
    fontSize: 12.5,
    fontFamily: FONTS.semibold,
    color: PREMIUM_TOKENS.textOnChrome,
    lineHeight: 18,
  },
  benefitsGrid: {
    gap: 7,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  benefitText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: FONTS.semibold,
    color: PREMIUM_TOKENS.textOnChrome,
    lineHeight: 17,
  },
  managePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 2,
  },
  manageText: {
    fontSize: 13.5,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  pressed: {
    opacity: 0.85,
  },
});
