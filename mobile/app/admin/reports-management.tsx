import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AdminBusinessReport,
  adminGetAllReports,
  AdminProductReport,
  adminUpdateReportStatus,
  BUSINESS_REPORT_REASON_LIST,
  formatAdminDate,
  PRODUCT_REPORT_REASON_LIST,
  REPORT_REASON_LABELS,
  REPORT_STATUS_META,
} from '../../lib/admin';
import { Button, Card, Chip, EmptyState, ScreenHeader, StatusPill } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

type ReportTab = 'business' | 'product';

export default function AdminReportsManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<ReportTab>(params.tab === 'product' ? 'product' : 'business');
  const [businessReports, setBusinessReports] = useState<AdminBusinessReport[]>([]);
  const [productReports, setProductReports] = useState<AdminProductReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('');

  // Modal state
  const [selected, setSelected] = useState<
    { type: 'BUSINESS'; report: AdminBusinessReport } | { type: 'PRODUCT'; report: AdminProductReport } | null
  >(null);
  const [notes, setNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab === 'product' || params.tab === 'business') {
      setTab(params.tab);
      setReasonFilter('');
    }
  }, [params.tab]);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      const res = await adminGetAllReports();
      setBusinessReports(res.businessReports);
      setProductReports(res.productReports);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openBusinessCount = useMemo(
    () => businessReports.filter((r) => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length,
    [businessReports]
  );
  const openProductCount = useMemo(
    () => productReports.filter((r) => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length,
    [productReports]
  );

  const filteredBusiness = useMemo(() => {
    const q = search.trim().toLowerCase();
    return businessReports.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (reasonFilter && r.reason !== reasonFilter) return false;
      if (!q) return true;
      const hay = `${r.stores?.business_name || ''} ${r.stores?.trn_code || ''} ${r.profiles?.full_name || ''} ${r.profiles?.email || ''} ${r.description || ''}`;
      return hay.toLowerCase().includes(q);
    });
  }, [businessReports, reasonFilter, search, statusFilter]);

  const filteredProduct = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productReports.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (reasonFilter && r.reason !== reasonFilter) return false;
      if (!q) return true;
      const hay = `${r.products?.name || ''} ${r.stores?.business_name || ''} ${r.stores?.trn_code || ''} ${r.profiles?.full_name || ''} ${r.profiles?.email || ''} ${r.description || ''}`;
      return hay.toLowerCase().includes(q);
    });
  }, [productReports, reasonFilter, search, statusFilter]);

  const openDetail = (
    type: 'BUSINESS' | 'PRODUCT',
    report: AdminBusinessReport | AdminProductReport
  ) => {
    setNotes(report.admin_notes || '');
    setSelected(
      type === 'BUSINESS'
        ? { type: 'BUSINESS', report: report as AdminBusinessReport }
        : { type: 'PRODUCT', report: report as AdminProductReport }
    );
  };

  const handleStatusUpdate = async (newStatus: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED') => {
    if (!selected) return;
    setUpdatingStatus(newStatus);
    try {
      await adminUpdateReportStatus({
        reportType: selected.type,
        reportId: selected.report.id,
        status: newStatus,
        adminNotes: notes,
      });
      setSelected(null);
      Alert.alert('Updated', `Report marked as ${REPORT_STATUS_META[newStatus]?.label || newStatus}.`);
      await load();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update report status.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const reasonOptions = tab === 'business' ? BUSINESS_REPORT_REASON_LIST : PRODUCT_REPORT_REASON_LIST;
  const activeList = tab === 'business' ? filteredBusiness : filteredProduct;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Reports management"
        subtitle={`${openBusinessCount + openProductCount} open / under review`}
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
        {/* Segmented tabs */}
        <View style={styles.segRow}>
          <Pressable
            onPress={() => {
              setTab('business');
              setReasonFilter('');
            }}
            style={[styles.segBtn, tab === 'business' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, tab === 'business' && styles.segTextActive]}>
              Businesses ({businessReports.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTab('product');
              setReasonFilter('');
            }}
            style={[styles.segBtn, tab === 'product' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, tab === 'product' && styles.segTextActive]}>
              Products ({productReports.length})
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              tab === 'business'
                ? 'Search business, TRN, or reporter...'
                : 'Search product, store, or reporter...'
            }
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Status filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingTop: 12, paddingBottom: 6 }}
        >
          {[
            ['', 'All statuses'],
            ['OPEN', 'Open'],
            ['UNDER_REVIEW', 'Under Review'],
            ['RESOLVED', 'Resolved'],
            ['DISMISSED', 'Dismissed'],
          ].map(([val, label]) => (
            <Chip
              key={val || 'all'}
              label={label}
              active={statusFilter === val}
              onPress={() => setStatusFilter(val)}
            />
          ))}
        </ScrollView>

        {/* Reason filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 12 }}
        >
          <Chip label="All reasons" active={reasonFilter === ''} onPress={() => setReasonFilter('')} />
          {reasonOptions.map((r) => (
            <Chip
              key={r}
              label={REPORT_REASON_LABELS[r] || r}
              active={reasonFilter === r}
              onPress={() => setReasonFilter(r)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Could not load reports"
            text={errorMsg}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : activeList.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="No reports found"
            text="No user reports match your current filters."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {tab === 'business'
              ? filteredBusiness.map((r) => {
                  const st = REPORT_STATUS_META[r.status] || { label: r.status, tone: 'info' as const };
                  return (
                    <Pressable key={r.id} onPress={() => openDetail('BUSINESS', r)}>
                      <Card style={{ gap: 7 }}>
                        <View style={styles.cardHead}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>
                              {r.stores?.business_name || 'Unknown Business'}
                            </Text>
                            <Text style={styles.itemSub} numberOfLines={1}>
                              {r.stores?.trn_code || 'No TRN'} • Reporter:{' '}
                              {r.profiles?.full_name || r.profiles?.email || 'Unknown'}
                            </Text>
                          </View>
                          <StatusPill label={st.label} tone={st.tone} />
                        </View>
                        <View style={styles.reasonChip}>
                          <Ionicons name="flag" size={12} color={COLORS.bad} />
                          <Text style={styles.reasonText}>
                            {REPORT_REASON_LABELS[r.reason] || r.reason}
                          </Text>
                        </View>
                        {r.description ? (
                          <Text style={styles.descPreview} numberOfLines={2}>
                            {r.description}
                          </Text>
                        ) : null}
                        <View style={styles.cardFoot}>
                          <Text style={styles.dateText}>{formatAdminDate(r.created_at)}</Text>
                          <Text style={styles.reviewLink}>Review →</Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })
              : filteredProduct.map((r) => {
                  const st = REPORT_STATUS_META[r.status] || { label: r.status, tone: 'info' as const };
                  return (
                    <Pressable key={r.id} onPress={() => openDetail('PRODUCT', r)}>
                      <Card style={{ gap: 7 }}>
                        <View style={styles.cardHead}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>
                              {r.products?.name || 'Unknown Product'}
                            </Text>
                            <Text style={styles.itemSub} numberOfLines={1}>
                              {r.stores?.business_name || 'Unknown Store'} • Reporter:{' '}
                              {r.profiles?.full_name || r.profiles?.email || 'Unknown'}
                            </Text>
                          </View>
                          <StatusPill label={st.label} tone={st.tone} />
                        </View>
                        <View style={styles.reasonChip}>
                          <Ionicons name="flag" size={12} color={COLORS.bad} />
                          <Text style={styles.reasonText}>
                            {REPORT_REASON_LABELS[r.reason] || r.reason}
                          </Text>
                        </View>
                        {r.description ? (
                          <Text style={styles.descPreview} numberOfLines={2}>
                            {r.description}
                          </Text>
                        ) : null}
                        <View style={styles.cardFoot}>
                          <Text style={styles.dateText}>{formatAdminDate(r.created_at)}</Text>
                          <Text style={styles.reviewLink}>Review →</Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
          </View>
        )}
      </ScrollView>

      {/* Report Detail Modal */}
      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!updatingStatus) setSelected(null); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => !updatingStatus && setSelected(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.grabber} />
            {selected ? (
              <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>
                  {selected.type === 'BUSINESS'
                    ? selected.report.stores?.business_name || 'Business Report'
                    : (selected.report as AdminProductReport).products?.name || 'Product Report'}
                </Text>
                <Text style={styles.sheetSub}>
                  {selected.type === 'BUSINESS'
                    ? `TRN: ${selected.report.stores?.trn_code || '—'}`
                    : `Store: ${selected.report.stores?.business_name || 'Unknown'} (${selected.report.stores?.trn_code || '—'})`}
                  {' • '}Reporter:{' '}
                  {selected.report.profiles?.full_name ||
                    selected.report.profiles?.email ||
                    'Unknown'}
                </Text>

                <View style={styles.detailBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.detailLabel}>
                      {REPORT_REASON_LABELS[selected.report.reason] || selected.report.reason}
                    </Text>
                    <StatusPill
                      label={REPORT_STATUS_META[selected.report.status]?.label || selected.report.status}
                      tone={REPORT_STATUS_META[selected.report.status]?.tone || 'info'}
                    />
                  </View>
                  <Text style={styles.detailDesc}>
                    {selected.report.description || 'No description provided.'}
                  </Text>
                  <Text style={styles.dateText}>
                    Submitted: {formatAdminDate(selected.report.created_at)}
                    {selected.report.resolved_at
                      ? ` • Updated: ${formatAdminDate(selected.report.resolved_at)}`
                      : ''}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Administrator notes (internal)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={1000}
                  placeholder="Optional internal notes for admins..."
                  placeholderTextColor={COLORS.muted}
                  style={styles.textArea}
                />

                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Update status</Text>
                <View style={styles.actionRow}>
                  <Button
                    title="Under Review"
                    variant="soft"
                    small
                    loading={updatingStatus === 'UNDER_REVIEW'}
                    disabled={Boolean(updatingStatus)}
                    onPress={() => handleStatusUpdate('UNDER_REVIEW')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Resolve"
                    variant="primary"
                    small
                    loading={updatingStatus === 'RESOLVED'}
                    disabled={Boolean(updatingStatus)}
                    onPress={() => handleStatusUpdate('RESOLVED')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Dismiss"
                    variant="outline"
                    small
                    loading={updatingStatus === 'DISMISSED'}
                    disabled={Boolean(updatingStatus)}
                    onPress={() => handleStatusUpdate('DISMISSED')}
                    style={{ flex: 1 }}
                  />
                </View>

                <View style={styles.quickLinks}>
                  {selected.report.stores?.user_id ? (
                    <Button
                      title="Moderate owner"
                      icon="shield-outline"
                      variant="danger"
                      small
                      onPress={() => {
                        const uid = selected.report.stores?.user_id;
                        setSelected(null);
                        if (uid) {
                          router.push({ pathname: '/admin/accounts', params: { userId: uid } });
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                  <Button
                    title="Marketplace"
                    icon="storefront-outline"
                    variant="outline"
                    small
                    onPress={() => {
                      const q =
                        selected.type === 'PRODUCT'
                          ? (selected.report as AdminProductReport).products?.name || ''
                          : selected.report.stores?.business_name || '';
                      const kind = selected.type === 'PRODUCT' ? 'products' : 'stores';
                      setSelected(null);
                      router.push({ pathname: '/admin/marketplace', params: { kind, q } });
                    }}
                    style={{ flex: 1 }}
                  />
                </View>

                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setSelected(null)}
                  style={{ marginTop: 10 }}
                />
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
  segRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: COLORS.primary },
  segText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  segTextActive: { color: COLORS.white },
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
  itemTitle: { fontSize: 14.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  itemSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.badBg,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  reasonText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.bad },
  descPreview: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 18 },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
  },
  dateText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.muted },
  reviewLink: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
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
  detailBox: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    gap: 7,
    marginBottom: 14,
  },
  detailLabel: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.bad, flex: 1, paddingRight: 8 },
  detailDesc: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.ink, lineHeight: 19 },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  textArea: {
    minHeight: 78,
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
  actionRow: { flexDirection: 'row', gap: 7 },
  quickLinks: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
