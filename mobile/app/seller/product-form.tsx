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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, UNITS } from '../../lib/constants';
import { getProductImages, Product, Store } from '../../lib/data';
import { createProduct, getMyStore, getStoreProducts, updateProduct } from '../../lib/seller';
import { Button, Card, ChipGroup, Field, ScreenHeader, SectionLabel } from '../../components/ui';
import { DemoPaymentConfig, DemoPaymentModal } from '../../components/DemoPaymentModal';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const OTHER = '__OTHER__';

type Photo = { uri: string; existing: boolean };

export default function ProductFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ id?: string; paid?: string }>();
  const editingId = params.id ? String(params.id) : null;
  const isPaidListing = params.paid === '1';
  const isAdmin = profile?.role === 'admin';

  const [store, setStore] = useState<(Store & Record<string, any>) | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOther, setCategoryOther] = useState('');
  const [unit, setUnit] = useState('');
  const [unitOther, setUnitOther] = useState('');
  const [price, setPrice] = useState('');
  const [cap, setCap] = useState('');
  const [inStock, setInStock] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<DemoPaymentConfig | null>(null);

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const s = await getMyStore(session.user.id);
      setStore(s);
      if (s && editingId) {
        const list = await getStoreProducts(s.id);
        const p = list.find((x) => x.id === editingId) || null;
        setProduct(p);
        if (p) {
          setName(p.name);
          if ((PRODUCT_CATEGORIES as readonly string[]).includes(p.category)) setCategory(p.category);
          else {
            setCategory(OTHER);
            setCategoryOther(p.category);
          }
          if (UNITS[p.unit]) setUnit(p.unit);
          else {
            setUnit(OTHER);
            setUnitOther(p.unit);
          }
          setPrice(String(p.current_price ?? ''));
          setCap(p.lgu_srp_ceiling != null ? String(p.lgu_srp_ceiling) : '');
          setInStock(p.in_stock !== false);
          setQuantity(p.quantity != null ? String(p.quantity) : '');
          setPhotos(getProductImages(p).map((uri) => ({ uri, existing: true })));
        }
      }
      setLoading(false);
    })();
  }, [editingId, session?.user?.id]);

  const pickPhotos = async () => {
    const remaining = 3 - photos.length;
    if (remaining <= 0) {
      Alert.alert('Maximum reached', 'You can add up to 3 photos per product.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add product pictures.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });
    if (res.canceled) return;
    setPhotos((prev) => [...prev, ...res.assets.map((a) => ({ uri: a.uri, existing: false }))].slice(0, 3));
  };

  const takePhoto = async () => {
    if (photos.length >= 3) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take product pictures.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (res.canceled) return;
    setPhotos((prev) => [...prev, { uri: res.assets[0].uri, existing: false }].slice(0, 3));
  };

  const handleSave = async () => {
    if (!store || !session?.user?.id) return;
    const finalCategory = category === OTHER ? categoryOther.trim() : category;
    const finalUnit = unit === OTHER ? unitOther.trim() : unit;
    const priceNum = parseFloat(price);

    if (!name.trim() || !finalCategory || !finalUnit || Number.isNaN(priceNum)) {
      Alert.alert('Missing details', 'Please fill in name, category, unit, and price.');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Add a photo', 'Please add at least one product picture.');
      return;
    }

    const input = {
      name: name.trim(),
      category: finalCategory,
      unit: finalUnit,
      current_price: priceNum,
      in_stock: inStock,
      quantity: quantity.trim() ? parseInt(quantity, 10) : null,
      ...(isAdmin ? { lgu_srp_ceiling: cap.trim() ? parseFloat(cap) : null } : {}),
    };

    const newUris = photos.filter((p) => !p.existing).map((p) => p.uri);

    // Extra listing beyond 15 free requires ₱1 demo QR payment (mirrors dashboard.js)
    if (!product && isPaidListing) {
      setPaymentConfig({
        amount: 1,
        title: 'Additional product listing',
        description: `You've used all 15 free listings. Add “${input.name}” for ₱1, or upgrade to Premium for unlimited listings.`,
        successMessage: 'Your product has been added successfully.',
        onPay: async () => {
          await createProduct(session.user.id, store.id, input, newUris, true);
        },
        onDone: () => router.back(),
      });
      return;
    }

    setSaving(true);
    try {
      if (product) {
        const kept = photos.filter((p) => p.existing).map((p) => p.uri);
        await updateProduct(session.user.id, store.id, product, input, kept, newUris);
      } else {
        await createProduct(session.user.id, store.id, input, newUris, false);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title={product ? 'Edit product' : 'Add product'}
        subtitle={isPaidListing && !product ? 'Paid listing • ₱1 demo payment' : store?.business_name}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <SectionLabel>Photos (up to 3)</SectionLabel>
          <Card>
            <View style={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={`${p.uri}-${i}`} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photo} />
                  {i === 0 ? (
                    <View style={styles.coverTag}>
                      <Text style={styles.coverTagText}>Cover</Text>
                    </View>
                  ) : null}
                  <Pressable onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} style={styles.removeBtn} hitSlop={6}>
                    <Ionicons name="close" size={14} color={COLORS.white} />
                  </Pressable>
                </View>
              ))}
              {photos.length < 3 ? (
                <Pressable onPress={pickPhotos} style={styles.addPhoto}>
                  <Ionicons name="images-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </Pressable>
              ) : null}
              {photos.length < 3 ? (
                <Pressable onPress={takePhoto} style={styles.addPhoto}>
                  <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>

          <SectionLabel>Details</SectionLabel>
          <Card>
            <Field label="Product name" required value={name} onChangeText={setName} placeholder="e.g. Dinorado rice" />

            <Text style={styles.label}>Category *</Text>
            <ChipGroup
              value={category}
              onChange={setCategory}
              options={[
                ...PRODUCT_CATEGORIES.map((c) => ({ value: c, label: PRODUCT_CATEGORY_LABELS[c] || c })),
                { value: OTHER, label: 'Other' },
              ]}
            />
            {category === OTHER ? (
              <View style={{ marginTop: 10 }}>
                <Field label="Specify category" required value={categoryOther} onChangeText={setCategoryOther} />
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: 14 }]}>Unit *</Text>
            <ChipGroup
              value={unit}
              onChange={setUnit}
              options={[...Object.entries(UNITS).map(([v, l]) => ({ value: v, label: l })), { value: OTHER, label: 'Other' }]}
            />
            {unit === OTHER ? (
              <View style={{ marginTop: 10 }}>
                <Field label="Specify unit" required value={unitOther} onChangeText={setUnitOther} />
              </View>
            ) : null}
          </Card>

          <SectionLabel>Price & stock</SectionLabel>
          <Card>
            <Field label="Price (₱)" required value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
            {isAdmin ? (
              <Field label="LGU price cap (₱)" value={cap} onChangeText={setCap} keyboardType="decimal-pad" hint="Admins only. Leave empty for no cap." />
            ) : null}
            <Text style={styles.label}>Availability</Text>
            <ChipGroup
              value={inStock ? 'yes' : 'no'}
              onChange={(v) => setInStock(v === 'yes')}
              options={[
                { value: 'yes', label: 'In stock' },
                { value: 'no', label: 'Out of stock' },
              ]}
            />
            <View style={{ marginTop: 12 }}>
              <Field label="Quantity available" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" hint="Optional. Leave empty if you don't track quantity." />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title={product ? 'Save changes' : isPaidListing ? 'Pay ₱1 & add product' : 'Add product'}
          icon={product ? 'checkmark' : 'add'}
          loading={saving}
          onPress={handleSave}
        />
      </View>

      <DemoPaymentModal config={paymentConfig} onClose={() => setPaymentConfig(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  label: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { position: 'relative' },
  photo: { width: 92, height: 92, borderRadius: RADIUS.md, backgroundColor: COLORS.mutedBg },
  coverTag: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(17,29,21,0.75)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  coverTagText: { fontSize: 9.5, fontFamily: FONTS.bold, color: '#FBC14E' },
  removeBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.bad, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  addPhoto: { width: 92, height: 92, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.primary },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line },
});
