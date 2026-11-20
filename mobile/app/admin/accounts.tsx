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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  accountIsBanned,
  accountIsSuspended,
  AdminAccount,
  adminListAccounts,
  adminSubmitModeration,
  formatAdminDate,
  getAccountStatus,
  getAvailableModerationActions,
  MODERATION_ACTION_LABELS,
  MODERATION_DURATION_OPTIONS,
  ModerationActionType,
} from '../../lib/admin';
import { Button, Card, Chip, EmptyState, ScreenHeader, StatusPill, Tone } from '../../components/ui';
import { SwipeTabContent } from '../../components/SwipeTabContent';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

type StatusFilter = 'all' | 'active' | 'suspended' | 'banned';

function actionHint(action: ModerationActionType | null): string {
  switch (action) {
    case 'warn':
      return 'A warning notification will be sent to the user without restricting access.';
    case 'suspend_temporary':
      return 'Ends active sessions and blocks sign-in for the selected duration.';
    case 'suspend_permanent':
      return 'Blocks sign-in and protected data access until an administrator restores the account.';
    case 'ban':
      return 'Permanently restricts the account. Only an administrator can reverse this.';
    case 'restore':
      return 'Restores account access so the user can sign in and use PaliTrento again.';
    case 'unban':
      return 'Removes the permanent ban and restores full account access.';
    case 'remove_premium':
      return 'Ends Premium immediately and returns the account to Free plan limits.';
    default:
      return '';
  }
}

function getAccountBadge(account: AdminAccount): { label: string; tone: Tone; note?: string } {
  const suspended = accountIsSuspended(account);
  const banned = accountIsBanned(account);
  const expired = account.account_status === 'suspended' && !suspended;

  if (banned) {
    return { label: 'Banned', tone: 'bad', note: account.ban_reason || undefined };
  }
  if (suspended) {
    return {
      label: account.suspended_until ? `Suspended until ${formatAdminDate(account.suspended_until)}` : 'Suspended permanently',
      tone: 'bad',
      note: account.suspension_reason || undefined,
    };
  }
  if (expired) {
    return {
      label: 'Suspension expired',
      tone: 'warn',
      note: account.auth_banned ? 'Sign-in is still blocked in Auth.' : undefined,
    };
  }
  if (account.auth_banned) {
    return {
      label: 'Active • Sign-in blocked',
      tone: 'warn',
      note: 'Use "Clear sign-in restriction" to restore login.',
    };
  }
  return { label: 'Active', tone: 'ok' };
}

export default function AdminAccountsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string }>();
  const { session } = useAuth();

  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [focusedUserId, setFocusedUserId] = useState<string | null>(params.userId ? String(params.userId) : null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  // Moderation modal state
  const [target, setTarget] = useState<AdminAccount | null>(null);
  const [selectedAction, setSelectedAction] = useState<ModerationActionType | null>(null);
  const [durationHours, setDurationHours] = useState<number | 'custom'>(168);
  const [customDays, setCustomDays] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (params.userId) setFocusedUserId(String(params.userId));
  }, [params.userId]);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      const list = await adminListAccounts();
      setAccounts(list);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let banned = 0;
    for (const a of accounts) {
      const st = getAccountStatus(a);
      if (st === 'banned') banned += 1;
      else if (st === 'suspended') suspended += 1;
      else active += 1;
    }
    return { all: accounts.length, active, suspended, banned };
  }, [accounts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (focusedUserId && a.id !== focusedUserId) return false;
      const st = getAccountStatus(a);
      if (filter !== 'all' && filter !== st) return false;
      if (!q) return true;
      return `${a.full_name || ''} ${a.email || ''} ${a.role || ''}`.toLowerCase().includes(q);
    });
  }, [accounts, filter, focusedUserId, search]);

  const openModal = (acc: AdminAccount) => {
    const actions = getAvailableModerationActions(acc, session?.user?.id);
    if (actions.length === 0) return;
    setTarget(acc);
    setSelectedAction(actions[0].value);
    setDurationHours(168);
    setCustomDays('');
    setWarningMsg('');
    setReason('');
    setModalError(null);
  };

  const handleSubmit = async () => {
    if (!target || !selectedAction) return;
    setModalError(null);

    const trimmedWarning = warningMsg.trim();
    const trimmedReason = reason.trim();

    if (selectedAction === 'warn' && !trimmedWarning) {
      setModalError('Enter a warning message for the user.');
      return;
    }
    if (selectedAction !== 'warn' && !trimmedReason) {
      setModalError('A moderation reason is required.');
      return;
    }

    let customDurationDays: number | undefined;
    let hours: number | undefined;
    if (selectedAction === 'suspend_temporary') {
      if (durationHours === 'custom') {
        const parsed = parseInt(customDays, 10);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
          setModalError('Enter a valid custom duration between 1 and 365 days.');
          return;
        }
        customDurationDays = parsed;
      } else {
        hours = durationHours;
      }
    }

    setSubmitting(true);
    try {
      const res = await adminSubmitModeration({
        targetUserId: target.id,
        moderationAction: selectedAction,
        reason: selectedAction === 'warn' ? trimmedWarning : trimmedReason,
        durationHours: hours,
        customDurationDays,
      });
      setTarget(null);
      Alert.alert(
        'Action recorded',
        res.warning
          ? `${MODERATION_ACTION_LABELS[selectedAction]} saved. ${res.warning}`
          : `${MODERATION_ACTION_LABELS[selectedAction]} applied cleanly.`
      );
      await load();
    } catch (e: any) {
      setModalError(e?.message || 'Moderation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const targetActions = target ? getAvailableModerationActions(target, session?.user?.id) : [];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Accounts moderation"
        subtitle={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
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
        {focusedUserId ? (
          <View style={styles.focusBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.focusTitle}>Filtered to specific user</Text>
              <Text style={styles.focusSub} numberOfLines={1}>
                User ID: {focusedUserId.slice(0, 12)}…
              </Text>
            </View>
            <Button title="Show all" variant="outline" small onPress={() => setFocusedUserId(null)} />
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, or role..."
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
          contentContainerStyle={{ gap: 7, paddingVertical: 12 }}
        >
          {(
            [
              ['all', `All (${counts.all})`],
              ['active', `Active (${counts.active})`],
              ['suspended', `Suspended (${counts.suspended})`],
              ['banned', `Banned (${counts.banned})`],
            ] as [StatusFilter, string][]
          ).map(([val, label]) => (
            <Chip key={val} label={label} active={filter === val} onPress={() => setFilter(val)} />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg ? (
          <EmptyState
            icon="lock-closed-outline"
            title="Could not load accounts"
            text={errorMsg}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : (
          <SwipeTabContent
            activeKey={filter}
            keys={ACCOUNT_FILTER_KEYS}
            onChangeKey={(k) => setFilter(k as StatusFilter)}
          >
            {visible.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No matching accounts"
                text="Try clearing the search or choosing another status filter."
              />
            ) : (
              <View style={{ gap: 10 }}>
            {visible.map((acc) => {
              const badge = getAccountBadge(acc);
              const ownAdmin = acc.id === session?.user?.id && acc.role === 'admin';
              const history = acc.recent_actions || [];
              const showHistory = Boolean(expandedHistory[acc.id]);

              return (
                <Card key={acc.id} style={{ gap: 8 }}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accName} numberOfLines={1}>
                        {acc.full_name || 'Unnamed account'}
                      </Text>
                      <Text style={styles.accEmail} numberOfLines={1}>
                        {acc.email || 'Email unavailable'}
                      </Text>
                    </View>
                    <StatusPill
                      label={(acc.role || 'customer').replace('_', ' ')}
                      tone={acc.role === 'admin' ? 'info' : 'muted'}
                    />
                  </View>

                  <View style={styles.pillRow}>
                    <StatusPill label={badge.label} tone={badge.tone} />
                    {acc.is_premium ? (
                      <StatusPill
                        label={
                          acc.premium_ends_at
                            ? `Premium • thru ${formatAdminDate(acc.premium_ends_at)}`
                            : 'Premium'
                        }
                        tone="warn"
                      />
                    ) : null}
                  </View>

                  {badge.note ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>{badge.note}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooter}>
                    {history.length > 0 ? (
                      <Pressable
                        onPress={() =>
                          setExpandedHistory((prev) => ({ ...prev, [acc.id]: !prev[acc.id] }))
                        }
                        style={styles.historyToggle}
                      >
                        <Ionicons
                          name={showHistory ? 'chevron-up' : 'time-outline'}
                          size={14}
                          color={COLORS.primary}
                        />
                        <Text style={styles.historyToggleText}>
                          History ({history.length})
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.mutedSmall}>No moderation history</Text>
                    )}

                    {ownAdmin ? (
                      <StatusPill label="Current admin" tone="muted" />
                    ) : (
                      <Button
                        title="Moderate"
                        icon="shield-outline"
                        variant="soft"
                        small
                        onPress={() => openModal(acc)}
                      />
                    )}
                  </View>

                  {showHistory && history.length > 0 ? (
                    <View style={styles.historyList}>
                      {history.map((item, idx) => (
                        <View key={item.id || `${acc.id}-${idx}`} style={styles.historyItem}>
                          <Text style={styles.historyHead}>
                            {MODERATION_ACTION_LABELS[item.action] || item.action}
                            <Text style={styles.historyDate}>
                              {' '}• {formatAdminDate(item.created_at)}
                              {item.actor_name ? ` by ${item.actor_name}` : ''}
                            </Text>
                          </Text>
                          <Text style={styles.historyReason}>{item.reason}</Text>
                          {item.expires_at ? (
                            <Text style={styles.mutedSmall}>
                              Expires: {formatAdminDate(item.expires_at)}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
            })}
              </View>
            )}
          </SwipeTabContent>
        )}
      </ScrollView>

      {/* Moderation Bottom Sheet */}
      <Modal
        visible={Boolean(target)}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!submitting) setTarget(null); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => !submitting && setTarget(null)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.grabber} />
            <ScrollView style={{ maxHeight: 540 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>Moderate account</Text>
              <Text style={styles.sheetSub}>
                {target?.full_name || target?.email || 'Account'} •{' '}
                {(target?.role || 'customer').replace('_', ' ')}
              </Text>

              <Text style={styles.fieldLabel}>Action</Text>
              <View style={styles.chipWrap}>
                {targetActions.map((a) => (
                  <Chip
                    key={a.value}
                    label={a.label}
                    active={selectedAction === a.value}
                    onPress={() => {
                      setSelectedAction(a.value);
                      setModalError(null);
                    }}
                  />
                ))}
              </View>

              {selectedAction ? (
                <View style={styles.hintBanner}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.hintBannerText}>{actionHint(selectedAction)}</Text>
                </View>
              ) : null}

              {selectedAction === 'suspend_temporary' ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>Suspension duration</Text>
                  <View style={styles.chipWrap}>
                    {MODERATION_DURATION_OPTIONS.map((opt) => (
                      <Chip
                        key={opt.hours}
                        label={opt.label}
                        active={durationHours === opt.hours}
                        onPress={() => setDurationHours(opt.hours)}
                      />
                    ))}
                    <Chip
                      label="Custom days"
                      active={durationHours === 'custom'}
                      onPress={() => setDurationHours('custom')}
                    />
                  </View>
                  {durationHours === 'custom' ? (
                    <TextInput
                      value={customDays}
                      onChangeText={setCustomDays}
                      keyboardType="number-pad"
                      placeholder="Enter days (1–365)"
                      placeholderTextColor={COLORS.muted}
                      style={[styles.input, { marginTop: 8 }]}
                    />
                  ) : null}
                </View>
              ) : null}

              {selectedAction === 'warn' ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>
                    Warning message (visible to user) <Text style={{ color: COLORS.bad }}>*</Text>
                  </Text>
                  <TextInput
                    value={warningMsg}
                    onChangeText={setWarningMsg}
                    multiline
                    placeholder="Explain the policy reminder or warning..."
                    placeholderTextColor={COLORS.muted}
                    style={[styles.input, styles.textArea]}
                  />
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>
                    Reason <Text style={{ color: COLORS.bad }}>*</Text>
                  </Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    placeholder="Explain why this action is being taken..."
                    placeholderTextColor={COLORS.muted}
                    style={[styles.input, styles.textArea]}
                  />
                </View>
              )}

              {modalError ? <Text style={styles.errorText}>{modalError}</Text> : null}

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  disabled={submitting}
                  onPress={() => setTarget(null)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Confirm"
                  variant={
                    selectedAction &&
                    ['suspend_temporary', 'suspend_permanent', 'ban', 'remove_premium'].includes(
                      selectedAction
                    )
                      ? 'danger'
                      : 'primary'
                  }
                  loading={submitting}
                  onPress={handleSubmit}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const ACCOUNT_FILTER_KEYS = ['all', 'active', 'suspended', 'banned'] as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  focusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    marginBottom: 12,
  },
  focusTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary },
  focusSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.inkSecondary, marginTop: 1 },
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
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  accName: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  accEmail: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  noteBox: {
    backgroundColor: COLORS.badBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  noteText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.bad, lineHeight: 17 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
  },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  historyToggleText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  mutedSmall: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
  historyList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
    paddingTop: 8,
    gap: 8,
  },
  historyItem: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    padding: 9,
    gap: 2,
  },
  historyHead: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink },
  historyDate: { fontFamily: FONTS.medium, color: COLORS.muted },
  historyReason: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 17 },
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
  sheetTitle: { fontSize: 18, fontFamily: FONTS.extrabold, color: COLORS.ink },
  sheetSub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 7 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.sm,
    padding: 10,
    marginTop: 12,
  },
  hintBannerText: { flex: 1, fontSize: 12, fontFamily: FONTS.medium, color: COLORS.primary, lineHeight: 17 },
  input: {
    minHeight: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
  },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  errorText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.bad, marginTop: 10 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
