import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { ChatMessage, OrderRecord } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { peso } from '../../lib/constants';
import { LIST_PERF_PROPS } from '../../lib/perf';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';
import { FadeInView } from '../../components/FadeInView';
import { StatusPill, Tone } from '../../components/ui';
import {
  AnimatedMessageBubble,
  AnimatedSendButton,
  ChatDateSeparator,
  ChatLoadingSkeleton,
  formatChatDateLabel,
  isSameCalendarDay,
  MessageDeliveryStatus,
  QuickReplyBar,
  ScrollToBottomFab,
  TypingIndicatorBubble,
} from '../../components/ChatAnimations';

interface LocalChatMessage extends ChatMessage {
  /** Stable React key so optimistic -> confirmed swap never remounts or flickers */
  _clientKey: string;
  _status?: MessageDeliveryStatus;
  _animate?: boolean;
}

interface GroupedChatItem {
  msg: LocalChatMessage;
  showDateLabel: string | null;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  entranceDelay: number;
}

const GROUP_GAP_MS = 5 * 60 * 1000;

const BUYER_QUICK_REPLIES = [
  'Is this still available?',
  'On my way for pickup!',
  'What time can I pick up?',
  'Thank you!',
] as const;

const SELLER_QUICK_REPLIES = [
  'Order confirmed! Preparing now.',
  'Ready for pickup!',
  'See you at the store!',
  'Thank you!',
] as const;

function getOrderStatusMeta(status?: string | null): { label: string; tone: Tone } | null {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === 'PENDING') return { label: 'Pending', tone: 'warn' };
  if (s === 'CONFIRMED') return { label: 'Confirmed', tone: 'info' };
  if (s === 'READY' || s === 'READY_FOR_PICKUP') return { label: 'Ready for pickup', tone: 'ok' };
  if (s === 'COMPLETED' || s === 'PICKED_UP') return { label: 'Completed', tone: 'ok' };
  if (s === 'CANCELLED') return { label: 'Cancelled', tone: 'bad' };
  return { label: status, tone: 'muted' };
}

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { refreshUnreadCount } = useNotifications();

  const listRef = useRef<FlatList<GroupedChatItem>>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isNearBottomRef = useRef(true);
  const initialScrolledRef = useRef(false);
  const tempSeqRef = useRef(0);
  const lastTypingSentRef = useRef(0);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [text, setText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [realtimeLive, setRealtimeLive] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [unreadBelow, setUnreadBelow] = useState(0);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const liveDotPulse = useRef(new Animated.Value(1)).current;
  const userId = session?.user?.id;
  const isSeller = Boolean(userId && order?.stores?.user_id === userId);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
    setShowScrollFab(false);
    setUnreadBelow(0);
    isNearBottomRef.current = true;
  }, []);

  const markUnreadRead = useCallback(async () => {
    if (!orderId || !userId) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('order_id', String(orderId))
      .is('read_at', null)
      .neq('sender_id', userId);
    refreshUnreadCount();
  }, [orderId, refreshUnreadCount, userId]);

  const broadcastTyping = useCallback(
    (typing: boolean) => {
      const ch = channelRef.current;
      if (!ch || !userId) return;
      if (typing) {
        const now = Date.now();
        if (now - lastTypingSentRef.current < 1600) return;
        lastTypingSentRef.current = now;
      } else {
        lastTypingSentRef.current = 0;
      }
      ch.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, typing },
      }).catch(() => {});
    },
    [userId]
  );

  // Subtle pulse on the Live indicator dot
  useEffect(() => {
    if (!realtimeLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotPulse, {
          toValue: 0.4,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(liveDotPulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [liveDotPulse, realtimeLive]);

  // Smoothly scroll to latest when the keyboard opens if user is near bottom
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isNearBottomRef.current) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      }
    });
    return () => sub.remove();
  }, []);

  // Load order + messages and wire Realtime INSERT, UPDATE (read receipts), and Typing broadcast
  useEffect(() => {
    if (!orderId || !userId) {
      setLoading(false);
      return;
    }

    let active = true;
    initialScrolledRef.current = false;

    (async () => {
      const [ordRes, msgRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, products (name, unit, current_price), stores (business_name, trn_code, user_id)')
          .eq('id', String(orderId))
          .maybeSingle(),
        supabase
          .from('messages')
          .select('*')
          .eq('order_id', String(orderId))
          .order('created_at', { ascending: true }),
      ]);
      if (!active) return;

      const rows = ((msgRes.data as ChatMessage[]) || []).map((m, idx, arr) => ({
        ...m,
        _clientKey: m.id,
        _status: (m.read_at ? 'read' : 'sent') as MessageDeliveryStatus,
        // Gently animate only the latest few bubbles on initial load
        _animate: idx >= Math.max(0, arr.length - 6),
      }));

      setOrder((ordRes.data as OrderRecord) || null);
      setMessages(rows);
      setShowQuickReplies(rows.length === 0);
      setLoading(false);
      markUnreadRead();
    })();

    const channel = supabase
      .channel(`rn-chat-${orderId}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          const isOwn = incoming.sender_id === userId;

          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Reconcile if this matches an in-flight optimistic message we just sent
            if (isOwn) {
              const pendingIdx = prev.findIndex(
                (m) =>
                  m._status === 'sending' &&
                  m.sender_id === userId &&
                  m.content === incoming.content
              );
              if (pendingIdx !== -1) {
                const next = [...prev];
                next[pendingIdx] = {
                  ...incoming,
                  _clientKey: prev[pendingIdx]._clientKey,
                  _status: incoming.read_at ? 'read' : 'sent',
                  _animate: false,
                };
                return next;
              }
            }
            return [
              ...prev,
              {
                ...incoming,
                _clientKey: incoming.id,
                _status: incoming.read_at ? 'read' : 'sent',
                _animate: true,
              },
            ];
          });

          if (!isOwn) {
            setPeerTyping(false);
            markUnreadRead();
          }

          if (isNearBottomRef.current || isOwn) {
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
          } else {
            setUnreadBelow((n) => n + 1);
            setShowScrollFab(true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    read_at: updated.read_at,
                    _status: updated.read_at ? 'read' : m._status || 'sent',
                  }
                : m
            )
          );
        }
      )
      .on('broadcast', { event: 'typing' }, (event) => {
        const p = event?.payload as { userId?: string; typing?: boolean } | undefined;
        if (!p || p.userId === userId) return;
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        if (p.typing) {
          setPeerTyping(true);
          if (isNearBottomRef.current) {
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 70);
          }
          peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), 3800);
        } else {
          setPeerTyping(false);
        }
      })
      .subscribe((status) => {
        if (!active) return;
        setRealtimeLive(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      active = false;
      channelRef.current = null;
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [markUnreadRead, orderId, userId]);

  const handleChangeText = useCallback(
    (val: string) => {
      setText(val);
      if (val.trim().length > 0) {
        broadcastTyping(true);
        if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = setTimeout(() => broadcastTyping(false), 2600);
      } else {
        if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
        broadcastTyping(false);
      }
    },
    [broadcastTyping]
  );

  const sendMessageContent = useCallback(
    async (rawContent: string, retryClientKey?: string) => {
      const content = rawContent.trim();
      if (!content || !orderId || !userId) return;

      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      broadcastTyping(false);
      setShowQuickReplies(false);

      const clientKey = retryClientKey || `temp-${Date.now()}-${++tempSeqRef.current}`;

      if (retryClientKey) {
        setMessages((prev) =>
          prev.map((m) =>
            m._clientKey === retryClientKey ? { ...m, _status: 'sending' } : m
          )
        );
      } else {
        const optimistic: LocalChatMessage = {
          id: clientKey,
          _clientKey: clientKey,
          order_id: String(orderId),
          sender_id: userId,
          content,
          created_at: new Date().toISOString(),
          read_at: null,
          _status: 'sending',
          _animate: true,
        };
        setMessages((prev) => [...prev, optimistic]);
        scrollToBottom(true);
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({ order_id: String(orderId), sender_id: userId, content })
        .select()
        .single();

      if (error || !data) {
        setMessages((prev) =>
          prev.map((m) => (m._clientKey === clientKey ? { ...m, _status: 'failed' } : m))
        );
        return;
      }

      const saved = data as ChatMessage;
      setMessages((prev) => {
        const alreadyHasSaved = prev.some(
          (m) => m.id === saved.id && m._clientKey !== clientKey
        );
        if (alreadyHasSaved) {
          // Realtime INSERT already added it separately; drop the duplicate optimistic stub
          return prev.filter((m) => m._clientKey !== clientKey);
        }
        return prev.map((m) =>
          m._clientKey === clientKey
            ? {
                ...saved,
                _clientKey: clientKey,
                _status: saved.read_at ? 'read' : 'sent',
                _animate: false,
              }
            : m
        );
      });
    },
    [broadcastTyping, orderId, scrollToBottom, userId]
  );

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content) return;
    setText('');
    void sendMessageContent(content);
  }, [sendMessageContent, text]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nearBottom = distanceFromBottom < 90;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowScrollFab(false);
      setUnreadBelow(0);
    } else if (contentSize.height > layoutMeasurement.height + 120) {
      setShowScrollFab(true);
    }
  }, []);

  // Precompute grouping + date dividers for fast, jank-free FlatList rendering
  const groupedItems = useMemo<GroupedChatItem[]>(() => {
    const total = messages.length;
    return messages.map((msg, idx) => {
      const prev = idx > 0 ? messages[idx - 1] : null;
      const next = idx < total - 1 ? messages[idx + 1] : null;

      const showDateLabel =
        !prev || !isSameCalendarDay(prev.created_at, msg.created_at)
          ? formatChatDateLabel(msg.created_at)
          : null;

      const sameAsPrev =
        Boolean(prev) &&
        !showDateLabel &&
        prev!.sender_id === msg.sender_id &&
        Math.abs(Date.parse(msg.created_at) - Date.parse(prev!.created_at)) <= GROUP_GAP_MS;

      const sameAsNext =
        Boolean(next) &&
        isSameCalendarDay(msg.created_at, next!.created_at) &&
        next!.sender_id === msg.sender_id &&
        Math.abs(Date.parse(next!.created_at) - Date.parse(msg.created_at)) <= GROUP_GAP_MS;

      const tailOffset = Math.max(0, idx - Math.max(0, total - 6));
      return {
        msg,
        showDateLabel,
        isFirstInGroup: !sameAsPrev,
        isLastInGroup: !sameAsNext,
        entranceDelay: msg._animate && total > 1 && !msg._clientKey.startsWith('temp-') ? tailOffset * 28 : 0,
      };
    });
  }, [messages]);

  const statusMeta = useMemo(() => getOrderStatusMeta(order?.status), [order?.status]);
  const quickReplies = isSeller ? SELLER_QUICK_REPLIES : BUYER_QUICK_REPLIES;

  const renderItem = useCallback(
    ({ item }: { item: GroupedChatItem }) => {
      const { msg, showDateLabel, isFirstInGroup, isLastInGroup, entranceDelay } = item;
      const own = msg.sender_id === userId;
      const deliveryStatus: MessageDeliveryStatus =
        msg._status || (msg.read_at ? 'read' : 'sent');

      return (
        <View>
          {showDateLabel ? <ChatDateSeparator label={showDateLabel} /> : null}
          <AnimatedMessageBubble
            content={msg.content}
            timestamp={msg.created_at}
            own={own}
            animateEntrance={Boolean(msg._animate)}
            entranceDelay={entranceDelay}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            status={own ? deliveryStatus : undefined}
            onRetry={
              deliveryStatus === 'failed'
                ? () => void sendMessageContent(msg.content, msg._clientKey)
                : undefined
            }
          />
        </View>
      );
    },
    [sendMessageContent, userId]
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      {/* Branded Gradient Top Bar */}
      <LinearGradient
        colors={['#122D1C', '#1B4329', '#235737']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topBar, { paddingTop: insets.top + 8 }]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.72, transform: [{ scale: 0.92 }] }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </Pressable>

        <View style={styles.avatarBadge}>
          <Ionicons
            name={isSeller ? 'person' : 'storefront'}
            size={17}
            color="#FBC14E"
          />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {order?.stores?.business_name || 'Order Chat'}
            </Text>
            {realtimeLive ? (
              <View style={styles.livePill}>
                <Animated.View style={[styles.liveDot, { opacity: liveDotPulse }]} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {peerTyping
              ? 'Typing...'
              : order
                ? `${order.products?.name || 'Order'} • ${order.quantity} × ${peso(
                    order.products?.current_price || 0
                  )}`
                : 'Direct order conversation'}
          </Text>
        </View>
      </LinearGradient>

      {/* Compact Order Context Bar */}
      {order ? (
        <FadeInView offsetY={-6} duration={200} style={styles.orderStrip}>
          <View style={styles.orderStripLeft}>
            <View style={styles.orderIconBox}>
              <Ionicons name="bag-handle-outline" size={14} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderStripTitle} numberOfLines={1}>
                {order.products?.name || 'Reserved Item'} ({order.quantity}{' '}
                {order.products?.unit || 'pc'})
              </Text>
              <Text style={styles.orderStripMeta} numberOfLines={1}>
                Total {peso(order.total_price || (order.products?.current_price || 0) * order.quantity)}
                {order.payment_method ? ` • ${order.payment_method}` : ''}
              </Text>
            </View>
          </View>
          {statusMeta ? <StatusPill label={statusMeta.label} tone={statusMeta.tone} /> : null}
        </FadeInView>
      ) : null}

      {/* Messages Area */}
      <View style={styles.bodyWrap}>
        {loading ? (
          <ChatLoadingSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            data={groupedItems}
            keyExtractor={(item) => item.msg._clientKey}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.list,
              groupedItems.length === 0 && styles.listEmptyContainer,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={Platform.OS === 'android'}
            {...LIST_PERF_PROPS}
            onContentSizeChange={() => {
              if (!initialScrolledRef.current && groupedItems.length > 0) {
                initialScrolledRef.current = true;
                listRef.current?.scrollToEnd({ animated: false });
              } else if (isNearBottomRef.current) {
                listRef.current?.scrollToEnd({ animated: true });
              }
            }}
            ListEmptyComponent={
              <FadeInView offsetY={14} duration={260} style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="chatbubbles" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptyText}>
                  {isSeller
                    ? 'Message the customer about pickup timing or order updates.'
                    : 'Say hello to the store owner or tap a quick reply below.'}
                </Text>
              </FadeInView>
            }
            ListFooterComponent={
              <TypingIndicatorBubble
                visible={peerTyping}
                label={isSeller ? 'Customer is typing' : 'Seller is typing'}
              />
            }
          />
        )}

        <ScrollToBottomFab
          visible={showScrollFab}
          unreadCount={unreadBelow}
          bottomOffset={12}
          onPress={() => scrollToBottom(true)}
        />
      </View>

      {/* Contextual Quick Replies */}
      <QuickReplyBar
        visible={showQuickReplies && !loading}
        replies={quickReplies}
        onSelect={(reply) => void sendMessageContent(reply)}
      />

      {/* Polished Composer */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          onPress={() => setShowQuickReplies((v) => !v)}
          style={({ pressed }) => [
            styles.quickToggleBtn,
            showQuickReplies && styles.quickToggleBtnActive,
            pressed && { opacity: 0.78, transform: [{ scale: 0.92 }] },
          ]}
          hitSlop={6}
          accessibilityLabel="Toggle quick replies"
        >
          <Ionicons
            name={showQuickReplies ? 'sparkles' : 'sparkles-outline'}
            size={18}
            color={showQuickReplies ? COLORS.primary : COLORS.muted}
          />
        </Pressable>

        <TextInput
          style={[styles.input, inputFocused && styles.inputFocused]}
          value={text}
          onChangeText={handleChangeText}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Write a message..."
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={1000}
        />

        <AnimatedSendButton enabled={Boolean(text.trim())} onPress={handleSend} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    flexShrink: 1,
    fontSize: 15.5,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
    letterSpacing: -0.2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  liveText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: 'rgba(255,255,255,0.92)',
  },
  subtitle: {
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  orderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  orderStripLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  orderIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderStripTitle: {
    fontSize: 12.5,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
  },
  orderStripMeta: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    marginTop: 1,
  },
  bodyWrap: {
    flex: 1,
    position: 'relative',
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  listEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 28,
    marginHorizontal: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW.card,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    lineHeight: 18,
    marginTop: 5,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 9,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  quickToggleBtn: {
    width: 40,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickToggleBtnActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: '#C5DEC9',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 116,
    borderRadius: 21,
    backgroundColor: COLORS.bg,
    borderWidth: 1.2,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
});
