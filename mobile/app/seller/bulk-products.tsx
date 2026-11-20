import React, { useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  peso,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  UNITS,
} from '../../lib/constants';
import { Store } from '../../lib/data';
import {
  canManageProducts,
  createProduct,
  FREE_LISTING_QUOTA,
  freeListingsUsed,
  getMyStore,
  getStoreProducts,
  getSubscriptionData,
  isPremiumActive,
} from '../../lib/seller';
import { Button, Card, ChipGroup, EmptyState, Field, ScreenHeader } from '../../components/ui';
import { DemoPaymentConfig, DemoPaymentModal } from '../../components/DemoPaymentModal';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const OTHER = '__OTHER__';

interface BulkRow {
  key: string;
  name: string;
  category: string;
  categoryOther: string;
  unit: string;
  unitOther: string;
  price: string;
  quantity: string;
  photoUri: string | null;
}

function makeRow(): BulkRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    category: 'Rice',
    categoryOther: '',
    unit: 'KG',
    unitOther: '',
    price: '',
    quantity: '',
    photoUri: null,
  };
}

export default function BulkAddProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [store, setStore] = useState<(Store & Record<string, any>) | null>(null);
  const [sub, setSub] = useState<any>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow(), makeRow()]);
  const [savingProgress, setSavingProgress] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<DemoPaymentConfig | null>(null);

  useEffect(() => {
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const s = await getMyStore(userId);
      setStore(s);
      if (s) {
        const [prods, sd] = await Promise.all([getStoreProducts(s.id), getSubscriptionData(userId)]);
        setExistingCount(prods.length);
        setSub(sd);
      }
      setLoading(false);
    })();
  }, [userId]);

  const premium = isPremiumActive(sub);
  const used = freeListingsUsed(sub, existingCount);
  const manageable = canManageProducts(store);

  const costSummary = useMemo(() => {
    const count = rows.length;
    if (premium) {
      return {
        paidCount: 0,
        text: `${count} product${count === 1 ? '' : 's'} will be added with no listing fees (Premium).`,
      };
    }
    const freeSlots = Math.max(0, FREE_LISTING_QUOTA - used);
    const paidCount = Math.max(0, count - freeSlots);
    const freeUsedNow = Math.min(count, freeSlots);
    return {
      paidCount,
      text:
        paidCount > 0
          ? `${freeUsedNow} free listing${freeUsedNow === 1 ? '' : 's'} + ${paidCount} additional listing${paidCount === 1 ? '' : 's'} = ${peso(paidCount)}`
          : `${count} product${count === 1 ? '' : 's'} will use your remaining free listings (${freeSlots} left).`,
    };
  }, [premium, rows.length, used]);

  const updateRow = (key: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const pickPhotoForRow = async (key: string, useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add product pictures.');
      return;
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      updateRow(key, { photoUri: res.assets[0].uri });
    }
  };

  const validateRows = () => {
    if (rows.length < 2) {
      throw new Error('Add at least two products to use bulk add.');
    }
    return rows.map((r, idx) => {
      const cat = r.category === OTHER ? r.categoryOther.trim() : r.category;
      const unit = r.unit === OTHER ? r.unitOther.trim() : r.unit;
      const priceNum = parseFloat(r.price);
      if (!r.name.trim() || !cat || !unit || Number.isNaN(priceNum) || priceNum < 0) {
        throw new Error(`Complete name, category, unit, and valid price for Product ${idx + 1}.`);
      }
      if (!r.photoUri) {
        throw new Error(`Choose a photo for Product ${idx + 1}.`);
      }
      return {
        input: {
          name: r.name.trim(),
          category: cat,
          unit,
          current_price: priceNum,
          in_stock: true,
          quantity: r.quantity.trim() ? parseInt(r.quantity, 10) : null,
        },
        photoUri: r.photoUri,
      };
    });
  };

  const runBatchInsert = async (
    items: { input: any; photoUri: string }[],
    paidFlags: boolean[]
  ) => {
    if (!store || !userId) return;
    let saved = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        setSavingProgress(`Saving product ${i + 1} of ${items.length}…`);
        await createProduct(userId, store.id, items[i].input, [items[i].photoUri], paidFlags[i]);
        saved += 1;
      }
      setSavingProgress(null);
    } catch (e: any) {
      setSavingProgress(null);
      if (saved > 0) {
        throw new Error(
          `Saved ${saved} of ${items.length} products before an error: ${e?.message || 'Retry remaining items.'}`
        );
      }
      throw e;
    }
  };

  const handleSubmit = async () => {
    if (!store || !userId || !manageable) return;
    let parsed;
    try {
      parsed = validateRows();
    } catch (e: any) {
      Alert.alert('Incomplete form', e?.message || 'Please check all product fields.');
      return;
    }

    const paidFlags = parsed.map((_, idx) => !premium && used + idx >= FREE_LISTING_QUOTA);
    const paidCount = paidFlags.filter(Boolean).length;

    if (paidCount > 0) {
      setPaymentConfig({
        amount: paidCount,
        title: 'Bulk product listings',
        description: `${parsed.length} products will be added. ${paidCount} are beyond your ${FREE_LISTING_QUOTA} free listings and cost ${peso(paidCount)}.`,
        successMessage: `${parsed.length} products have been added to ${store.business_name}!`,
        onPay: async () => {
          await runBatchInsert(parsed, paidFlags);
        },
        onDone: () => router.back(),
      });
      return;
    }

    try {
      await runBatchInsert(parsed, paidFlags);
      Alert.alert('Products added', `${parsed.length} products were added to ${store.business_name}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Bulk add incomplete', e?.message || 'Could not add all products.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Bulk Add Products"
        subtitle={`${rows.length} products queued`}
        right={
          manageable ? (
            <Pressable
              onPress={() => setRows((prev) => [...prev, makeRow()])}
              style={styles.addRowBtn}
            >
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.addRowText}>Row</Text>
            </Pressable>
          ) : null
        }
      />

      {!store || !manageable ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            icon="lock-closed-outline"
            title="Approval required"
            text="You can bulk-add products after Admin approves your store."
            action={<Button title="Go back" onPress={() => router.back()} small />}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom, gap: 14 }}
          >
            {/* Cost Summary Banner */}
            <View style={[styles.costBanner, costSummary.paidCount > 0 && styles.costBannerWarn]}>
              <Ionicons
                name={premium ? 'sparkles' : costSummary.paidCount > 0 ? 'card-outline' : 'checkmark-circle-outline'}
                size={18}
                color={costSummary.paidCount > 0 ? COLORS.warn : COLORS.primary}
              />
              <Text
                style={[
                  styles.costText,
                  costSummary.paidCount > 0 && { color: COLORS.warn },
                ]}
              >
                {costSummary.text}
              </Text>
            </View>

            {rows.map((row, idx) => (
              <Card key={row.key} style={{ gap: 10 }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>Product {idx + 1}</Text>
                  {rows.length > 2 && (
                    <Pressable
                      onPress={() => removeRow(row.key)}
                      style={styles.removeRowBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={15} color={COLORS.bad} />
                      <Text style={styles.removeRowText}>Remove</Text>
                    </Pressable>
                  )}
                </View>

                {/* Photo Row */}
                <View style={styles.photoRow}>
                  {row.photoUri ? (
                    <View style={styles.photoWrap}>
                      <Image source={{ uri: row.photoUri }} style={styles.thumb} />
                      <Pressable
                        onPress={() => updateRow(row.key, { photoUri: null })}
                        style={styles.clearPhoto}
                        hitSlop={6}
                      >
                        <Ionicons name="close" size={13} color={COLORS.white} />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => pickPhotoForRow(row.key, false)}
                        style={styles.photoBtn}
                      >
                        <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.photoBtnText}>Gallery *</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => pickPhotoForRow(row.key, true)}
                        style={styles.photoBtn}
                      >
                        <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.photoBtnText}>Camera</Text>
                      </Pressable>
                    </>
                  )}
                </View>

                <Field
                  label="Product name"
                  required
                  value={row.name}
                  onChangeText={(v) => updateRow(row.key, { name: v })}
                  placeholder="e.g. Well-milled rice"
                />

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Price (₱)"
                      required
                      value={row.price}
                      onChangeText={(v) => updateRow(row.key, { price: v })}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Quantity"
                      value={row.quantity}
                      onChangeText={(v) => updateRow(row.key, { quantity: v })}
                      keyboardType="number-pad"
                      placeholder="Optional"
                    />
                  </View>
                </View>

                <Text style={styles.chipLabel}>Category *</Text>
                <ChipGroup
                  value={row.category}
                  onChange={(v) => updateRow(row.key, { category: v })}
                  options={[
                    ...PRODUCT_CATEGORIES.map((c) => ({
                      value: c,
                      label: PRODUCT_CATEGORY_LABELS[c] || c,
                    })),
                    { value: OTHER, label: 'Other' },
                  ]}
                />
                {row.category === OTHER && (
                  <Field
                    label="Specify category"
                    required
                    value={row.categoryOther}
                    onChangeText={(v) => updateRow(row.key, { categoryOther: v })}
                  />
                )}

                <Text style={styles.chipLabel}>Unit *</Text>
                <ChipGroup
                  value={row.unit}
                  onChange={(v) => updateRow(row.key, { unit: v })}
                  options={[
                    ...Object.entries(UNITS).map(([v, l]) => ({ value: v, label: l })),
                    { value: OTHER, label: 'Other' },
                  ]}
                />
                {row.unit === OTHER && (
                  <Field
                    label="Specify unit"
                    required
                    value={row.unitOther}
                    onChangeText={(v) => updateRow(row.key, { unitOther: v })}
                  />
                )}
              </Card>
            ))}

            <Button
              title="Add another product row"
              icon="add-circle-outline"
              variant="outline"
              onPress={() => setRows((prev) => [...prev, makeRow()])}
            />
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Button
              title={
                savingProgress ||
                (costSummary.paidCount > 0
                  ? `Pay ${peso(costSummary.paidCount)} & add ${rows.length} products`
                  : `Add ${rows.length} products`)
              }
              icon="checkmark-done-outline"
              loading={Boolean(savingProgress)}
              onPress={handleSubmit}
            />
          </View>
        </KeyboardAvoidingView>
      )}

      <DemoPaymentModal config={paymentConfig} onClose={() => setPaymentConfig(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  addRowText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  costBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(27, 67, 41, 0.16)',
  },
  costBannerWarn: {
    backgroundColor: COLORS.warnBg,
    borderColor: 'rgba(180, 83, 9, 0.25)',
  },
  costText: { flex: 1, fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.primaryDark, lineHeight: 18 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
  },
  rowTitle: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.primaryDark },
  removeRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.badBg,
  },
  removeRowText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.bad },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoWrap: { position: 'relative' },
  thumb: { width: 76, height: 76, borderRadius: RADIUS.md, backgroundColor: COLORS.mutedBg },
  clearPhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.bad,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  photoBtn: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoBtnText: { fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.primary },
  twoCol: { flexDirection: 'row', gap: 10 },
  chipLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 4 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
});
