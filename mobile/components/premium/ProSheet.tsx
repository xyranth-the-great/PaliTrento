import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { FONTS } from '../../lib/theme';
import { PremiumChrome } from './PremiumChrome';
import { PremiumGlassPanel } from './PremiumGlassPanel';
import {
  PREMIUM_COPY,
  PREMIUM_GEOMETRY,
  PREMIUM_MOTION,
  PREMIUM_TOKENS,
} from './tokens';

export function formatPremiumRenewalLine(currentPeriodEnd?: string | null): string {
  if (!currentPeriodEnd) return PREMIUM_COPY.nextRenewalUnavailable;
  const parsed = new Date(currentPeriodEnd);
  if (Number.isNaN(parsed.getTime())) return PREMIUM_COPY.nextRenewalUnavailable;
  const formatted = parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `${PREMIUM_COPY.nextRenewalPrefix}${formatted}`;
}

export interface ProSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * PRO membership sheet (Modal) with live 30 s Liquid Chrome background,
 * frosted glass panels for every text block, close button, and Android back-button
 * dismissal via `onRequestClose`.
 */
export function ProSheet({ visible, onClose }: ProSheetProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [box, setBox] = useState({ w: 340, h: 460 });

  const renewalLine = formatPremiumRenewalLine(profile?.premium_details?.current_period_end);

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

  const handleManage = () => {
    onClose();
    router.push({ pathname: '/(tabs)/store', params: { tab: 'subscription' } });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <View onLayout={onLayout} style={styles.shell}>
          <PremiumChrome
            width={box.w}
            height={box.h}
            radius={PREMIUM_GEOMETRY.proSheetRadius}
            zoom={PREMIUM_MOTION.defaultZoom}
            mode="banner"
            visible={visible}
            style={styles.chromeBg}
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {/* Header row inside glass panel */}
            <View style={styles.headerRow}>
              <PremiumGlassPanel style={styles.titleGlass}>
                <View style={styles.statusRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.statusText}>{PREMIUM_COPY.memberStatusActive}</Text>
                </View>
                <Text style={styles.title}>{PREMIUM_COPY.proSheetTitle}</Text>
              </PremiumGlassPanel>

              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close Premium details"
                style={({ pressed }) => [styles.closeBtnWrap, pressed && styles.pressed]}
              >
                <PremiumGlassPanel radius={PREMIUM_GEOMETRY.pillRadius} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={PREMIUM_TOKENS.textOnChrome} />
                </PremiumGlassPanel>
              </Pressable>
            </View>

            {/* Price & Renewal Glass Panel */}
            <PremiumGlassPanel style={styles.sectionPanel}>
              <View style={styles.priceRow}>
                <Text style={styles.priceValue}>{PREMIUM_COPY.priceLabel}</Text>
                <Text style={styles.pricePeriod}>{PREMIUM_COPY.pricePeriod}</Text>
              </View>
              <Text style={styles.renewalText}>{renewalLine}</Text>
            </PremiumGlassPanel>

            {/* Exact 4 Benefits Glass Panel */}
            <PremiumGlassPanel style={styles.sectionPanel}>
              <Text style={styles.benefitsHeading}>{PREMIUM_COPY.proSheetBenefitsHeading}</Text>
              <View style={styles.benefitsList}>
                {PREMIUM_COPY.benefits.map((benefit) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={PREMIUM_TOKENS.activeDot}
                    />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </PremiumGlassPanel>

            {/* Manage Membership Action */}
            <Pressable
              onPress={handleManage}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <PremiumGlassPanel style={styles.manageBtn}>
                <Text style={styles.manageBtnText}>{PREMIUM_COPY.manageMembership}</Text>
                <Ionicons name="arrow-forward" size={15} color={PREMIUM_TOKENS.textOnChrome} />
              </PremiumGlassPanel>
            </Pressable>
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
    alignItems: 'center',
    padding: 16,
    position: 'relative',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: PREMIUM_TOKENS.glassBackdrop,
  },
  shell: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    borderRadius: PREMIUM_GEOMETRY.proSheetRadius,
    borderWidth: 1,
    borderColor: PREMIUM_TOKENS.edge,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: PREMIUM_TOKENS.edge,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: PREMIUM_TOKENS.ringGlowRadius,
    elevation: 10,
  },
  chromeBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    padding: 18,
    gap: 12,
    position: 'relative',
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleGlass: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: PREMIUM_TOKENS.activeDot,
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: FONTS.bold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  closeBtnWrap: {
    alignSelf: 'flex-start',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionPanel: {
    padding: 14,
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  priceValue: {
    fontSize: 28,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  pricePeriod: {
    fontSize: 13.5,
    fontFamily: FONTS.semibold,
    color: PREMIUM_TOKENS.textMutedOnChrome,
  },
  renewalText: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  benefitsHeading: {
    fontSize: 14,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  benefitsList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  manageBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manageBtnText: {
    fontSize: 14,
    fontFamily: FONTS.extrabold,
    color: PREMIUM_TOKENS.textOnChrome,
  },
  pressed: {
    opacity: 0.85,
  },
});
