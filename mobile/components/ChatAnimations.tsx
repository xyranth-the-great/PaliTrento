import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IS_LOW_END_ANDROID, useReducedMotion } from '../lib/perf';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

export type MessageDeliveryStatus = 'sending' | 'sent' | 'read' | 'failed';

export function isSameCalendarDay(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatChatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (isSameCalendarDay(iso, now.toISOString())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(iso, yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// 1. Date Separator Pill
// ---------------------------------------------------------------------------
export const ChatDateSeparator = React.memo(function ChatDateSeparator({
  label,
}: {
  label: string;
}) {
  return (
    <View style={styles.dateRow}>
      <View style={styles.dateLine} />
      <View style={styles.datePill}>
        <Text style={styles.dateText}>{label}</Text>
      </View>
      <View style={styles.dateLine} />
    </View>
  );
});

// ---------------------------------------------------------------------------
// 2. Animated Chat Message Bubble (directional spring pop + grouping + press)
// ---------------------------------------------------------------------------
export interface AnimatedMessageBubbleProps {
  content: string;
  timestamp: string;
  own: boolean;
  /** Play entrance animation (only set true for newly sent/received messages) */
  animateEntrance?: boolean;
  /** Entrance stagger index for initial load (optional, kept short) */
  entranceDelay?: number;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  status?: MessageDeliveryStatus;
  senderLabel?: string;
  variant?: 'order' | 'support';
  onRetry?: () => void;
  extraFooter?: React.ReactNode;
}

export const AnimatedMessageBubble = React.memo(function AnimatedMessageBubble({
  content,
  timestamp,
  own,
  animateEntrance = false,
  entranceDelay = 0,
  isFirstInGroup = true,
  isLastInGroup = true,
  status,
  senderLabel,
  variant = 'order',
  onRetry,
  extraFooter,
}: AnimatedMessageBubbleProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animateEntrance && !reduceMotion;

  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const translateY = useRef(
    new Animated.Value(shouldAnimate ? (IS_LOW_END_ANDROID ? 10 : 16) : 0)
  ).current;
  const translateX = useRef(
    new Animated.Value(
      shouldAnimate ? (own ? (IS_LOW_END_ANDROID ? 10 : 18) : IS_LOW_END_ANDROID ? -10 : -18) : 0
    )
  ).current;
  const enterScale = useRef(new Animated.Value(shouldAnimate ? 0.94 : 1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const deliveryOpacity = useRef(new Animated.Value(status === 'sending' ? 0.78 : 1)).current;

  const [showExactMeta, setShowExactMeta] = useState(false);

  useEffect(() => {
    if (!shouldAnimate) return;
    const delay = IS_LOW_END_ANDROID ? Math.min(entranceDelay, 40) : Math.min(entranceDelay, 120);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: IS_LOW_END_ANDROID ? 150 : 200,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      IS_LOW_END_ANDROID
        ? Animated.timing(translateY, {
            toValue: 0,
            duration: 170,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(translateY, {
            toValue: 0,
            delay,
            tension: 210,
            friction: 21,
            useNativeDriver: true,
          }),
      IS_LOW_END_ANDROID
        ? Animated.timing(translateX, {
            toValue: 0,
            duration: 170,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(translateX, {
            toValue: 0,
            delay,
            tension: 210,
            friction: 21,
            useNativeDriver: true,
          }),
      IS_LOW_END_ANDROID
        ? Animated.timing(enterScale, {
            toValue: 1,
            duration: 160,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(enterScale, {
            toValue: 1,
            delay,
            tension: 220,
            friction: 20,
            useNativeDriver: true,
          }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [enterScale, entranceDelay, opacity, shouldAnimate, translateX, translateY]);

  useEffect(() => {
    Animated.timing(deliveryOpacity, {
      toValue: status === 'sending' ? 0.76 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [deliveryOpacity, status]);

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 0.975,
      tension: 340,
      friction: 22,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 260,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  // Smart grouped corners (Messenger / iMessage style)
  const cornerStyle = own
    ? {
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderTopRightRadius: isFirstInGroup ? 18 : 6,
        borderBottomRightRadius: isLastInGroup ? 5 : 6,
      }
    : {
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
        borderTopLeftRadius: isFirstInGroup ? 18 : 6,
        borderBottomLeftRadius: isLastInGroup ? 5 : 6,
      };

  const isSupportOther = variant === 'support' && !own;
  const showMetaRow = isLastInGroup || showExactMeta || status === 'failed';

  return (
    <Animated.View
      style={[
        styles.msgRow,
        own ? styles.msgOwn : styles.msgOther,
        {
          marginTop: isFirstInGroup ? 10 : 3,
          opacity: Animated.multiply(opacity, deliveryOpacity),
          transform: [
            { translateX },
            { translateY },
            { scale: Animated.multiply(enterScale, pressScale) },
          ],
        },
      ]}
    >
      {senderLabel && isFirstInGroup ? (
        <Text
          style={[
            styles.senderLabel,
            own ? styles.senderLabelOwn : isSupportOther && { color: COLORS.info },
          ]}
        >
          {senderLabel}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          if (status === 'failed' && onRetry) {
            onRetry();
          } else {
            setShowExactMeta((v) => !v);
          }
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.bubble,
          cornerStyle,
          own
            ? styles.bubbleOwn
            : isSupportOther
              ? styles.bubbleSupportOther
              : styles.bubbleOther,
          status === 'failed' && styles.bubbleFailed,
        ]}
      >
        <Text style={[styles.bubbleText, own && styles.bubbleTextOwn]}>{content}</Text>
        {extraFooter}
      </Pressable>

      {showMetaRow ? (
        <View style={[styles.metaRow, own && styles.metaRowOwn]}>
          <Text style={styles.time}>{formatChatTime(timestamp)}</Text>
          {own && status === 'sending' ? (
            <View style={styles.statusWrap}>
              <Ionicons name="time-outline" size={11} color={COLORS.muted} />
              <Text style={styles.statusText}>Sending</Text>
            </View>
          ) : null}
          {own && status === 'sent' ? (
            <Ionicons name="checkmark" size={12.5} color={COLORS.muted} />
          ) : null}
          {own && status === 'read' ? (
            <View style={styles.statusWrap}>
              <Ionicons name="checkmark-done" size={13} color={COLORS.primary} />
              <Text style={[styles.statusText, { color: COLORS.primary }]}>Read</Text>
            </View>
          ) : null}
          {own && status === 'failed' ? (
            <Pressable onPress={onRetry} style={styles.retryPill} hitSlop={6}>
              <Ionicons name="alert-circle" size={12} color={COLORS.bad} />
              <Text style={styles.retryText}>Failed • Tap to retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// 3. Animated 3-Dot Typing Indicator Bubble
// ---------------------------------------------------------------------------
export function TypingIndicatorBubble({
  visible,
  label,
}: {
  visible: boolean;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [rendered, setRendered] = useState(visible);

  const containerAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.spring(containerAnim, {
        toValue: 1,
        tension: 210,
        friction: 19,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(containerAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [containerAnim, visible]);

  useEffect(() => {
    if (!rendered || reduceMotion) return;
    const makeDotLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 360 - delay)),
        ])
      );

    const l1 = makeDotLoop(dot1, 0);
    const l2 = makeDotLoop(dot2, 140);
    const l3 = makeDotLoop(dot3, 280);
    l1.start();
    l2.start();
    l3.start();

    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
    };
  }, [dot1, dot2, dot3, reduceMotion, rendered]);

  if (!rendered) return null;

  const translateY = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const scale = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  return (
    <Animated.View
      style={[
        styles.typingRow,
        {
          opacity: containerAnim,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View style={styles.typingBubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 1],
                }),
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4.5],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      {label ? <Text style={styles.typingLabel}>{label}</Text> : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// 4. Animated Send Button (active pop + tactile press + paper-plane impulse)
// ---------------------------------------------------------------------------
export function AnimatedSendButton({
  enabled,
  loading = false,
  onPress,
}: {
  enabled: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const activeAnim = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const flyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      activeAnim.setValue(enabled ? 1 : 0);
      return;
    }
    Animated.spring(activeAnim, {
      toValue: enabled ? 1 : 0,
      tension: 260,
      friction: 18,
      useNativeDriver: true,
    }).start();
  }, [activeAnim, enabled, reduceMotion]);

  const handlePressIn = () => {
    if (!enabled || reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 0.86,
      tension: 360,
      friction: 20,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 240,
      friction: 15,
      useNativeDriver: true,
    }).start();
  };

  const handleTap = () => {
    if (!enabled || loading) return;
    if (!reduceMotion) {
      flyAnim.setValue(0);
      Animated.sequence([
        Animated.timing(flyAnim, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(flyAnim, {
          toValue: 0,
          tension: 260,
          friction: 18,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPress();
  };

  const readyScale = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const btnOpacity = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 1],
  });
  const iconRotate = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '0deg'],
  });
  const flyX = flyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });
  const flyY = flyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  return (
    <Pressable
      onPress={handleTap}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!enabled || loading}
      accessibilityRole="button"
      accessibilityLabel="Send message"
    >
      <Animated.View
        style={[
          styles.sendBtn,
          {
            opacity: btnOpacity,
            transform: [{ scale: Animated.multiply(readyScale, pressScale) }],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Animated.View
            style={{
              transform: [
                { translateX: flyX },
                { translateY: flyY },
                { rotate: iconRotate },
              ],
            }}
          >
            <Ionicons name="send" size={17} color={COLORS.white} style={{ marginLeft: 1.5 }} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// 5. Floating "Jump to Latest" FAB with Unread Counter Badge
// ---------------------------------------------------------------------------
export function ScrollToBottomFab({
  visible,
  unreadCount = 0,
  onPress,
  bottomOffset = 74,
}: {
  visible: boolean;
  unreadCount?: number;
  onPress: () => void;
  bottomOffset?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (reduceMotion) {
        anim.setValue(1);
        return;
      }
      Animated.spring(anim, {
        toValue: 1,
        tension: 230,
        friction: 18,
        useNativeDriver: true,
      }).start();
    } else {
      if (reduceMotion) {
        anim.setValue(0);
        setRendered(false);
        return;
      }
      Animated.timing(anim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [anim, reduceMotion, visible]);

  if (!rendered) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.fabWrap,
        {
          bottom: bottomOffset,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.82, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.fabBtn,
          unreadCount > 0 && styles.fabBtnUnread,
          pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
        ]}
      >
        {unreadCount > 0 ? (
          <Text style={styles.fabUnreadText}>
            {unreadCount} new
          </Text>
        ) : null}
        <Ionicons
          name="chevron-down"
          size={18}
          color={unreadCount > 0 ? COLORS.white : COLORS.primary}
        />
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// 6. Pulsing Chat Bubble Loading Skeleton
// ---------------------------------------------------------------------------
export function ChatLoadingSkeleton() {
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.95,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const rows: { own: boolean; width: `${number}%`; height: number }[] = [
    { own: false, width: '64%', height: 42 },
    { own: false, width: '48%', height: 36 },
    { own: true, width: '58%', height: 44 },
    { own: false, width: '72%', height: 54 },
    { own: true, width: '44%', height: 38 },
  ];

  return (
    <View style={styles.skeletonWrap}>
      {rows.map((r, i) => (
        <Animated.View
          key={i}
          style={[
            styles.skeletonBubble,
            r.own ? styles.skeletonOwn : styles.skeletonOther,
            { width: r.width, height: r.height, opacity: pulse },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 7. Animated Quick Reply Chips Bar
// ---------------------------------------------------------------------------
export function QuickReplyBar({
  visible,
  replies,
  onSelect,
}: {
  visible: boolean;
  replies: readonly string[];
  onSelect: (text: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: reduceMotion ? 0 : 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: reduceMotion ? 0 : 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [anim, reduceMotion, visible]);

  if (!rendered || replies.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.quickWrap,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.quickScroll}
      >
        {replies.map((reply) => (
          <Pressable
            key={reply}
            onPress={() => onSelect(reply)}
            style={({ pressed }) => [
              styles.quickChip,
              pressed && { opacity: 0.82, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons name="sparkles-outline" size={12} color={COLORS.primary} />
            <Text style={styles.quickChipText}>{reply}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
    paddingHorizontal: 6,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.line,
  },
  datePill: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.mutedBg,
  },
  dateText: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    color: COLORS.muted,
    letterSpacing: 0.2,
  },
  msgRow: {
    maxWidth: '82%',
  },
  msgOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.muted,
    marginBottom: 3,
    marginHorizontal: 4,
  },
  senderLabelOwn: {
    color: COLORS.primary,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: COLORS.primary,
    ...SHADOW.card,
  },
  bubbleOther: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW.card,
  },
  bubbleSupportOther: {
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.24)',
    ...SHADOW.card,
  },
  bubbleFailed: {
    borderWidth: 1.5,
    borderColor: COLORS.bad,
    opacity: 0.9,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    lineHeight: 20,
    color: COLORS.ink,
  },
  bubbleTextOwn: {
    color: COLORS.white,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 3,
  },
  metaRowOwn: {
    justifyContent: 'flex-end',
  },
  time: {
    fontSize: 10.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusText: {
    fontSize: 10.5,
    fontFamily: FONTS.semibold,
    color: COLORS.muted,
  },
  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.badBg,
  },
  retryText: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    color: COLORS.bad,
  },
  typingRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW.card,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
  },
  typingLabel: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.muted,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.card,
  },
  fabWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  fabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 40,
    height: 40,
    paddingHorizontal: 11,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW.floating,
  },
  fabBtnUnread: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    paddingHorizontal: 13,
  },
  fabUnreadText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 18,
    gap: 12,
  },
  skeletonBubble: {
    borderRadius: 18,
  },
  skeletonOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#D6E5DB',
    borderBottomRightRadius: 5,
  },
  skeletonOther: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.mutedBg,
    borderBottomLeftRadius: 5,
  },
  quickWrap: {
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
    paddingVertical: 8,
  },
  quickScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW.card,
  },
  quickChipText: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: COLORS.ink,
  },
});
