import React, { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import {
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Field,
  ScreenHeader,
  SectionLabel,
  StatusPill,
} from '../components/ui';
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportAttachmentUrl,
  getSupportTicketDetail,
  replyToSupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_MAP,
  SUPPORT_FAQS,
  SUPPORT_STATUS,
  SupportTicket,
  uploadSupportAttachment,
} from '../lib/support';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

type TabKey = 'tickets' | 'new' | 'faq';

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string; category?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id || null;

  const [tab, setTab] = useState<TabKey>(
    params.tab === 'new' || params.category ? 'new' : params.tab === 'faq' ? 'faq' : 'tickets'
  );

  // Sync deep-link query params even if Support screen is already mounted
  useEffect(() => {
    if (params.category) {
      setCategory(params.category);
      setTab('new');
    } else if (params.tab === 'new' || params.tab === 'faq' || params.tab === 'tickets') {
      setTab(params.tab);
    }
  }, [params.category, params.tab]);

  // Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New ticket form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>(params.category || 'ACCOUNT_PROBLEMS');
  const [description, setDescription] = useState('');
  const [pickedAttachment, setPickedAttachment] = useState<{
    uri: string;
    name: string;
    mime: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Ticket thread modal state
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const list = await getMySupportTickets(userId);
      setTickets(list);
    } catch (e: any) {
      console.warn('loadTickets error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openThread = async (ticketId: string) => {
    if (!userId) return;
    setLoadingThread(true);
    const existing = tickets.find((t) => t.id === ticketId) || null;
    setActiveTicket(existing);
    try {
      const full = await getSupportTicketDetail(userId, ticketId);
      if (full) {
        setActiveTicket(full);
        // Update unread flag in list
        setTickets((prev) =>
          prev.map((t) => (t.id === full.id ? { ...t, support_messages: full.support_messages } : t))
        );
      }
    } finally {
      setLoadingThread(false);
    }
  };

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach a screenshot.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const mime = a.mimeType || 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      setPickedAttachment({
        uri: a.uri,
        name: a.fileName || `screenshot.${ext}`,
        mime,
      });
    }
  };

  const handleCreateTicket = async () => {
    if (!userId) return;
    if (!subject.trim() || !category || !description.trim()) {
      Alert.alert('Missing fields', 'Please fill out Subject, Category, and Description.');
      return;
    }
    setSubmitting(true);
    try {
      let uploaded: { path: string; name: string; size: number; mime: string } | null = null;
      if (pickedAttachment) {
        uploaded = await uploadSupportAttachment(
          userId,
          pickedAttachment.uri,
          pickedAttachment.name,
          pickedAttachment.mime
        );
      }
      const res = await createSupportTicket({
        subject,
        category,
        description,
        attachment: uploaded,
      });
      setSubject('');
      setDescription('');
      setPickedAttachment(null);
      await loadTickets();
      setTab('tickets');
      Alert.alert(
        'Ticket Submitted',
        `Your support ticket has been created${res.ticketId ? ` (#${res.ticketId.slice(0, 8)})` : ''}. Track admin replies in My Tickets.`
      );
    } catch (e: any) {
      Alert.alert('Could not submit ticket', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeTicket || !replyText.trim() || sendingReply || !userId) return;
    setSendingReply(true);
    try {
      await replyToSupportTicket(activeTicket.id, replyText);
      setReplyText('');
      const refreshed = await getSupportTicketDetail(userId, activeTicket.id);
      if (refreshed) {
        setActiveTicket(refreshed);
        setTickets((prev) =>
          prev.map((t) => (t.id === refreshed.id ? refreshed : t))
        );
      }
    } catch (e: any) {
      Alert.alert('Reply failed', e?.message || 'Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const url = await getSupportAttachmentUrl(path);
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Attachment error', e?.message || 'Could not open attachment.');
    }
  };

  const unreadTicketCount = tickets.filter((t) =>
    t.support_messages?.some((m) => m.is_from_admin && !m.read_at)
  ).length;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScreenHeader
        title="Help & Support"
        subtitle="FAQs, contact admin, and support tickets"
      />

      {/* Segmented Tabs */}
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          {(
            [
              ['tickets', `My Tickets (${tickets.length})`],
              ['new', 'New Ticket'],
              ['faq', 'FAQs'],
            ] as [TabKey, string][]
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[styles.segBtn, tab === k && styles.segBtnActive]}
            >
              <Text style={[styles.segText, tab === k && styles.segTextActive]}>{label}</Text>
              {k === 'tickets' && unreadTicketCount > 0 && <View style={styles.segDot} />}
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'tickets' ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadTickets();
                }}
                colors={[COLORS.primary]}
              />
            }
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
          >
            {tickets.length === 0 ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="No support tickets yet"
                text="Have a question about verification, orders, or your account? Create a support ticket and our admins will reply here."
                action={
                  <Button
                    title="Submit a Ticket"
                    icon="add-circle-outline"
                    onPress={() => setTab('new')}
                    small
                    style={{ marginTop: 6 }}
                  />
                }
              />
            ) : (
              tickets.map((t) => {
                const st = SUPPORT_STATUS[t.status] || { label: t.status, tone: 'info' as const };
                const hasUnread = Boolean(
                  t.support_messages?.some((m) => m.is_from_admin && !m.read_at)
                );
                const msgCount = t.support_messages?.length || 0;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => openThread(t.id)}
                    style={({ pressed }) => [styles.ticketCard, pressed && { opacity: 0.92 }]}
                  >
                    <View style={styles.ticketHead}>
                      <Text style={styles.ticketSubject} numberOfLines={2}>
                        {t.subject}
                      </Text>
                      <StatusPill label={st.label} tone={st.tone} />
                    </View>
                    <Text style={styles.ticketMeta}>
                      {SUPPORT_CATEGORY_MAP[t.category] || t.category} •{' '}
                      {new Date(t.created_at).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.ticketDesc} numberOfLines={2}>
                      {t.description}
                    </Text>
                    <View style={styles.ticketFoot}>
                      <View style={styles.ticketFootLeft}>
                        <Ionicons name="chatbubble-outline" size={13} color={COLORS.muted} />
                        <Text style={styles.ticketMsgCount}>
                          {msgCount} {msgCount === 1 ? 'reply' : 'replies'}
                        </Text>
                        {hasUnread && <StatusPill label="New admin reply" tone="info" />}
                      </View>
                      <Text style={styles.openThreadText}>View thread →</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )
      ) : tab === 'new' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        >
          <Card>
            <Field
              label="Subject"
              required
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
              placeholder="Brief summary of your issue"
            />

            <Text style={styles.fieldLabel}>
              Category <Text style={{ color: COLORS.bad }}>*</Text>
            </Text>
            <ChipGroup
              options={SUPPORT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              value={category}
              onChange={setCategory}
            />

            <View style={{ height: 14 }} />
            <Field
              label="Description"
              required
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your issue in detail, including steps or error messages..."
              hint="The more details you provide, the faster our team can help."
              style={{ minHeight: 115 }}
            />

            <Text style={styles.fieldLabel}>Screenshot / Attachment (optional)</Text>
            {pickedAttachment ? (
              <View style={styles.attachRow}>
                <Ionicons name="image-outline" size={18} color={COLORS.primary} />
                <Text style={styles.attachName} numberOfLines={1}>
                  {pickedAttachment.name}
                </Text>
                <Pressable onPress={() => setPickedAttachment(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={19} color={COLORS.bad} />
                </Pressable>
              </View>
            ) : (
              <Button
                title="Attach photo (max 5 MB)"
                variant="outline"
                icon="attach-outline"
                small
                onPress={handlePickImage}
              />
            )}
          </Card>

          <Button
            title="Submit Ticket"
            icon="paper-plane-outline"
            loading={submitting}
            onPress={handleCreateTicket}
          />
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        >
          <SectionLabel>Frequently Asked Questions</SectionLabel>
          <View style={styles.faqList}>
            {SUPPORT_FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <Card key={item.q} style={styles.faqCard}>
                  <Pressable
                    onPress={() => setOpenFaq(isOpen ? null : idx)}
                    style={styles.faqHead}
                  >
                    <Text style={styles.faqQ}>{item.q}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={COLORS.primary}
                    />
                  </Pressable>
                  {isOpen && <Text style={styles.faqA}>{item.a}</Text>}
                </Card>
              );
            })}
          </View>

          <SectionLabel>Contact Administration</SectionLabel>
          <Card style={{ gap: 10 }}>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactSub}>
              For general inquiries, partnerships, or permanent account appeals not covered by
              tickets.
            </Text>
            <Button
              title="admin@palitrento.online"
              icon="mail-outline"
              variant="soft"
              small
              onPress={() => Linking.openURL('mailto:admin@palitrento.online')}
            />
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={styles.contactTitle}>Business Verification Help</Text>
            <Text style={styles.contactSub}>
              Questions about permit requirements, store submission, or approval status?
            </Text>
            <Button
              title="Open Verification Ticket"
              icon="document-text-outline"
              variant="outline"
              small
              onPress={() => {
                setCategory('BUSINESS_VERIFICATION');
                setTab('new');
              }}
            />
          </Card>
        </ScrollView>
      )}

      {/* Ticket Thread Modal */}
      <Modal
        visible={Boolean(activeTicket)}
        animationType="slide"
        onRequestClose={() => setActiveTicket(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScreenHeader
            title={activeTicket?.subject || 'Ticket Details'}
            subtitle={
              activeTicket
                ? `${SUPPORT_CATEGORY_MAP[activeTicket.category] || activeTicket.category} • ${
                    SUPPORT_STATUS[activeTicket.status]?.label || activeTicket.status
                  }`
                : undefined
            }
            onBack={() => setActiveTicket(null)}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
          >
            {activeTicket && (
              <>
                <Card style={styles.origDescCard}>
                  <View style={styles.msgHead}>
                    <Text style={styles.msgSender}>Your original request</Text>
                    <Text style={styles.msgTime}>
                      {new Date(activeTicket.created_at).toLocaleString('en-PH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.msgBody}>{activeTicket.description}</Text>
                  {activeTicket.attachment_path ? (
                    <Pressable
                      onPress={() => handleOpenAttachment(activeTicket.attachment_path!)}
                      style={styles.attachLink}
                    >
                      <Ionicons name="attach" size={15} color={COLORS.primary} />
                      <Text style={styles.attachLinkText}>
                        {activeTicket.attachment_name || 'View attachment'}
                      </Text>
                    </Pressable>
                  ) : null}
                </Card>

                {loadingThread ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
                ) : (activeTicket.support_messages || []).length === 0 ? (
                  <Text style={styles.noRepliesText}>
                    No replies yet. An administrator will respond soon.
                  </Text>
                ) : (
                  (activeTicket.support_messages || []).map((msg) => (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgBubble,
                        msg.is_from_admin ? styles.msgAdmin : styles.msgUser,
                      ]}
                    >
                      <View style={styles.msgHead}>
                        <Text
                          style={[
                            styles.msgSender,
                            msg.is_from_admin && { color: COLORS.info },
                          ]}
                        >
                          {msg.is_from_admin ? 'Administrator' : 'You'}
                        </Text>
                        <Text style={styles.msgTime}>
                          {new Date(msg.created_at).toLocaleString('en-PH', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.msgBody}>{msg.content}</Text>
                      {msg.attachment_path ? (
                        <Pressable
                          onPress={() => handleOpenAttachment(msg.attachment_path!)}
                          style={styles.attachLink}
                        >
                          <Ionicons name="attach" size={14} color={COLORS.primary} />
                          <Text style={styles.attachLinkText}>
                            {msg.attachment_name || 'View attachment'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>

          {activeTicket &&
          activeTicket.status !== 'RESOLVED' &&
          activeTicket.status !== 'CLOSED' ? (
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Write a reply..."
                placeholderTextColor={COLORS.muted}
                multiline
              />
              <Pressable
                onPress={handleSendReply}
                disabled={!replyText.trim() || sendingReply}
                style={[
                  styles.sendBtn,
                  (!replyText.trim() || sendingReply) && { opacity: 0.45 },
                ]}
              >
                {sendingReply ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="send" size={17} color={COLORS.white} />
                )}
              </Pressable>
            </View>
          ) : (
            <View style={[styles.closedNotice, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Text style={styles.closedNoticeText}>
                This ticket is {activeTicket?.status?.toLowerCase()}. Open a new ticket if you still
                need help.
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  modalScreen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBarWrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.md,
    padding: 3,
    gap: 3,
  },
  segBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  segBtnActive: {
    backgroundColor: COLORS.card,
    ...SHADOW.card,
  },
  segText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: FONTS.bold,
    color: COLORS.muted,
  },
  segTextActive: { color: COLORS.primaryDark },
  segDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.info },
  scroll: { padding: 14, gap: 12 },
  ticketCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    gap: 7,
    ...SHADOW.card,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  ticketSubject: { flex: 1, fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  ticketMeta: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.muted },
  ticketDesc: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 18 },
  ticketFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
  },
  ticketFootLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  ticketMsgCount: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.muted },
  openThreadText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 7 },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySoft,
  },
  attachName: { flex: 1, fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.primaryDark },
  faqList: { gap: 9 },
  faqCard: { padding: 0, overflow: 'hidden' },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  faqQ: { flex: 1, fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.ink, lineHeight: 19 },
  faqA: {
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: COLORS.inkSecondary,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  contactTitle: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  contactSub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 18 },
  origDescCard: { gap: 8 },
  msgBubble: {
    borderRadius: RADIUS.lg,
    padding: 13,
    borderWidth: 1,
    gap: 6,
  },
  msgAdmin: {
    backgroundColor: COLORS.infoBg,
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  msgUser: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
  },
  msgHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  msgSender: { fontSize: 11.5, fontFamily: FONTS.extrabold, color: COLORS.primary },
  msgTime: { fontSize: 10.5, fontFamily: FONTS.medium, color: COLORS.muted },
  msgBody: { fontSize: 13.5, fontFamily: FONTS.medium, color: COLORS.ink, lineHeight: 20 },
  attachLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
    marginTop: 4,
  },
  attachLinkText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  noRepliesText: {
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    marginVertical: 14,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  replyInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 21,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedNotice: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLORS.mutedBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  closedNoticeText: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
