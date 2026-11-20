import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Button, Card, EmptyState, Field, ScreenHeader } from '../components/ui';
import { supabase } from '../lib/supabase';
import { peso, UNITS } from '../lib/constants';
import { PRODUCT_REPORT_REASONS, submitProductReport } from '../lib/support';
import { COLORS, FONTS, RADIUS } from '../lib/theme';

interface ProductPreview {
  id: string;
  name: string;
  current_price: number;
  unit: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  stores?: { business_name: string; trn_code: string } | null;
}

export default function ReportProductScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<ProductPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!productId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('id, name, current_price, unit, image_url, image_urls, stores(business_name, trn_code)')
        .eq('id', String(productId))
        .maybeSingle();
      if (active) {
        setProduct((data as unknown as ProductPreview) || null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [productId]);

  const handleSubmit = async () => {
    if (!product) return;
    if (!reason) {
      Alert.alert('Select a reason', 'Please choose why you are reporting this product.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Details required', 'Please provide additional details to help administrators review.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitProductReport(product.id, reason, description);
      setReportId(res.reportId || 'Submitted');
    } catch (e: any) {
      Alert.alert('Could not submit report', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const thumb =
    (Array.isArray(product?.image_urls) && product?.image_urls[0]) || product?.image_url || null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScreenHeader
        title="Report Product"
        subtitle="Report inappropriate or misleading listings"
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !product ? (
        <View style={styles.pad}>
          <EmptyState
            icon="basket-outline"
            title="Product not found"
            text="We couldn't find that product to report."
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
              Thank you for reporting "{product.name}". Our administrators will investigate your
              report.
            </Text>
            <View style={styles.refBox}>
              <Text style={styles.refLabel}>REPORT ID</Text>
              <Text style={styles.refVal} selectable>
                {reportId}
              </Text>
            </View>
            <Button
              title="Return to Product"
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
          {/* Product Summary */}
          <Card style={styles.summaryCard}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Ionicons name="bag-handle-outline" size={22} color={COLORS.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.prodName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.prodMeta}>
                {peso(product.current_price)} / {UNITS[product.unit] || product.unit} •{' '}
                {product.stores?.business_name || 'Verified store'}
              </Text>
            </View>
          </Card>

          {/* Reason Picker */}
          <Card>
            <Text style={styles.blockTitle}>
              Reason for reporting <Text style={{ color: COLORS.bad }}>*</Text>
            </Text>
            <View style={styles.reasonList}>
              {PRODUCT_REPORT_REASONS.map((opt) => {
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
              placeholder="Please describe what you observed..."
              hint="Include specific examples, pricing issues, or evidence."
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
  thumb: { width: 56, height: 56, borderRadius: RADIUS.sm, backgroundColor: COLORS.mutedBg },
  thumbFallback: { backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  prodName: { fontSize: 14.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  prodMeta: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
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
