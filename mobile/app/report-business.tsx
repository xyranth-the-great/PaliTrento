import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Field, ScreenHeader, StatusPill } from '../components/ui';
import { supabase } from '../lib/supabase';
import { BUSINESS_REPORT_REASONS, submitBusinessReport } from '../lib/support';
import { COLORS, FONTS, RADIUS } from '../lib/theme';

interface StorePreview {
  id: string;
  business_name: string;
  trn_code: string;
  barangay: string;
  verification_status?: string | null;
}

export default function ReportBusinessScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [store, setStore] = useState<StorePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!storeId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('stores')
        .select('id, business_name, trn_code, barangay, verification_status')
        .eq('id', String(storeId))
        .maybeSingle();
      if (active) {
        setStore((data as StorePreview) || null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [storeId]);

  const handleSubmit = async () => {
    if (!store) return;
    if (!reason) {
      Alert.alert('Select a reason', 'Please choose why you are reporting this business.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Details required', 'Please provide additional details to help administrators review.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitBusinessReport(store.id, reason, description);
      setReportId(res.reportId || 'Submitted');
    } catch (e: any) {
      Alert.alert('Could not submit report', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScreenHeader
        title="Report Business"
        subtitle="Help keep PaliTrento safe and trustworthy"
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !store ? (
        <View style={styles.pad}>
          <EmptyState
            icon="storefront-outline"
            title="Business not found"
            text="We couldn't find that business to report."
            action={<Button title="Go back" onPress={() => router.back()} small />}
          />
        </View>
      ) : reportId ? (
        <View style={styles.pad}>
          <Card style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={40} color={COLORS.ok} />
            </View>
            <Text style={styles.successTitle}>Report Submitted</Text>
            <Text style={styles.successText}>
              Thank you for reporting {store.business_name}. Our municipal administrators will review
              your report shortly.
            </Text>
            <View style={styles.refBox}>
              <Text style={styles.refLabel}>REPORT ID</Text>
              <Text style={styles.refVal} selectable>
                {reportId}
              </Text>
            </View>
            <Button
              title={`Return to ${store.business_name}`}
              onPress={() => router.back()}
              style={{ width: '100%', marginTop: 8 }}
            />
          </Card>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        >
          {/* Business Summary */}
          <Card style={styles.summaryCard}>
            <View style={styles.storeIconWrap}>
              <Ionicons name="storefront" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName}>{store.business_name}</Text>
              <Text style={styles.storeMeta}>
                {store.trn_code} • {store.barangay}
              </Text>
            </View>
            {store.verification_status === 'VERIFIED' && (
              <StatusPill label="Verified" tone="ok" />
            )}
          </Card>

          {/* Reason Picker */}
          <Card>
            <Text style={styles.blockTitle}>
              Reason for reporting <Text style={{ color: COLORS.bad }}>*</Text>
            </Text>
            <View style={styles.reasonList}>
              {BUSINESS_REPORT_REASONS.map((opt) => {
                const active = reason === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setReason(opt.value)}
                    style={[styles.reasonRow, active && styles.reasonRowActive]}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.reasonLabel, active && styles.reasonLabelActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Details */}
          <Card>
            <Field
              label="Additional Details"
              required
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Please provide as much detail as possible to help us investigate..."
              hint="Include specific examples, dates, or any evidence you observed."
              style={{ minHeight: 110 }}
            />
          </Card>

          <Button
            title="Submit Report"
            icon="flag-outline"
            loading={submitting}
            onPress={handleSubmit}
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16 },
  scroll: { padding: 16, gap: 14 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  storeMeta: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  blockTitle: { fontSize: 13.5, fontFamily: FONTS.extrabold, color: COLORS.ink, marginBottom: 10 },
  reasonList: { gap: 8 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  reasonRowActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  reasonLabel: { flex: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.inkSecondary },
  reasonLabelActive: { color: COLORS.primaryDark, fontFamily: FONTS.bold },
  successCard: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: COLORS.okBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 19, fontFamily: FONTS.extrabold, color: COLORS.ink },
  successText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  refBox: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.line,
    width: '100%',
  },
  refLabel: { fontSize: 9.5, fontFamily: FONTS.extrabold, color: COLORS.muted, letterSpacing: 0.8 },
  refVal: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginTop: 2 },
});
