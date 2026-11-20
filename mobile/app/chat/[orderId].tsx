import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { ChatMessage, OrderRecord } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { peso } from '../../lib/constants';
import { COLORS, RADIUS } from '../../lib/theme';

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const listRef = useRef<FlatList>(null);

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const userId = session?.user?.id;

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

  useEffect(() => {
    if (!orderId || !userId) {
      setLoading(false);
      return;
    }

    let active = true;
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
      setOrder((ordRes.data as OrderRecord) || null);
      setMessages((msgRes.data as ChatMessage[]) || []);
      setLoading(false);
      markUnreadRead();
    })();

    const channel = supabase
      .channel(`rn-chat-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.sender_id !== userId) markUnreadRead();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [markUnreadRead, orderId, userId]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || !orderId || !userId || sending) return;
    setSending(true);
    setText('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ order_id: String(orderId), sender_id: userId, content })
      .select()
      .single();
    setSending(false);
    if (!error && data) {
      setMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]
      );
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {order?.stores?.business_name || 'Order Chat'}
          </Text>
          {order && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {order.products?.name || 'Order'} • {order.quantity} × {peso(order.products?.current_price || 0)}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages yet. Say hello to the seller!</Text>
          }
          renderItem={({ item }) => {
            const own = item.sender_id === userId;
            return (
              <View style={[styles.msgRow, own ? styles.msgOwn : styles.msgOther]}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, own && styles.bubbleTextOwn]}>
                    {item.content}
                  </Text>
                </View>
                <Text style={styles.time}>
                  {new Date(item.created_at).toLocaleTimeString('en-PH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {own && item.read_at ? ' • Read' : ''}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Write a message..."
          placeholderTextColor={COLORS.muted}
          multiline
        />
        <Pressable
          onPress={sendMessage}
          disabled={!text.trim() || sending}
          style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, gap: 10 },
  emptyText: { textAlign: 'center', color: COLORS.muted, fontSize: 13, marginTop: 40 },
  msgRow: { maxWidth: '82%' },
  msgOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
  },
  bubbleOwn: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  bubbleText: { fontSize: 14, lineHeight: 20, color: COLORS.ink },
  bubbleTextOwn: { color: COLORS.white },
  time: { fontSize: 10, color: COLORS.muted, marginTop: 3 },
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
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 21,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
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
});
