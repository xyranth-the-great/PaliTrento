import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { IS_LOW_END_ANDROID, useReducedMotion } from '../lib/perf';

export interface FadeInViewProps {
  /** Entrance delay in ms (default 0) */
  delay?: number;
  /** Initial vertical rise offset in dp (default 12) */
  offsetY?: number;
  /** Duration in ms (default 240) */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Lightweight native-driver entrance animation (fade + gentle upward glide).
 * Respects system Reduce Motion and shortens motion cleanly on low-end Android.
 */
export function FadeInView({
  delay = 0,
  offsetY = 12,
  duration = 240,
  style,
  children,
}: FadeInViewProps) {
  const reduceMotion = useReducedMotion();
  const initialY = reduceMotion ? 0 : IS_LOW_END_ANDROID ? Math.min(offsetY, 8) : offsetY;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(initialY)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const animDuration = IS_LOW_END_ANDROID ? Math.min(duration, 180) : duration;
    const animDelay = IS_LOW_END_ANDROID ? Math.min(delay, 60) : delay;

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: animDuration,
        delay: animDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: animDuration,
        delay: animDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start();
    return () => anim.stop();
  }, [delay, duration, opacity, reduceMotion, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
