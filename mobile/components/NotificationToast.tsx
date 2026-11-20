import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';
import type { Tone } from './ui';

const TONE_ACCENT: Record<Tone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ok: { bg: COLORS.okBg, fg: COLORS.ok, icon: 'checkmark-circle' },
  warn: { bg: COLORS.warnBg, fg: COLORS.warn, icon: 'alert-circle' },
  bad: { bg: COLORS.badBg, fg: COLORS.bad, icon: 'warning' },
  info: { bg: COLORS.infoBg, fg: COLORS.info, icon: 'notifications' },
  muted: { bg: COLORS.mutedBg, fg: COLORS.muted, icon: 'notifications-outline' },
};

export function NotificationToast() {
  const insets = useSafeAreaInsets();
  const { activeToast, dismissToast } = useNotifications();
  const slide = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateOutAndDismiss = useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(slide, { toValue: -120, duration: 170, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        dismissToast();
        if (after) after();
      });
    },
    [dismissToast, opacity, slide]
  );

  const dismissRef = useRef(animateOutAndDismiss);
  dismissRef.current = animateOutAndDismiss;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_evt, g) => {
          if (g.dy < 0) {
            slide.setValue(g.dy);
          }
        },
        onPanResponderRelease: (_evt, g) => {
          if (g.dy < -28 || g.vy < -0.5) {
            dismissRef.current();
          } else {
            Animated.spring(slide, {
              toValue: 0,
              useNativeDriver: true,
              speed: 22,
              bounciness: 6,
            }).start();
          }
        },
      }),
    [slide]
  );

  useEffect(() => {
    if (activeToast) {
      slide.setValue(-100);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [activeToast, opacity, slide]);

  if (!activeToast) return null;

  const accent = TONE_ACCENT[activeToast.tone] || TONE_ACCENT.info;

  const handlePress = () => {
    const fn = activeToast.onPress;
    animateOutAndDismiss(fn);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      {...panResponder.panHandlers}
      style={[
        styles.wrap,
        { top: insets.top + 8, opacity, transform: [{ translateY: slide }] },
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: accent.bg }]}>
          <Ionicons name={accent.icon} size={20} color={accent.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={[styles.tag, { color: accent.fg }]} numberOfLines={1}>
              {activeToast.tag}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {activeToast.title}
          </Text>
          {activeToast.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {activeToast.body}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            animateOutAndDismiss();
          }}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityLabel="Dismiss alert"
        >
          <Ionicons name="close" size={16} color={COLORS.muted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    ...SHADOW.floating,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    fontSize: 9.5,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 13.5,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
    marginTop: 1,
  },
  body: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    lineHeight: 16.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
