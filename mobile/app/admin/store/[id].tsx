import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { CATS, formatHours, PAY } from '../../../lib/constants';
import { adminApproveStore, adminReviewPermit, adminSetStoreStatus, adminStatus, PERMITS } from '../../../lib/seller';
import { adminRestoreSuspendedStore } from '../../../lib/admin';
import { Button, Card, ScreenHeader, SectionLabel, StatusPill } from '../../../components/ui';
import { DocCard } from '../../../components/DocCard';
import { reviewStyles as styles } from '../../../components/reviewStyles';
import { COLORS, FONTS, RADIUS } from '../../../lib/theme';

type Mode = { kind: 'doc'; type: string; label: string } | { kind: 'clarify' } | { kind: 'decline' } | { kind: 'accept' };

function modeTitle(m: Mode | null) {
  if (!m) return '';
  if (m.kind === 'doc') return `Decline ${m.label}`;
  if (m.kind === 'clarify') return 'Ask owner to clarify';
  if (m.kind === 'decline') return 'Decline this store';
  return 'Approve this store';
}

export default function AdminStoreReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('stores').select('*').eq('id', String(id)).maybeSingle();
    setStore(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      await load();
      if (done) Alert.alert('Done', done);
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const open = (m: Mode) => {
    setNote('');
    setMode(m);
  };

  const submit = async () => {
    if (!mode || !store) return;
    const text = note.trim();
    if (mode.kind !== 'accept' && !text) {
      Alert.alert('Note required', 'Add a short note so the owner knows what to fix.');
      return;
    }
    const m = mode;
    setMode(null);
    if (m.kind === 'doc') await run(`doc-${m.type}`, () => adminReviewPermit(store.id, m.type, 'REJECT', text));
    else if (m.kind === 'clarify') await run('clarify', () => adminSetStoreStatus(store.id, 'PENDING', text), 'Owner was asked to clarify.');
    else if (m.kind === 'decline') await run('decline', () => adminSetStoreStatus(store.id, 'REJECTED', text), 'Store declined.');
    else await run('accept', () => adminApproveStore(store.id, text || null), 'Store approved and now live.');
  };

  const confirmRestoreStore = () => {
    if (!store) return;
    Alert.alert(
      'Restore suspended store?',
      `Lift the suspension on "${store.business_name}"? If all permits are approved, it will return to Verified status; otherwise it will return to Pending review.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore store',
          onPress: () => run('restore', () => adminRestoreSuspendedStore(store), 'Store suspension lifted.'),
        },
      ]
    );
  };

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
        <ScreenHeader title="Store not found" />
      </View>
    );
  }

  const st = adminStatus(store);
  const isSuspended = Boolean(store.is_suspended);
  const allOk = PERMITS.every((p) => store[p.statusColumn] === 'APPROVED');
  const decided = !isSuspended && store.approval_status === 'APPROVED';
  const purokText = store.purok ? (/^\d+$/.test(String(store.purok).trim()) ? `Purok ${String(store.purok).trim()}` : store.purok) : null;
  const address = [purokText, store.barangay, 'Trento'].filter(Boolean).join(', ');
  const payments = (store.accepted_payments || []).map((p: string) => PAY[p] || p).join(', ');

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader title={store.business_name} subtitle={store.trn_code} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 165 }}>
        {store.storefront_image_url ? (
          <Pressable onPress={() => setPreview(store.storefront_image_url)}>
            <Image source={{ uri: store.storefront_image_url }} style={styles.cover} />
          </Pressable>
        ) : null}
        <View style={styles.pillRow}>
          <StatusPill label={st.label} tone={st.tone} />
          <StatusPill label={allOk ? 'All permits approved' : 'Permits need review'} tone={allOk ? 'ok' : 'info'} />
          {store.marketplace_removed_at ? <StatusPill label="Hidden from marketplace" tone="bad" /> : null}
        </View>

        {isSuspended ? (
          <View
            style={{
              backgroundColor: COLORS.badBg,
              borderRadius: RADIUS.md,
              padding: 12,
              marginTop: 10,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.bad }}>
              Store is currently suspended
            </Text>
            {store.suspension_reason ? (
              <Text style={{ fontSize: 12, fontFamily: FONTS.medium, color: COLORS.bad }}>
                Reason: {store.suspension_reason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {store.admin_notes ? <Text style={styles.adminNote}>Last note: {store.admin_notes}</Text> : null}

        <SectionLabel>Admin shortcuts</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Products & caps"
            icon="pricetag-outline"
            variant="soft"
            small
            onPress={() =>
              router.push({
                pathname: '/admin/marketplace',
                params: { kind: 'products', q: store.business_name },
              })
            }
            style={{ flex: 1 }}
          />
          {store.user_id ? (
            <Button
              title="Moderate owner"
              icon="shield-outline"
              variant="outline"
              small
              onPress={() =>
                router.push({
                  pathname: '/admin/accounts',
                  params: { userId: String(store.user_id) },
                })
              }
              style={{ flex: 1 }}
            />
          ) : null}
        </View>

        <SectionLabel>Business details</SectionLabel>
        <Card style={{ paddingVertical: 4 }}>
          <Info label="Type" value={CATS[store.trade_category] || store.trade_category} />
          <Info label="Owner" value={store.proprietor_name} />
          <Info label="Contact" value={store.contact_number} onPress={() => Linking.openURL(`tel:${store.contact_number}`)} />
          <Info label="Address" value={address} />
          <Info label="Landmark" value={store.landmark_reference} />
          <Info label="Hours" value={formatHours(store)} />
          <Info label="Payments" value={payments} />
          <Info
            label="Map"
            value={store.lat != null ? 'Open in Google Maps' : 'No pin'}
            onPress={store.lat != null ? () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`) : undefined}
            last
          />
        </Card>
        {store.description ? <Text style={styles.desc}>{store.description}</Text> : null}

        <SectionLabel>Permits</SectionLabel>
        <View style={{ gap: 10 }}>
          {PERMITS.map((p) => (
            <DocCard
              key={p.type}
              label={p.label}
              url={store[p.column]}
              status={store[p.statusColumn]}
              note={store[p.noteColumn]}
              canReview={!decided && !isSuspended}
              busy={busy === `doc-${p.type}`}
              onPreview={setPreview}
              onAccept={() => run(`doc-${p.type}`, () => adminReviewPermit(store.id, p.type, 'APPROVE', null))}
              onDecline={() => open({ kind: 'doc', type: p.type, label: p.label })}
            />
          ))}
        </View>
      </ScrollView>

      {isSuspended ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.footerHint}>Restoring lifts the store suspension immediately.</Text>
          <Button
            title="Restore suspended store"
            icon="refresh"
            loading={busy === 'restore'}
            onPress={confirmRestoreStore}
          />
        </View>
      ) : !decided ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!allOk ? <Text style={styles.footerHint}>Approve all 3 permits to unlock store approval.</Text> : null}
          <Button title="Approve store" icon="shield-checkmark" disabled={!allOk} loading={busy === 'accept'} onPress={() => open({ kind: 'accept' })} />
          {store.approval_status !== 'REJECTED' ? (
            <View style={[styles.btnRow, { marginTop: 8 }]}>
              <Button title="Ask to clarify" variant="outline" small loading={busy === 'clarify'} onPress={() => open({ kind: 'clarify' })} style={{ flex: 1 }} />
              <Button title="Decline store" variant="danger" small loading={busy === 'decline'} onPress={() => open({ kind: 'decline' })} style={{ flex: 1 }} />
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBg} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" /> : null}
          <View style={[styles.previewClose, { top: insets.top + 12 }]}>
            <Ionicons name="close" size={22} color={COLORS.white} />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!mode} transparent animationType="slide" onRequestClose={() => setMode(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMode(null)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{modeTitle(mode)}</Text>
          <Text style={styles.small}>{mode?.kind === 'accept' ? 'Optional note for the owner.' : 'The owner will see this note.'}</Text>
          <TextInput value={note} onChangeText={setNote} multiline placeholder="Write a short note..." placeholderTextColor={COLORS.muted} style={styles.sheetInput} />
          <View style={styles.btnRow}>
            <Button title="Back" variant="outline" onPress={() => setMode(null)} style={{ flex: 1 }} />
            <Button title={mode?.kind === 'accept' ? 'Approve' : 'Submit'} variant={mode?.kind === 'accept' ? 'primary' : 'danger'} onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Info({ label, value, onPress, last }: { label: string; value?: string | null; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.info, !last && styles.infoBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, onPress ? { color: COLORS.primary } : null]} numberOfLines={2}>
        {value || '—'}
      </Text>
    </Pressable>
  );
}
