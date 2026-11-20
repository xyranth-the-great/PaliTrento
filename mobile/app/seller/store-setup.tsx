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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { BARANGAYS, CATS, PAY } from '../../lib/constants';
import { Store } from '../../lib/data';
import { canManageProducts, getMyStore, PERMITS, saveStore, uploadStoreImage } from '../../lib/seller';
import { Button, Card, Chip, ChipGroup, Field, ScreenHeader, SectionLabel, StatusPill } from '../../components/ui';
import { MapPicker } from '../../components/MapPicker';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow photo access to upload images.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  return res.canceled ? null : res.assets[0].uri;
}

export default function StoreSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [existing, setExisting] = useState<(Store & Record<string, any>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [proprietor, setProprietor] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [barangay, setBarangay] = useState('');
  const [purok, setPurok] = useState('');
  const [landmark, setLandmark] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [openTime, setOpenTime] = useState('07:00');
  const [closeTime, setCloseTime] = useState('19:00');
  const [payments, setPayments] = useState<string[]>(['CASH']);
  const [storefront, setStorefront] = useState<{ uri: string; local: boolean } | null>(null);
  const [permits, setPermits] = useState<Record<string, { uri: string; local: boolean } | null>>({});

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const s = await getMyStore(session.user.id);
      if (s) {
        setExisting(s);
        setBusinessName(s.business_name || '');
        setCategory(s.trade_category || '');
        setProprietor(s.proprietor_name || '');
        setDescription(s.description || '');
        setContact(s.contact_number || '');
        setBarangay(s.barangay || '');
        setPurok(s.purok || '');
        setLandmark(s.landmark_reference || '');
        setLat(s.lat ?? null);
        setLng(s.lng ?? null);
        setOpenTime((s.open_time || '07:00').slice(0, 5));
        setCloseTime((s.close_time || '19:00').slice(0, 5));
        setPayments(Array.isArray(s.accepted_payments) && s.accepted_payments.length ? s.accepted_payments : ['CASH']);
        if (s.storefront_image_url) setStorefront({ uri: s.storefront_image_url, local: false });
        const p: Record<string, { uri: string; local: boolean } | null> = {};
        PERMITS.forEach((pm) => {
          const url = s[pm.column] as string | null | undefined;
          p[pm.type] = url ? { uri: url, local: false } : null;
        });
        setPermits(p);
      }
      setLoading(false);
    })();
  }, [session?.user?.id]);

  const togglePayment = (key: string) =>
    setPayments((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));

  const handleSubmit = async () => {
    if (!session?.user?.id) return;
    const missing: string[] = [];
    if (!businessName.trim()) missing.push('business name');
    if (!category) missing.push('category');
    if (!proprietor.trim()) missing.push('owner name');
    if (!contact.trim()) missing.push('contact number');
    if (!barangay) missing.push('barangay');
    if (!landmark.trim()) missing.push('landmark');
    if (lat == null || lng == null) missing.push('map location');
    if (!payments.length) missing.push('payment method');
    if (missing.length) {
      Alert.alert('Missing details', `Please add: ${missing.join(', ')}.`);
      return;
    }
    if (!TIME_RE.test(openTime) || !TIME_RE.test(closeTime)) {
      Alert.alert('Check your hours', 'Use 24-hour format like 07:00 and 19:00.');
      return;
    }
    const missingPermits = PERMITS.filter((pm) => !permits[pm.type]);
    if (!existing && missingPermits.length) {
      Alert.alert('Permits required', `Please upload: ${missingPermits.map((p) => p.label).join(', ')}.`);
      return;
    }

    setSaving(true);
    try {
      const uid = session.user.id;
      let storefrontUrl = storefront && !storefront.local ? storefront.uri : existing?.storefront_image_url || null;
      if (storefront?.local) storefrontUrl = await uploadStoreImage(uid, storefront.uri, 'storefront');

      const permitCols: Record<string, string | null> = {};
      for (const pm of PERMITS) {
        const v = permits[pm.type];
        if (v?.local) permitCols[pm.column] = await uploadStoreImage(uid, v.uri, pm.uploadFolder);
        else permitCols[pm.column] = v?.uri || existing?.[pm.column] || null;
      }

      const { isApprovedUpdate } = await saveStore(uid, existing, {
        business_name: businessName.trim(),
        trade_category: category,
        proprietor_name: proprietor.trim(),
        description: description.trim() || null,
        contact_number: contact.trim(),
        barangay,
        purok: purok.trim() || null,
        landmark_reference: landmark.trim(),
        lat,
        lng,
        open_time: openTime,
        close_time: closeTime,
        accepted_payments: payments,
        storefront_image_url: storefrontUrl,
        ...permitCols,
      });

      Alert.alert(
        isApprovedUpdate ? 'Store updated' : 'Submitted for review',
        isApprovedUpdate
          ? 'Your changes are saved. Your approval stays active.'
          : 'Admin will review your store within 3–5 business days.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Could not save store', e?.message || 'Please try again.');
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

  const approved = canManageProducts(existing);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader title={existing ? 'Edit store' : 'Set up your store'} subtitle={existing ? existing.trn_code : 'Admin reviews new stores in 3–5 days'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <SectionLabel>Storefront photo</SectionLabel>
          <Pressable
            onPress={async () => {
              const uri = await pickImage();
              if (uri) setStorefront({ uri, local: true });
            }}
            style={styles.cover}
          >
            {storefront ? (
              <Image source={{ uri: storefront.uri }} style={styles.coverImg} />
            ) : (
              <View style={styles.coverEmpty}>
                <Ionicons name="camera-outline" size={26} color={COLORS.primary} />
                <Text style={styles.coverText}>Add a photo of your store front</Text>
              </View>
            )}
            {storefront ? (
              <View style={styles.coverEdit}>
                <Ionicons name="create-outline" size={14} color={COLORS.white} />
                <Text style={styles.coverEditText}>Change</Text>
              </View>
            ) : null}
          </Pressable>

          <SectionLabel>Business</SectionLabel>
          <Card>
            <Field label="Business name" required value={businessName} onChangeText={setBusinessName} placeholder="e.g. Aling Nena Sari-sari Store" />
            <Text style={styles.label}>Type of business *</Text>
            <ChipGroup value={category} onChange={setCategory} options={Object.entries(CATS).map(([v, l]) => ({ value: v, label: l }))} />
            <View style={{ height: 12 }} />
            <Field label="Owner / proprietor" required value={proprietor} onChangeText={setProprietor} />
            <Field label="Contact number" required value={contact} onChangeText={setContact} keyboardType="phone-pad" placeholder="09XX XXX XXXX" />
            <Field label="Short description" value={description} onChangeText={setDescription} multiline placeholder="What do you sell? What makes your store special?" />
          </Card>

          <SectionLabel>Location</SectionLabel>
          <Card>
            <Text style={styles.label}>Barangay *</Text>
            <ChipGroup value={barangay} onChange={setBarangay} options={BARANGAYS.map((b) => ({ value: b, label: b }))} />
            <View style={{ height: 12 }} />
            <Field label="Purok" value={purok} onChangeText={setPurok} placeholder="e.g. 3" />
            <Field label="Landmark" required value={landmark} onChangeText={setLandmark} placeholder="e.g. Beside the barangay hall" />
            <Text style={styles.label}>Pin on map *</Text>
            <MapPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
          </Card>

          <SectionLabel>Hours & payments</SectionLabel>
          <Card>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Opens" required value={openTime} onChangeText={setOpenTime} placeholder="07:00" maxLength={5} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Closes" required value={closeTime} onChangeText={setCloseTime} placeholder="19:00" maxLength={5} />
              </View>
            </View>
            <Text style={styles.label}>Accepted payments *</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Object.entries(PAY).map(([k, l]) => (
                <Chip key={k} label={l} icon={payments.includes(k) ? 'checkmark-circle' : undefined} active={payments.includes(k)} onPress={() => togglePayment(k)} />
              ))}
            </View>
          </Card>

          <SectionLabel>Permits</SectionLabel>
          <Card style={{ gap: 10 }}>
            <Text style={styles.hint}>
              {approved
                ? 'Your permits are approved. Uploading a new file sends it for review again.'
                : 'Upload a clear photo of each document. Admin verifies them before approving your store.'}
            </Text>
            {PERMITS.map((pm) => {
              const v = permits[pm.type];
              const status = existing?.[pm.statusColumn];
              const note = existing?.[pm.noteColumn];
              return (
                <View key={pm.type} style={styles.permitRow}>
                  {v ? (
                    <Image source={{ uri: v.uri }} style={styles.permitThumb} />
                  ) : (
                    <View style={[styles.permitThumb, styles.permitEmpty]}>
                      <Ionicons name="document-text-outline" size={20} color={COLORS.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.permitLabel}>{pm.label}</Text>
                    {v?.local ? (
                      <StatusPill label="New file selected" tone="info" />
                    ) : status ? (
                      <StatusPill label={status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Under review'} tone={status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'bad' : 'warn'} />
                    ) : (
                      <Text style={styles.hint}>{v ? 'Uploaded' : 'Required'}</Text>
                    )}
                    {note && !v?.local ? <Text style={styles.hint}>Admin note: {note}</Text> : null}
                  </View>
                  <Button
                    title={v ? 'Replace' : 'Upload'}
                    variant="soft"
                    small
                    onPress={async () => {
                      const uri = await pickImage();
                      if (uri) setPermits((prev) => ({ ...prev, [pm.type]: { uri, local: true } }));
                    }}
                  />
                </View>
              );
            })}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title={existing ? (approved ? 'Save changes' : 'Resubmit for review') : 'Submit for review'}
          icon="send"
          loading={saving}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  label: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 8 },
  hint: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 16 },
  cover: { height: 160, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primarySoft },
  coverText: { fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.primary },
  coverEdit: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(17,29,21,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  coverEditText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.white },
  permitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.lineSubtle },
  permitThumb: { width: 54, height: 54, borderRadius: RADIUS.sm, backgroundColor: COLORS.mutedBg },
  permitEmpty: { alignItems: 'center', justifyContent: 'center' },
  permitLabel: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.ink },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line },
});
