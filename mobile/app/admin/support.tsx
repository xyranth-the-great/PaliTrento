import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
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
import {
  AnimatedMessageBubble,
  AnimatedSendButton,
  ChatDateSeparator,
  formatChatDateLabel,
  isSameCalendarDay,
} from '../../components/ChatAnimations';
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
  const [replyFocused, setReplyFocused] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const detailScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const animatedAdminMsgIdsRef = useRef<Set<string>>(new Set());

  // Live Realtime updates while admin has a ticket conversation open
  useEffect(() => {
    const ticketId = activeTicket?.id;
    if (!ticketId) return;
    const ch = supabase
      .channel(`rn-admin-support-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const incoming = payload.new as NonNullable<AdminSupportTicket['support_messages']>[number];
          animatedAdminMsgIdsRef.current.add(incoming.id);
          setActiveTicket((prev) => {
            if (!prev || prev.id !== ticketId) return prev;
            const list = prev.support_messages || [];
            if (list.some((m) => m.id === incoming.id)) return prev;
            const tempIdx = incoming.is_from_admin
              ? list.findIndex(
                  (m) => m.id.startsWith('temp-') && m.content.trim() === incoming.content.trim()
                )
              : -1;
            const nextMsgs =
              tempIdx !== -1
                ? list.map((m, i) => (i === tempIdx ? incoming : m))
                : [...list, incoming];
            return { ...prev, support_messages: nextMsgs };
          });
          setTimeout(() => detailScrollRef.current?.scrollToEnd({ animated: true }), 80);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeTicket?.id]);

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
    animatedAdminMsgIdsRef.current.clear();
    setLoadingDetail(true);
    setReplyText('');
    try {
      const detail = await adminGetSupportTicketDetail(ticketId);
      if (!detail) {
        Alert.alert('Not found', 'Ticket could not be loaded.');
        return;
      }
      setActiveTicket(detail);
      setTimeout(() => detailScrollRef.current?.scrollToEnd({ animated: false }), 90);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load ticket details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSendReply = async () => {
    const content = replyText.trim();
    if (!activeTicket || !content || sendingReply) return;
    const ticketId = activeTicket.id;
    const tempId = `temp-${Date.now()}`;
    animatedAdminMsgIdsRef.current.add(tempId);

    const optimisticMsg = {
      id: tempId,
      sender_id: 'admin',
      content,
      is_from_admin: true,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    setReplyText('');
    setSendingReply(true);
    setActiveTicket((prev) =>
      prev && prev.id === ticketId
        ? { ...prev, support_messages: [...(prev.support_messages || []), optimisticMsg] }
        : prev
    );
    setTimeout(() => detailScrollRef.current?.scrollToEnd({ animated: true }), 60);

    try {
      await adminReplySupportTicket(ticketId, content);
      const refreshed = await adminGetSupportTicketDetail(ticketId);
      if (refreshed) setActiveTicket(refreshed);
      load();
    } catch (e: any) {
      setActiveTicket((prev) =>
        prev && prev.id === ticketId
          ? {
              ...prev,
              support_messages: (prev.support_messages || []).filter((m) => m.id !== tempId),
            }
          : prev
      );
      setReplyText(content);
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
              <ScrollView
                ref={detailScrollRef}
                style={{ maxHeight: 590 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
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
                  <View style={{ marginBottom: 14 }}>
                    {(activeTicket.support_messages || []).map((m, idx, arr) => {
                      const prev = idx > 0 ? arr[idx - 1] : null;
                      const next = idx < arr.length - 1 ? arr[idx + 1] : null;
                      const showDate =
                        !prev || !isSameCalendarDay(prev.created_at, m.created_at)
                          ? formatChatDateLabel(m.created_at)
                          : null;
                      const own = Boolean(m.is_from_admin);
                      const samePrev =
                        Boolean(prev) && !showDate && Boolean(prev!.is_from_admin) === own;
                      const sameNext =
                        Boolean(next) &&
                        isSameCalendarDay(m.created_at, next!.created_at) &&
                        Boolean(next!.is_from_admin) === own;
                      const isOptimistic = m.id.startsWith('temp-');

                      return (
                        <View key={m.id}>
                          {showDate ? <ChatDateSeparator label={showDate} /> : null}
                          <AnimatedMessageBubble
                            content={m.content}
                            timestamp={m.created_at}
                            own={own}
                            variant="support"
                            senderLabel={
                              own
                                ? 'Administrator'
                                : m.profiles?.full_name || activeTicket.profiles?.full_name || 'User'
                            }
                            animateEntrance={
                              animatedAdminMsgIdsRef.current.has(m.id) ||
                              idx >= Math.max(0, arr.length - 4)
                            }
                            isFirstInGroup={!samePrev}
                            isLastInGroup={!sameNext}
                            status={
                              own
                                ? isOptimistic
                                  ? 'sending'
                                  : m.read_at
                                    ? 'read'
                                    : 'sent'
                                : undefined
                            }
                            extraFooter={
                              m.attachment_path ? (
                                <Pressable
                                  onPress={() => handleOpenAttachment(m.attachment_path!)}
                                  style={[styles.attachBtn, own && styles.attachBtnOwn]}
                                >
                                  <Ionicons
                                    name="attach"
                                    size={14}
                                    color={own ? COLORS.white : COLORS.primary}
                                  />
                                  <Text
                                    style={[
                                      styles.attachText,
                                      own && { color: COLORS.white },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {m.attachment_name || 'Attachment'}
                                  </Text>
                                </Pressable>
                              ) : null
                            }
                          />
                        </View>
                      );
                    })}
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
                    <View style={styles.replyRow}>
                      <TextInput
                        value={replyText}
                        onChangeText={setReplyText}
                        onFocus={() => setReplyFocused(true)}
                        onBlur={() => setReplyFocused(false)}
                        multiline
                        placeholder="Write a helpful response to the user..."
                        placeholderTextColor={COLORS.muted}
                        style={[styles.textArea, replyFocused && styles.textAreaFocused]}
                      />
                      <AnimatedSendButton
                        enabled={Boolean(replyText.trim())}
                        loading={sendingReply}
                        onPress={handleSendReply}
                      />
                    </View>
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
    marginTop: 6,
  },
  attachBtnOwn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  attachText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.primary, maxWidth: 220 },
  composerBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
    paddingTop: 12,
  },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textArea: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    borderWidth: 1.2,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
  textAreaFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
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
