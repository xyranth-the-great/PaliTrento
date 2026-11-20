import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AdminBusinessDocument,
  adminGetBusinessDocuments,
  adminGetBusinessDocumentUrl,
  adminReviewBusinessDocument,
  DOC_STATUS_META,
  DOC_TYPE_LABELS,
  formatAdminDate,
} from '../../lib/admin';
import { Button, Card, Chip, EmptyState, ScreenHeader, StatusPill } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function AdminVerificationDocsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [docs, setDocs] = useState<AdminBusinessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [activeDoc, setActiveDoc] = useState<AdminBusinessDocument | null>(null);
  const [reviewMode, setReviewMode] = useState<'VIEW' | 'APPROVE' | 'REJECT'>('VIEW');
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      setDocs(
        await adminGetBusinessDocuments({
          documentType: typeFilter || undefined,
          status: statusFilter || undefined,
        })
      );
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load business verification documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const hay = `${d.stores?.business_name || ''} ${d.stores?.trn_code || ''} ${d.document_type} ${d.file_name || ''}`;
      return hay.toLowerCase().includes(q);
    });
  }, [docs, search]);

  const openModal = async (doc: AdminBusinessDocument, mode: 'VIEW' | 'APPROVE' | 'REJECT') => {
    setActiveDoc(doc);
    setReviewMode(mode);
    setRejectReason(doc.rejection_reason || '');
    setSignedUrl(null);
    if (doc.file_path) {
      setLoadingUrl(true);
      try {
        setSignedUrl(await adminGetBusinessDocumentUrl(doc.file_path));
      } catch {
        setSignedUrl(null);
      } finally {
        setLoadingUrl(false);
      }
    }
  };

  const handleReview = async () => {
    if (!activeDoc || reviewMode === 'VIEW') return;
    if (reviewMode === 'REJECT' && !rejectReason.trim()) {
      Alert.alert('Reason required', 'Explain why this document is being rejected.');
      return;
    }
    setSubmitting(true);
    try {
      await adminReviewBusinessDocument({
        documentId: activeDoc.id,
        action: reviewMode,
        rejectionReason: reviewMode === 'REJECT' ? rejectReason : null,
      });
      setActiveDoc(null);
      Alert.alert(
        'Document updated',
        reviewMode === 'APPROVE' ? 'Document approved.' : 'Document rejected.'
      );
      await load();
    } catch (e: any) {
      Alert.alert('Review notice', e?.message || 'Could not review this document.');
    } finally {
      setSubmitting(false);
    }
  };

  const isImage = Boolean(activeDoc?.mime_type?.startsWith('image/'));

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Verification documents"
        subtitle={`${filtered.length} document${filtered.length === 1 ? '' : 's'}`}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search store name or TRN..."
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingTop: 12, paddingBottom: 6 }}
        >
          {[
            ['', 'All types'],
            ['BARANGAY_CLEARANCE', 'Barangay Clearance'],
            ['CEDULA', 'Cedula'],
            ['BUSINESS_PERMIT', 'Business Permit'],
          ].map(([val, label]) => (
            <Chip
              key={val || 'all-types'}
              label={label}
              active={typeFilter === val}
              onPress={() => setTypeFilter(val)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 12 }}
        >
          {[
            ['', 'All statuses'],
            ['PENDING_REVIEW', 'Pending Review'],
            ['APPROVED', 'Approved'],
            ['REJECTED', 'Rejected'],
          ].map(([val, label]) => (
            <Chip
              key={val || 'all-status'}
              label={label}
              active={statusFilter === val}
              onPress={() => setStatusFilter(val)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg ? (
          <EmptyState
            icon="document-text-outline"
            title="Could not load documents"
            text={errorMsg}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title="No documents found"
            text="No business verification documents match your current filter. Permits uploaded on store submissions can also be reviewed directly from Store Verification."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((doc) => {
              const st = DOC_STATUS_META[doc.status] || { label: doc.status, tone: 'warn' as const };
              return (
                <Card key={doc.id} style={{ gap: 8 }}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.storeTitle} numberOfLines={1}>
                        {doc.stores?.business_name || 'Unknown Store'}
                      </Text>
                      <Text style={styles.docMeta} numberOfLines={1}>
                        {doc.stores?.trn_code || 'No TRN'} •{' '}
                        {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                      </Text>
                    </View>
                    <StatusPill label={st.label} tone={st.tone} />
                  </View>

                  <Text style={styles.dateText}>
                    Submitted: {formatAdminDate(doc.submitted_at)}
                    {doc.file_name ? ` • ${doc.file_name}` : ''}
                  </Text>

                  {doc.status === 'REJECTED' && doc.rejection_reason ? (
                    <View style={styles.rejectBox}>
                      <Text style={styles.rejectText}>Rejected: {doc.rejection_reason}</Text>
                    </View>
                  ) : null}

                  <View style={styles.btnRow}>
                    <Button
                      title="View file"
                      icon="eye-outline"
                      variant="outline"
                      small
                      onPress={() => openModal(doc, 'VIEW')}
                      style={{ flex: 1 }}
                    />
                    {doc.store_id ? (
                      <Button
                        title="Store review"
                        icon="storefront-outline"
                        variant="soft"
                        small
                        onPress={() =>
                          router.push({ pathname: '/admin/store/[id]', params: { id: doc.store_id } })
                        }
                        style={{ flex: 1 }}
                      />
                    ) : null}
                  </View>

                  {doc.status === 'PENDING_REVIEW' ? (
                    <View style={styles.btnRow}>
                      <Button
                        title="Approve"
                        icon="checkmark"
                        variant="primary"
                        small
                        onPress={() => openModal(doc, 'APPROVE')}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Reject"
                        icon="close"
                        variant="danger"
                        small
                        onPress={() => openModal(doc, 'REJECT')}
                        style={{ flex: 1 }}
                      />
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Document Viewer / Review Modal */}
      <Modal
        visible={Boolean(activeDoc)}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!submitting) setActiveDoc(null); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => !submitting && setActiveDoc(null)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.grabber} />
            {activeDoc ? (
              <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>
                  {reviewMode === 'APPROVE'
                    ? 'Approve document'
                    : reviewMode === 'REJECT'
                      ? 'Reject document'
                      : DOC_TYPE_LABELS[activeDoc.document_type] || activeDoc.document_type}
                </Text>
                <Text style={styles.sheetSub}>
                  {activeDoc.stores?.business_name || 'Store'} ({activeDoc.stores?.trn_code || '—'}) •{' '}
                  {DOC_TYPE_LABELS[activeDoc.document_type] || activeDoc.document_type}
                </Text>

                <View style={styles.previewBox}>
                  {loadingUrl ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : signedUrl && isImage ? (
                    <Image source={{ uri: signedUrl }} style={styles.previewImg} resizeMode="contain" />
                  ) : signedUrl ? (
                    <View style={{ alignItems: 'center', gap: 10 }}>
                      <Ionicons name="document-text-outline" size={34} color={COLORS.primary} />
                      <Text style={styles.docMeta}>
                        {activeDoc.file_name || 'Submitted PDF / Document'}
                      </Text>
                      <Button
                        title="Open document in browser"
                        icon="open-outline"
                        variant="soft"
                        small
                        onPress={() => Linking.openURL(signedUrl)}
                      />
                    </View>
                  ) : (
                    <Text style={styles.docMeta}>No preview file available.</Text>
                  )}
                </View>

                {reviewMode === 'REJECT' ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.fieldLabel}>
                      Rejection reason <Text style={{ color: COLORS.bad }}>*</Text>
                    </Text>
                    <TextInput
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                      placeholder="Explain why this document is rejected..."
                      placeholderTextColor={COLORS.muted}
                      style={styles.textArea}
                    />
                  </View>
                ) : null}

                <View style={styles.modalBtnRow}>
                  <Button
                    title="Close"
                    variant="outline"
                    disabled={submitting}
                    onPress={() => setActiveDoc(null)}
                    style={{ flex: 1 }}
                  />
                  {reviewMode === 'APPROVE' ? (
                    <Button
                      title="Approve"
                      variant="primary"
                      loading={submitting}
                      onPress={handleReview}
                      style={{ flex: 1 }}
                    />
                  ) : reviewMode === 'REJECT' ? (
                    <Button
                      title="Reject"
                      variant="danger"
                      loading={submitting}
                      onPress={handleReview}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 46,
    ...SHADOW.card,
  },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: FONTS.medium, color: COLORS.ink },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  storeTitle: { fontSize: 14.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  docMeta: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  dateText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.muted },
  rejectBox: {
    backgroundColor: COLORS.badBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rejectText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.bad },
  btnRow: { flexDirection: 'row', gap: 8 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17,29,21,0.45)',
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
  sheetTitle: { fontSize: 17.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  sheetSub: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2, marginBottom: 12 },
  previewBox: {
    minHeight: 190,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    overflow: 'hidden',
  },
  previewImg: { width: '100%', height: 240, borderRadius: RADIUS.sm },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  textArea: {
    minHeight: 80,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
