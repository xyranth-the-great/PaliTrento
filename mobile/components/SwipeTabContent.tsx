import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { IS_LOW_END_ANDROID, useReducedMotion } from '../lib/perf';

export interface SwipeTabContentProps {
  /** Currently active tab/category key */
  activeKey: string;
  /** Ordered list of keys used to determine slide direction and swipe neighbors */
  keys: readonly string[];
  /** Optional callback to enable horizontal finger-swipe between neighboring keys */
  onChangeKey?: (nextKey: string) => void;
  /** Enable/disable finger-swipe gesture (defaults to true when onChangeKey is provided) */
  swipeEnabled?: boolean;
  /** Slide distance in dp on tab change (default 44) */
  slideDistance?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Reusable native-driver directional slide + horizontal swipe container for
 * in-app tabs, segmented controls, and category filters.
 * Uses `useNativeDriver: true` for 60fps transitions even on low-end Android devices
 * and automatically disables motion when system Reduce Motion is enabled.
 */
export function SwipeTabContent({
  activeKey,
  keys,
  onChangeKey,
  swipeEnabled = true,
  slideDistance = 44,
  style,
  children,
}: SwipeTabContentProps) {
  const reduceMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const prevKeyRef = useRef<string>(activeKey);
  const prevIdxRef = useRef<number>(keys.indexOf(activeKey));

  const latestRef = useRef({ activeKey, keys, onChangeKey, swipeEnabled });
  latestRef.current = { activeKey, keys, onChangeKey, swipeEnabled };

  useEffect(() => {
    const nextIdx = keys.indexOf(activeKey);
    const prevKey = prevKeyRef.current;
    const prevIdx = prevIdxRef.current;

    prevKeyRef.current = activeKey;
    prevIdxRef.current = nextIdx;

    if (prevKey === activeKey || reduceMotion) {
      translateX.setValue(0);
      opacity.setValue(1);
      return;
    }

    const direction = nextIdx >= 0 && prevIdx >= 0 ? (nextIdx >= prevIdx ? 1 : -1) : 1;
    const dist = IS_LOW_END_ANDROID ? Math.min(slideDistance, 32) : slideDistance;
    const duration = IS_LOW_END_ANDROID ? 165 : 210;

    translateX.stopAnimation();
    opacity.stopAnimation();
    translateX.setValue(direction * dist);
    opacity.setValue(0.35);

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeKey, keys, opacity, reduceMotion, slideDistance, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          const { activeKey: cur, keys: list, onChangeKey: cb, swipeEnabled: enabled } =
            latestRef.current;
          if (!enabled || !cb || list.length < 2) return false;
          const absDx = Math.abs(gesture.dx);
          const absDy = Math.abs(gesture.dy);
          if (absDx < 26 || absDx < absDy * 1.75) return false;

          const idx = list.indexOf(cur);
          if (idx === -1) return false;
          // At boundaries, don't claim the gesture so parent bottom-tab swipe can take over
          if (gesture.dx > 0 && idx <= 0) return false;
          if (gesture.dx < 0 && idx >= list.length - 1) return false;
          return true;
        },
        onPanResponderRelease: (_evt, gesture) => {
          const { activeKey: cur, keys: list, onChangeKey: cb, swipeEnabled: enabled } =
            latestRef.current;
          if (!enabled || !cb) return;
          const idx = list.indexOf(cur);
          if (idx === -1) return;

          const swipedLeft = gesture.dx <= -48 || gesture.vx <= -0.4;
          const swipedRight = gesture.dx >= 48 || gesture.vx >= 0.4;

          if (swipedLeft && idx < list.length - 1) {
            cb(list[idx + 1]);
          } else if (swipedRight && idx > 0) {
            cb(list[idx - 1]);
          }
        },
      }),
    []
  );

  return (
    <Animated.View
      {...(onChangeKey && swipeEnabled ? panResponder.panHandlers : undefined)}
      style={[style, { opacity, transform: [{ translateX }] }]}
    >
      {children}
    </Animated.View>
  );
}
