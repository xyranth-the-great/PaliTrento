import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteMyAccount, deleteMyStore } from '../../lib/settings';
import { Button, SectionLabel } from '../ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

interface Props {
  userId?: string;
  role?: string | null;
  onRefreshProfile: () => Promise<void>;
}

type ConfirmKind = 'account' | 'store' | null;

export function DangerZoneTab({ userId, role, onRefreshProfile }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAdmin = role === 'admin';
  const isBusinessOwner = role === 'business_owner';

  const [ackAccount, setAckAccount] = useState(false);
  const [ackStore, setAckStore] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [typedText, setTypedText] = useState('');
  const [busy, setBusy] = useState(false);

  const requiredPhrase = confirmKind === 'store' ? 'DELETE STORE' : 'DELETE';
  const phraseMatches = typedText.trim() === requiredPhrase;

  const openConfirm = (kind: ConfirmKind) => {
    setTypedText('');
    setConfirmKind(kind);
  };

  const handleConfirm = async () => {
    if (!confirmKind || !phraseMatches) return;

    if (confirmKind === 'account') {
      if (isAdmin) {
        Alert.alert('Restricted', 'Admin accounts cannot be deleted from Settings.');
        return;
      }
      setBusy(true);
      try {
        await deleteMyAccount();
        setConfirmKind(null);
        Alert.alert('Account deleted', 'Your account and associated data have been permanently deleted.');
        router.replace('/(auth)/login');
      } catch (e: any) {
        Alert.alert('Deletion failed', e?.message || 'Could not delete your account.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (confirmKind === 'store') {
      if (isAdmin || !userId) {
        Alert.alert('Restricted', 'Admin accounts cannot delete stores from Settings.');
        return;
      }
      setBusy(true);
      try {
        await deleteMyStore(userId);
        await onRefreshProfile();
        setConfirmKind(null);
        setAckStore(false);
        Alert.alert('Store deleted', 'Your store listing and products have been permanently removed.');
        router.replace('/(tabs)/account');
      } catch (e: any) {
        Alert.alert('Deletion failed', e?.message || 'Could not delete your store.');
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <View>
      <SectionLabel>Irreversible Actions</SectionLabel>
      <View style={styles.dangerCard}>
        <View style={styles.dangerHead}>
          <Ionicons name="warning" size={20} color={COLORS.bad} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.dangerSub}>
              Actions below are permanent and cannot be undone. Please review carefully.
            </Text>
          </View>
        </View>

        {/* Delete Account */}
        <View style={styles.section}>
          <Text style={styles.blockTitle}>Delete Account</Text>
          <Text style={styles.blockText}>
            Permanently deletes your profile, order history, chat messages, store listings (if business owner), and uploaded photos.
          </Text>

          {isAdmin ? (
            <View style={styles.disabledNote}>
              <Ionicons name="shield-outline" size={15} color={COLORS.bad} />
              <Text style={styles.disabledNoteText}>
                Admin accounts cannot be deleted from Settings.
              </Text>
            </View>
          ) : (
            <>
              <CheckboxRow
                checked={ackAccount}
                onToggle={() => setAckAccount((v) => !v)}
                label="I understand this is permanent"
              />
              <Button
                title="Delete my account"
                icon="trash-outline"
                variant="danger"
                disabled={!ackAccount}
                onPress={() => openConfirm('account')}
              />
            </>
          )}
        </View>

        {/* Delete Store */}
        <View style={[styles.section, styles.sectionLast]}>
          <Text style={styles.blockTitle}>Delete Store (Business Owners Only)</Text>
          <Text style={styles.blockText}>
            Permanently deletes your store listing and all products. Existing order and chat history for buyers will remain.
          </Text>

          {isAdmin ? (
            <View style={styles.disabledNote}>
              <Ionicons name="shield-outline" size={15} color={COLORS.bad} />
              <Text style={styles.disabledNoteText}>
                Admin accounts cannot delete stores from Settings.
              </Text>
            </View>
          ) : !isBusinessOwner ? (
            <View style={styles.disabledNote}>
              <Ionicons name="information-circle-outline" size={15} color={COLORS.muted} />
              <Text style={[styles.disabledNoteText, { color: COLORS.muted }]}>
                Only available for business owner accounts with a store listing.
              </Text>
            </View>
          ) : (
            <>
              <CheckboxRow
                checked={ackStore}
                onToggle={() => setAckStore((v) => !v)}
                label="I understand this is permanent"
              />
              <Button
                title="Delete my store"
                icon="storefront-outline"
                variant="danger"
                disabled={!ackStore}
                onPress={() => openConfirm('store')}
              />
            </>
          )}
        </View>
      </View>

      {/* Typed Confirmation Modal */}
      <Modal
        visible={Boolean(confirmKind)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setConfirmKind(null);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => {
              if (!busy) setConfirmKind(null);
            }}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>
              {confirmKind === 'store' ? 'Confirm store deletion' : 'Confirm account deletion'}
            </Text>
            <Text style={styles.sheetSub}>
              {confirmKind === 'store'
                ? 'This will permanently delete your store and all of its products. Type DELETE STORE below to continue.'
                : 'FINAL WARNING: This will permanently delete your account and ALL associated data. Type DELETE below to continue.'}
            </Text>

            <Text style={styles.fieldLabel}>
              Type <Text style={{ color: COLORS.bad }}>{requiredPhrase}</Text> to confirm
            </Text>
            <TextInput
              value={typedText}
              onChangeText={setTypedText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={requiredPhrase}
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                disabled={busy}
                onPress={() => setConfirmKind(null)}
                style={{ flex: 1 }}
              />
              <Button
                title={confirmKind === 'store' ? 'Delete store' : 'Delete account'}
                variant="danger"
                disabled={!phraseMatches || busy}
                loading={busy}
                onPress={handleConfirm}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function CheckboxRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow}>
      <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
        {checked ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dangerCard: {
    backgroundColor: COLORS.badBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#F3C3C3',
    padding: 15,
    gap: 14,
  },
  dangerHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3C3C3',
  },
  dangerTitle: { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.bad },
  dangerSub: { fontSize: 12, fontFamily: FONTS.medium, color: '#8F2929', marginTop: 2, lineHeight: 17 },
  section: {
    gap: 9,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3C3C3',
  },
  sectionLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  blockTitle: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.bad },
  blockText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 17.5 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.bad,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: { backgroundColor: COLORS.bad },
  checkLabel: { flex: 1, fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.ink },
  disabledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: RADIUS.sm,
    padding: 10,
  },
  disabledNoteText: { flex: 1, fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.bad },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17,29,21,0.5)',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 18,
    paddingTop: 10,
    ...SHADOW.floating,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17.5, fontFamily: FONTS.extrabold, color: COLORS.bad },
  sheetSub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.inkSecondary, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  input: {
    height: 46,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    fontSize: 14.5,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: 1,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
