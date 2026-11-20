import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import {
  adminGetSupportTicketDetail,
  adminGetSupportTickets,
  adminReplySupportTicket,
  AdminSupportTicket,
  adminUpdateTicketStatus,
  formatAdminDate,
} from '../../lib/admin';
import {
  getSupportAttachmentUrl,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_MAP,
  SUPPORT_STATUS,
} from '../../lib/support';
import { Button, Card, Chip, EmptyState, ScreenHeader, StatusPill } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

const STATUS_ACTIONS: {
  value: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED';
  label: string;
}[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_FOR_USER', label: 'Waiting' },
  { value: 'RESOLVED', label: 'Resolve' },
  { value: 'CLOSED', label: 'Close' },
];

export default function AdminSupportInboxScreen() {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Detail modal state
  const [activeTicket, setActiveTicket] = useState<AdminSupportTicket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      setTickets(await adminGetSupportTickets());
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load support tickets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (!q) return true;
      const hay = `${t.id} ${t.subject} ${t.profiles?.full_name || ''} ${t.profiles?.email || ''}`;
      return hay.toLowerCase().includes(q);
    });
  }, [categoryFilter, search, statusFilter, tickets]);

  const openCount = useMemo(
    () =>
      tickets.filter((t) => ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'].includes(t.status)).length,
    [tickets]
  );

  const openTicket = async (ticketId: string) => {
    setLoadingDetail(true);
    setReplyText('');
    try {
      const detail = await adminGetSupportTicketDetail(ticketId);
      if (!detail) {
        Alert.alert('Not found', 'Ticket could not be loaded.');
        return;
      }
      setActiveTicket(detail);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load ticket details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeTicket || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await adminReplySupportTicket(activeTicket.id, replyText);
      setReplyText('');
      const refreshed = await adminGetSupportTicketDetail(activeTicket.id);
      if (refreshed) setActiveTicket(refreshed);
      load();
    } catch (e: any) {
      Alert.alert('Reply failed', e?.message || 'Could not send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (
    nextStatus: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED'
  ) => {
    if (!activeTicket) return;
    setUpdatingStatus(nextStatus);
    try {
      await adminUpdateTicketStatus(activeTicket.id, nextStatus);
      const refreshed = await adminGetSupportTicketDetail(activeTicket.id);
      if (refreshed) setActiveTicket(refreshed);
      await load();
    } catch (e: any) {
      Alert.alert('Status update failed', e?.message || 'Could not update status.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const url = await getSupportAttachmentUrl(path);
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Attachment unavailable', e?.message || 'Could not open attachment.');
    }
  };

  const isClosed =
    activeTicket?.status === 'RESOLVED' || activeTicket?.status === 'CLOSED';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Support inbox"
        subtitle={`${openCount} active • ${tickets.length} total`}
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
            placeholder="Search ticket ID, subject, or user..."
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
            ['', 'All statuses'],
            ['OPEN', 'Open'],
            ['IN_PROGRESS', 'In Progress'],
            ['WAITING_FOR_USER', 'Waiting for User'],
            ['RESOLVED', 'Resolved'],
            ['CLOSED', 'Closed'],
          ].map(([val, label]) => (
            <Chip
              key={val || 'all'}
              label={label}
              active={statusFilter === val}
              onPress={() => setStatusFilter(val)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 12 }}
        >
          <Chip
            label="All categories"
            active={categoryFilter === ''}
            onPress={() => setCategoryFilter('')}
          />
          {SUPPORT_CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              active={categoryFilter === c.value}
              onPress={() => setCategoryFilter(c.value)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg ? (
          <EmptyState
            icon="mail-unread-outline"
            title="Could not load tickets"
            text={errorMsg}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No support tickets"
            text="No tickets match your current filters."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((t) => {
              const st = SUPPORT_STATUS[t.status] || { label: t.status, tone: 'info' as const };
              const adminLabel = t.status === 'WAITING_FOR_USER' ? 'Waiting for User' : st.label;
              const unreadUserMsgs =
                t.support_messages?.filter((m) => !m.is_from_admin && !m.read_at).length || 0;

              return (
                <Pressable key={t.id} onPress={() => openTicket(t.id)}>
                  <Card style={{ gap: 7 }}>
                    <View style={styles.cardHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ticketSubject} numberOfLines={2}>
                          {t.subject}
                        </Text>
                        <Text style={styles.ticketMeta} numberOfLines={1}>
                          #{t.id.slice(0, 8)} • {t.profiles?.full_name || t.profiles?.email || 'User'}
                        </Text>
                      </View>
                      <StatusPill label={adminLabel} tone={st.tone} />
                    </View>

                    <View style={styles.pillRow}>
                      <StatusPill
                        label={SUPPORT_CATEGORY_MAP[t.category] || t.category}
                        tone="muted"
                      />
                      {unreadUserMsgs > 0 ? (
                        <StatusPill label={`${unreadUserMsgs} unread`} tone="info" />
                      ) : null}
                    </View>

                    <View style={styles.cardFoot}>
                      <Text style={styles.dateText}>{formatAdminDate(t.created_at)}</Text>
                      <Text style={styles.openLink}>Open thread →</Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {loadingDetail ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
        </View>
      ) : null}

      {/* Ticket Detail & Conversation Modal */}
      <Modal
        visible={Boolean(activeTicket)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveTicket(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setActiveTicket(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
            <View style={styles.grabber} />
            {activeTicket ? (
              <ScrollView style={{ maxHeight: 590 }} keyboardShouldPersistTaps="handled">
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{activeTicket.subject}</Text>
                    <Text style={styles.sheetSub}>
                      #{activeTicket.id.slice(0, 8)} •{' '}
                      {activeTicket.profiles?.full_name || activeTicket.profiles?.email || 'User'} •{' '}
                      {SUPPORT_CATEGORY_MAP[activeTicket.category] || activeTicket.category}
                    </Text>
                  </View>
                  <StatusPill
                    label={
                      activeTicket.status === 'WAITING_FOR_USER'
                        ? 'Waiting'
                        : SUPPORT_STATUS[activeTicket.status]?.label || activeTicket.status
                    }
                    tone={SUPPORT_STATUS[activeTicket.status]?.tone || 'info'}
                  />
                </View>

                {/* Original Ticket Description */}
                <View style={styles.origBox}>
                  <Text style={styles.origHead}>
                    Original request • {formatAdminDate(activeTicket.created_at)}
                  </Text>
                  <Text style={styles.origBody}>{activeTicket.description}</Text>
                  {activeTicket.attachment_path ? (
                    <Pressable
                      onPress={() => handleOpenAttachment(activeTicket.attachment_path!)}
                      style={styles.attachBtn}
                    >
                      <Ionicons name="attach" size={14} color={COLORS.primary} />
                      <Text style={styles.attachText} numberOfLines={1}>
                        {activeTicket.attachment_name || 'View attachment'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* Messages thread */}
                {(activeTicket.support_messages || []).length > 0 ? (
                  <View style={{ gap: 8, marginBottom: 14 }}>
                    {(activeTicket.support_messages || []).map((m) => (
                      <View
                        key={m.id}
                        style={[styles.msgBubble, m.is_from_admin && styles.msgBubbleAdmin]}
                      >
                        <View style={styles.msgHead}>
                          <Text
                            style={[
                              styles.msgSender,
                              m.is_from_admin && { color: COLORS.primary },
                            ]}
                          >
                            {m.is_from_admin
                              ? 'Administrator'
                              : m.profiles?.full_name || activeTicket.profiles?.full_name || 'User'}
                          </Text>
                          <Text style={styles.dateText}>{formatAdminDate(m.created_at)}</Text>
                        </View>
                        <Text style={styles.msgBody}>{m.content}</Text>
                        {m.attachment_path ? (
                          <Pressable
                            onPress={() => handleOpenAttachment(m.attachment_path!)}
                            style={styles.attachBtn}
                          >
                            <Ionicons name="attach" size={14} color={COLORS.primary} />
                            <Text style={styles.attachText} numberOfLines={1}>
                              {m.attachment_name || 'Attachment'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.dateText, { marginBottom: 12 }]}>
                    No replies on this ticket yet.
                  </Text>
                )}

                {/* Admin Reply Composer */}
                {!isClosed ? (
                  <View style={styles.composerBox}>
                    <Text style={styles.fieldLabel}>Admin reply</Text>
                    <TextInput
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      placeholder="Write a helpful response to the user..."
                      placeholderTextColor={COLORS.muted}
                      style={styles.textArea}
                    />
                    <Button
                      title="Send reply"
                      icon="send"
                      small
                      loading={sendingReply}
                      disabled={!replyText.trim() || sendingReply}
                      onPress={handleSendReply}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                ) : (
                  <View style={styles.closedNote}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.muted} />
                    <Text style={styles.closedNoteText}>
                      This ticket is {activeTicket.status.toLowerCase()}. Reopen it below to reply.
                    </Text>
                  </View>
                )}

                {/* Status controls */}
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Update ticket status</Text>
                <View style={styles.chipWrap}>
                  {STATUS_ACTIONS.map((st) => (
                    <Chip
                      key={st.value}
                      label={updatingStatus === st.value ? 'Saving…' : st.label}
                      active={activeTicket.status === st.value}
                      onPress={() => {
                        if (!updatingStatus && activeTicket.status !== st.value) {
                          handleStatusChange(st.value);
                        }
                      }}
                    />
                  ))}
                </View>

                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setActiveTicket(null)}
                  style={{ marginTop: 14 }}
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
  ticketSubject: { fontSize: 14.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  ticketMeta: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
  },
  dateText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.muted },
  openLink: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17,29,21,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sheetTitle: { fontSize: 16.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  sheetSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2, marginBottom: 12 },
  origBox: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  origHead: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.muted },
  origBody: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.ink, lineHeight: 19 },
  msgBubble: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 11,
    gap: 5,
  },
  msgBubbleAdmin: {
    backgroundColor: COLORS.primarySoft,
    borderColor: '#C5DEC9',
  },
  msgHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  msgSender: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.ink },
  msgBody: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.ink, lineHeight: 18 },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  attachText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.primary, maxWidth: 220 },
  composerBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
    paddingTop: 12,
  },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  textArea: {
    minHeight: 74,
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
  closedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.sm,
    padding: 10,
  },
  closedNoteText: { flex: 1, fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
