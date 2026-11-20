import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';
import { PremiumChrome } from './PremiumChrome';
import { PremiumChromeButton } from './PremiumChromeButton';
import { PremiumGlassPanel } from './PremiumGlassPanel';
import {
  PREMIUM_COPY,
  PREMIUM_GEOMETRY,
  PREMIUM_LIQUID,
  PREMIUM_PALETTE,
  PREMIUM_TOKENS,
} from './tokens';

export interface PremiumUpgradeSheetProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  busy?: boolean;
}

const UPGRADE_BENEFITS: readonly string[] = [
  ...PREMIUM_COPY.benefits,
  PREMIUM_COPY.upgradeExtraBenefit,
];

/**
 * Upgrade modal with a live 30s Liquid Chrome hero, Free vs Premium comparison
 * table, five exact benefit lines, "Not now" dismiss action, and a double-tap
 * guarded "Upgrade now · ₱49/month" chrome CTA.
 */
export function PremiumUpgradeSheet({
  visible,
  onClose,
  onUpgrade,
  busy = false,
}: PremiumUpgradeSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const notNowRef = useRef<React.ElementRef<typeof Pressable>>(null);

  useEffect(() => {
    if (!visible) {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const tag = notNowRef.current ? findNodeHandle(notNowRef.current) : null;
      if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
    }, 150);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleUpgradePress = () => {
    if (submitLockRef.current || busy) return;
    submitLockRef.current = true;
    setSubmitting(true);
    onUpgrade();
  };

  const isDisabled = submitting || busy;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={PREMIUM_COPY.notNow} />

        <View style={styles.sheet}>
          <View style={styles.heroWrap}>
            <PremiumChrome
              fill
              radius={PREMIUM_GEOMETRY.proSheetRadius}
              loopSeconds={PREMIUM_LIQUID.defaultLoopSeconds}
              visible={visible}
              style={styles.heroChrome}
            />

            <View style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroPillsWrap}>
                  <PremiumGlassPanel radius={PREMIUM_GEOMETRY.pillRadius} style={styles.titlePill}>
                    <Text style={styles.titlePillText}>{PREMIUM_COPY.proSheetTitle}</Text>
                  </PremiumGlassPanel>

                  <PremiumGlassPanel style={styles.pricePanel}>
                    <Text style={styles.priceText}>
                      {PREMIUM_COPY.priceLabel}{' '}
                      <Text style={styles.pricePeriodText}>{PREMIUM_COPY.pricePeriod}</Text>
                    </Text>
                  </PremiumGlassPanel>
                </View>

                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={PREMIUM_COPY.notNow}
                >
                  <PremiumGlassPanel radius={PREMIUM_GEOMETRY.pillRadius} style={styles.closeBtn}>
                    <Ionicons name="close" size={16} color={PREMIUM_TOKENS.textOnChrome} />
                  </PremiumGlassPanel>
                </Pressable>
              </View>
            </View>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Free vs Premium comparison table */}
            <Text style={styles.sectionTitle}>{PREMIUM_COPY.comparisonHeading}</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCellFeature, styles.tableHeaderText]}>Feature</Text>
                <Text style={[styles.tableCellPlan, styles.tableHeaderText]}>
                  {PREMIUM_COPY.freePill}
                </Text>
                <Text style={[styles.tableCellPlan, styles.tableHeaderPremium]}>Premium</Text>
              </View>
              {PREMIUM_COPY.comparisonRows.map((row, idx) => (
                <View
                  key={row.feature}
                  style={[
                    styles.tableRow,
                    idx < PREMIUM_COPY.comparisonRows.length - 1 && styles.tableRowBorder,
                  ]}
                >
                  <Text style={styles.tableCellFeature}>{row.feature}</Text>
                  <Text style={styles.tableCellPlan}>{row.free}</Text>
                  <Text style={[styles.tableCellPlan, styles.tableCellPremium]}>{row.premium}</Text>
                </View>
              ))}
            </View>

            {/* Five exact benefit lines */}
            <View style={styles.benefitsList}>
              {UPGRADE_BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Actions: Not now focused first, then double-tap-guarded Upgrade CTA */}
            <View style={styles.actions}>
              <Pressable
                ref={notNowRef}
                onPress={onClose}
                accessible
                accessibilityRole="button"
                accessibilityLabel={PREMIUM_COPY.notNow}
                style={({ pressed }) => [styles.notNowBtn, pressed && styles.pressed]}
              >
                <Text style={styles.notNowText}>{PREMIUM_COPY.notNow}</Text>
              </Pressable>

              <PremiumChromeButton
                title={PREMIUM_COPY.upgradeNowCta}
                onPress={handleUpgradePress}
                disabled={isDisabled}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
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
    backgroundColor: PREMIUM_TOKENS.glassBackdrop,
  },
  sheet: {
    backgroundColor: PREMIUM_TOKENS.cardSurface,
    borderRadius: PREMIUM_GEOMETRY.proSheetRadius,
    overflow: 'hidden',
    maxHeight: '88%',
    ...SHADOW.floating,
  },
  heroWrap: {
    position: 'relative',
    backgroundColor: PREMIUM_PALETTE.darkest,
    borderTopLeftRadius: PREMIUM_GEOMETRY.proSheetRadius,
    borderTopRightRadius: PREMIUM_GEOMETRY.proSheetRadius,
    overflow: 'hidden',
  },
  heroChrome: {
    zIndex: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroPillsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  titlePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  titlePillText: {
    fontSize: 13,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricePanel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceText: {
    fontSize: 16,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_PALETTE.highlight,
  },
  pricePeriodText: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
  },
  table: {
    borderWidth: PREMIUM_GEOMETRY.freeCardBorderWidth,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  tableHeader: {
    backgroundColor: COLORS.bg,
    borderBottomWidth: PREMIUM_GEOMETRY.freeCardBorderWidth,
    borderBottomColor: COLORS.line,
  },
  tableRowBorder: {
    borderBottomWidth: PREMIUM_GEOMETRY.freeCardBorderWidth,
    borderBottomColor: COLORS.lineSubtle,
  },
  tableHeaderText: {
    fontSize: 11,
    fontFamily: FONTS.extrabold,
    color: COLORS.muted,
  },
  tableHeaderPremium: {
    fontSize: 11,
    fontFamily: FONTS.extrabold,
    color: COLORS.primary,
  },
  tableCellFeature: {
    flex: 1.2,
    fontSize: 11.5,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
  },
  tableCellPlan: {
    flex: 1,
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
  },
  tableCellPremium: {
    fontFamily: FONTS.bold,
    color: COLORS.primaryDark,
  },
  benefitsList: {
    gap: 7,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: FONTS.semibold,
    color: COLORS.ink,
  },
  actions: {
    gap: 8,
    marginTop: 2,
  },
  notNowBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: PREMIUM_TOKENS.glassRadius,
    borderWidth: PREMIUM_GEOMETRY.freeCardBorderWidth,
    borderColor: COLORS.line,
    backgroundColor: COLORS.bg,
  },
  notNowText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.inkSecondary,
  },
  pressed: {
    opacity: 0.8,
  },
});
