import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Store } from '../../lib/data';
import {
  acknowledgeBusinessApproval,
  BusinessCompliance,
  PERMITS,
  StoreDisplayStatus,
} from '../../lib/seller';
import { Button, Card, StatusPill, Tone } from '../ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

interface VerificationTabProps {
  store: Store & Record<string, any>;
  displayStatus: StoreDisplayStatus | null;
  compliance: BusinessCompliance | null;
  onAcknowledged: () => Promise<void>;
  onOpenStoreSetup: () => void;
}

function mapTone(badgeClass?: string): Tone {
  if (badgeClass === 'ok') return 'ok';
  if (badgeClass === 'bad') return 'bad';
  if (badgeClass === 'info') return 'info';
  return 'warn';
}

export function VerificationTab({
  store,
  displayStatus,
  compliance,
  onAcknowledged,
  onOpenStoreSetup,
}: VerificationTabProps) {
  const [acking, setAcking] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ label: string; url: string } | null>(null);

  const isVerified =
    displayStatus?.status === 'VERIFIED' ||
    (store.approval_status === 'APPROVED' && store.verification_status === 'VERIFIED');

  const needsAck =
    isVerified &&
    displayStatus?.approval_notice_acknowledged !== true &&
    compliance?.approval_notice_acknowledged !== true;

  const handleAcknowledge = async () => {
    setAcking(true);
    try {
      await acknowledgeBusinessApproval(store.id);
      await onAcknowledged();
    } catch (e: any) {
      Alert.alert('Could not acknowledge', e?.message || 'Please try again.');
    } finally {
      setAcking(false);
    }
  };

  const badgeTone = mapTone(displayStatus?.badge_class || (isVerified ? 'ok' : 'warn'));
  const badgeLabel = displayStatus?.label || (isVerified ? 'Verified' : 'Pending Approval');
  const statusMsg =
    displayStatus?.message ||
    (isVerified
      ? 'Your store and all required permits have been approved.'
      : 'Your store and required permits are awaiting Admin review.');

  return (
    <View style={{ gap: 12 }}>
      {/* Marketplace Disabled Notice */}
      {store.marketplace_removed_at ? (
        <Card style={styles.disabledCard}>
          <View style={styles.rowIconTitle}>
            <Ionicons name="warning" size={18} color={COLORS.bad} />
            <Text style={styles.disabledTitle}>Store disabled in marketplace</Text>
          </View>
          <Text style={styles.disabledBody}>
            Reason: {store.marketplace_removal_reason || 'No reason provided.'}
          </Text>
        </Card>
      ) : null}

      {/* One-time Approval Acknowledgement Banner */}
      {needsAck && (
        <Card style={styles.ackCard}>
          <View style={styles.rowIconTitle}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.ok} />
            <Text style={styles.ackTitle}>Congratulations! Store Approved</Text>
          </View>
          <Text style={styles.ackBody}>
            All three permits and your store details have been approved by Admin. Your store is now
            live on PaliTrento!
          </Text>
          <Button
            title="Acknowledge"
            icon="checkmark-done-outline"
            small
            loading={acking}
            onPress={handleAcknowledge}
          />
        </Card>
      )}

      {/* Overall Verification Status Card */}
      <Card style={{ gap: 8 }}>
        <View style={styles.headRow}>
          <Text style={styles.heading}>Verification Status</Text>
          <StatusPill label={badgeLabel} tone={badgeTone} />
        </View>
        <Text style={styles.body}>{statusMsg}</Text>
        {displayStatus?.verified_at ? (
          <Text style={styles.meta}>
            Verified on{' '}
            {new Date(String(displayStatus.verified_at)).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        ) : null}
      </Card>

      {/* 3 Required Permits */}
      <Card style={{ gap: 10 }}>
        <View style={styles.headRow}>
          <Text style={styles.heading}>Required Permits (3)</Text>
          <Pressable onPress={onOpenStoreSetup} style={styles.updateLink}>
            <Text style={styles.updateLinkText}>Update</Text>
          </Pressable>
        </View>

        {PERMITS.map((permit) => {
          const url = store[permit.column] as string | null | undefined;
          const pStatus = store[permit.statusColumn] as string | null | undefined;
          const note = store[permit.noteColumn] as string | null | undefined;

          let pillLabel = 'Required';
          let pillTone: Tone = 'bad';
          if (pStatus === 'APPROVED' || (url && store.approval_status === 'APPROVED')) {
            pillLabel = 'Verified';
            pillTone = 'ok';
          } else if (pStatus === 'REJECTED') {
            pillLabel = 'Needs re-upload';
            pillTone = 'bad';
          } else if (url) {
            pillLabel = 'Submitted';
            pillTone = 'info';
          }

          return (
            <View key={permit.type} style={styles.permitRow}>
              <View style={styles.permitTop}>
                <Text style={styles.permitLabel}>{permit.label}</Text>
                <StatusPill label={pillLabel} tone={pillTone} />
              </View>
              {note ? <Text style={styles.permitNote}>Admin note: {note}</Text> : null}
              <View style={styles.permitActions}>
                {url ? (
                  <Button
                    title="View permit"
                    icon="eye-outline"
                    variant="soft"
                    small
                    onPress={() => setPreviewDoc({ label: permit.label, url })}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Button
                    title="Upload in Store Setup"
                    icon="cloud-upload-outline"
                    variant="outline"
                    small
                    onPress={onOpenStoreSetup}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          );
        })}
      </Card>

      {/* Fullscreen Document Preview Modal */}
      <Modal
        visible={Boolean(previewDoc)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewDoc(null)}
      >
        <View style={styles.previewWrap}>
          <Pressable style={styles.scrim} onPress={() => setPreviewDoc(null)} />
          {previewDoc && (
            <View style={styles.previewCard}>
              <View style={styles.headRow}>
                <Text style={styles.heading} numberOfLines={1}>
                  {previewDoc.label}
                </Text>
                <Pressable onPress={() => setPreviewDoc(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={COLORS.ink} />
                </Pressable>
              </View>
              <Image
                source={{ uri: previewDoc.url }}
                style={styles.previewImg}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  disabledCard: {
    backgroundColor: COLORS.badBg,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    gap: 6,
  },
  disabledTitle: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.bad },
  disabledBody: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.bad, lineHeight: 18 },
  ackCard: {
    backgroundColor: COLORS.okBg,
    borderColor: 'rgba(21, 128, 61, 0.3)',
    gap: 8,
  },
  rowIconTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ackTitle: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ok },
  ackBody: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.primaryDark, lineHeight: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink, flexShrink: 1 },
  body: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 19 },
  meta: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.muted },
  updateLink: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  updateLinkText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  permitRow: {
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.lineSubtle,
    gap: 8,
  },
  permitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  permitLabel: { flex: 1, fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.ink },
  permitNote: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.bad, lineHeight: 17 },
  permitActions: { flexDirection: 'row', gap: 8 },
  previewWrap: {
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
    backgroundColor: 'rgba(17,29,21,0.72)',
  },
  previewCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 16,
    gap: 12,
    ...SHADOW.floating,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: {
    width: '100%',
    height: 380,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
  },
});
