import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { CATS, formatHours, isStoreOpen, PAY } from '../../lib/constants';
import { formatPurok, Store } from '../../lib/data';
import { getMyStore } from '../../lib/seller';
import { QrCodeSvg } from '../../components/QrCodeSvg';
import { Button, Card, EmptyState, ScreenHeader, SectionLabel, StatusPill } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function SellerStandeeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [store, setStore] = useState<(Store & Record<string, any>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showHours, setShowHours] = useState(true);
  const [showPayments, setShowPayments] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const s = await getMyStore(userId);
      setStore(s);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <ScreenHeader title="QR Standee" />
        <View style={{ padding: 16 }}>
          <EmptyState
            icon="qr-code-outline"
            title="No store found"
            text="Complete store setup first to generate your store's QR standee."
            action={<Button title="Set up store" onPress={() => router.push('/seller/store-setup')} small />}
          />
        </View>
      </View>
    );
  }

  const storeUrl = `https://palitrento.online/business/?trn=${encodeURIComponent(store.trn_code)}`;
  const webStandeeUrl = `https://palitrento.online/standee/?storeId=${encodeURIComponent(store.id)}`;
  const purok = formatPurok(store.purok);
  const rawParts = [store.landmark_reference, purok, store.barangay, 'Trento, Agusan del Sur']
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean);
  const dedupedParts: string[] = [];
  for (const part of rawParts) {
    const low = part.toLowerCase();
    const alreadyCovered = dedupedParts.some((existing) => {
      const exLow = existing.toLowerCase();
      return exLow.includes(low) || (low.includes('trento') && exLow.includes('trento'));
    });
    if (!alreadyCovered) dedupedParts.push(part);
  }
  const addressLine = dedupedParts.join(', ');
  const payments = (store.accepted_payments || [])
    .map((p) => PAY[p])
    .filter(Boolean)
    .join(', ');
  const isVerified = store.verification_status === 'VERIFIED' || store.approval_status === 'APPROVED';

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${store.business_name} on PaliTrento`,
        message: `Shop at ${store.business_name} (${store.barangay}, Trento) on PaliTrento:\n${storeUrl}`,
        url: storeUrl,
      });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Could not open share sheet.');
    }
  };

  const handleOpenPrintablePdf = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(webStandeeUrl, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(webStandeeUrl);
      }
    } catch (e: any) {
      Alert.alert('Could not open PDF generator', e?.message || 'Try again later.');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Store QR Standee"
        subtitle="Counter QR & printable A5/A4 PDF"
        right={
          <Pressable onPress={handleShare} style={styles.shareIconBtn} accessibilityLabel="Share store">
            <Ionicons name="share-social-outline" size={19} color={COLORS.primary} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}
      >
        {/* Standee Preview Poster Card */}
        <View style={styles.poster}>
          <LinearGradient
            colors={['#143520', '#1E4E30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.posterHead}
          >
            <View>
              <Text style={styles.posterBrand}>PaliTrento</Text>
              <Text style={styles.posterTag}>Tara, Palit Ta sa Trento!</Text>
            </View>
            <View style={styles.trnPill}>
              <Text style={styles.trnText}>{store.trn_code}</Text>
            </View>
          </LinearGradient>

          <View style={styles.posterBody}>
            <Text style={styles.posterStoreName}>{store.business_name}</Text>
            <Text style={styles.posterCat}>
              {CATS[store.trade_category] || store.trade_category} • {store.barangay}
              {purok ? `, ${purok}` : ''}
            </Text>

            {showBadges && (
              <View style={styles.badgeWrap}>
                {isVerified && <StatusPill label="Verified" tone="ok" />}
                {store.dti_registered && <StatusPill label="DTI" tone="info" />}
                {store.bmbe_registered && <StatusPill label="BMBE" tone="info" />}
                {store.srp_compliant && <StatusPill label="Price Cap ✓" tone="ok" />}
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.detailsList}>
              {showAddress && <StandeeRow label="Address" value={addressLine} />}
              {showHours && (
                <StandeeRow
                  label="Hours"
                  value={`${formatHours(store)} • ${isStoreOpen(store) ? 'Open' : 'Closed'}`}
                />
              )}
              {showPayments && <StandeeRow label="Accepts" value={payments || 'Cash'} />}
            </View>

            <View style={styles.divider} />

            <Text style={styles.scanHeading}>Scan to view store & live prices</Text>
            <View style={styles.qrCard}>
              <QrCodeSvg value={storeUrl} size={200} color="#1B4329" />
            </View>
            <Text style={styles.urlText} numberOfLines={1}>
              {storeUrl}
            </Text>
            <Text style={styles.posterFooter}>Municipality of Trento, Agusan del Sur</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsCol}>
          <Button
            title="Show Full-Screen Counter QR"
            icon="expand-outline"
            onPress={() => setFullscreen(true)}
          />
          <View style={styles.twoBtns}>
            <Button
              title="Share Link"
              icon="share-outline"
              variant="soft"
              onPress={handleShare}
              style={{ flex: 1 }}
            />
            <Button
              title="Print / A5 PDF"
              icon="print-outline"
              variant="amber"
              onPress={handleOpenPrintablePdf}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Customize Preview */}
        <SectionLabel>Standee Details</SectionLabel>
        <Card style={{ paddingVertical: 4 }}>
          <ToggleRow label="Show store address" value={showAddress} onChange={setShowAddress} />
          <ToggleRow label="Show operating hours" value={showHours} onChange={setShowHours} />
          <ToggleRow label="Show payment methods" value={showPayments} onChange={setShowPayments} />
          <ToggleRow label="Show verification badges" value={showBadges} onChange={setShowBadges} last />
        </Card>
      </ScrollView>

      {/* Full-screen Customer Scan Kiosk Modal */}
      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <LinearGradient
          colors={['#143520', '#1B4329', '#112B1A']}
          style={[styles.kioskScreen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        >
          <Pressable
            onPress={() => setFullscreen(false)}
            style={styles.kioskClose}
            accessibilityLabel="Close full screen QR"
          >
            <Ionicons name="close" size={22} color={COLORS.white} />
          </Pressable>

          <Text style={styles.kioskBrand}>PaliTrento</Text>
          <Text style={styles.kioskStore}>{store.business_name}</Text>
          <Text style={styles.kioskMeta}>
            {CATS[store.trade_category] || store.trade_category} • {store.barangay}
          </Text>

          <View style={styles.kioskQrBox}>
            <QrCodeSvg value={storeUrl} size={250} color="#1B4329" />
          </View>

          <Text style={styles.kioskPrompt}>Scan to browse prices & reserve for pickup</Text>
          <Text style={styles.kioskTrn}>{store.trn_code}</Text>
        </LinearGradient>
      </Modal>
    </View>
  );
}

function StandeeRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailVal}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !last && styles.toggleBorder]}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.line, true: COLORS.primarySoft }}
        thumbColor={value ? COLORS.primary : COLORS.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  shareIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW.floating,
  },
  posterHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  posterBrand: { fontSize: 18, fontFamily: FONTS.extrabold, color: '#FEF3E2', letterSpacing: -0.3 },
  posterTag: { fontSize: 11, fontFamily: FONTS.semibold, color: 'rgba(254,243,226,0.82)', marginTop: 1 },
  trnPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  trnText: { fontSize: 10, fontFamily: FONTS.bold, color: '#FBC14E' },
  posterBody: {
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  posterStoreName: {
    fontSize: 21,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  posterCat: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.muted, textAlign: 'center' },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.lineSubtle,
    marginVertical: 4,
  },
  detailsList: { alignSelf: 'stretch', gap: 6 },
  detailRow: { flexDirection: 'row', gap: 10 },
  detailLabel: { width: 64, fontSize: 11.5, fontFamily: FONTS.extrabold, color: COLORS.primary },
  detailVal: { flex: 1, fontSize: 12, fontFamily: FONTS.medium, color: COLORS.ink, lineHeight: 17 },
  scanHeading: {
    fontSize: 13.5,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
    marginTop: 2,
  },
  qrCard: {
    padding: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  urlText: { fontSize: 10.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  posterFooter: { fontSize: 10.5, fontFamily: FONTS.bold, color: COLORS.primary, marginTop: 2 },
  actionsCol: { gap: 10 },
  twoBtns: { flexDirection: 'row', gap: 10 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  toggleBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lineSubtle },
  toggleLabel: { fontSize: 13.5, fontFamily: FONTS.semibold, color: COLORS.ink },
  kioskScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
    position: 'relative',
  },
  kioskClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kioskBrand: { fontSize: 14, fontFamily: FONTS.extrabold, color: '#FBC14E', letterSpacing: 1.2, textTransform: 'uppercase' },
  kioskStore: { fontSize: 25, fontFamily: FONTS.extrabold, color: COLORS.white, textAlign: 'center', letterSpacing: -0.4 },
  kioskMeta: { fontSize: 13, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.78)', marginBottom: 10 },
  kioskQrBox: {
    padding: 16,
    borderRadius: 26,
    backgroundColor: COLORS.white,
    ...SHADOW.floating,
  },
  kioskPrompt: {
    fontSize: 14.5,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    textAlign: 'center',
    marginTop: 12,
  },
  kioskTrn: { fontSize: 12, fontFamily: FONTS.semibold, color: 'rgba(255,255,255,0.68)' },
});
