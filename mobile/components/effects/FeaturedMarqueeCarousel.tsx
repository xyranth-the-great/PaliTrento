import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../../lib/theme';
import { IS_LOW_END_ANDROID } from '../../lib/perf';
import { GOLD_CHROME } from './showcaseConfig';

interface FeaturedMarqueeCarouselProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemWidth: number;
  gap?: number;
  speedPxPerSec?: number;
  fadeColor?: string;
  style?: StyleProp<ViewStyle>;
  showPauseButton?: boolean;
  paused?: boolean;
}

/**
 * Continuous seamless auto-scrolling marquee carousel mirroring the PaliTrento
 * website's Featured Stores & Stores Carousels (`js/ui.js` & `css/styles.css:336-458`):
 * - Smooth 40 px/s infinite loop using cloned sets (no jump at wrap point)
 * - Left & right edge fade masks
 * - Floating Pause / Play toggle pill
 * - Automatically pauses during manual touch/drag & resumes cleanly afterward
 * - Respects system Reduce Motion accessibility setting
 */
export function FeaturedMarqueeCarousel<T>({
  data,
  keyExtractor,
  renderItem,
  itemWidth,
  gap = 12,
  speedPxPerSec = 40,
  fadeColor = COLORS.bg,
  style,
  showPauseButton = true,
  paused = false,
}: FeaturedMarqueeCarouselProps<T>) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastDrawTsRef = useRef<number>(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    const appSub = AppState.addEventListener('change', (s) => {
      if (mounted) setAppActive(s === 'active');
    });
    return () => {
      mounted = false;
      sub.remove();
      appSub.remove();
    };
  }, []);

  const stride = itemWidth + gap;
  const setWidth = data.length * stride;
  const marqueeEnabled = data.length >= 2 && !reduceMotion;

  // Use fewer cloned cards on low-end Android devices to save RAM and GPU memory
  const copyCount = useMemo(() => {
    if (!marqueeEnabled || setWidth <= 0) return 1;
    if (IS_LOW_END_ANDROID) return 2;
    return Math.max(3, Math.ceil(960 / setWidth) + 2);
  }, [marqueeEnabled, setWidth]);

  const clonedData = useMemo(() => {
    if (!marqueeEnabled) return data.map((item, idx) => ({ item, idx, copy: 0 }));
    const out: { item: T; idx: number; copy: number }[] = [];
    for (let copy = 0; copy < copyCount; copy++) {
      for (let idx = 0; idx < data.length; idx++) {
        out.push({ item: data[idx], idx, copy });
      }
    }
    return out;
  }, [copyCount, data, marqueeEnabled]);

  // Anchor to middle copy once laid out so forward & backward swipe both loop cleanly
  const anchorToMiddle = useCallback(() => {
    if (!marqueeEnabled || setWidth <= 0) return;
    offsetRef.current = setWidth;
    initializedRef.current = true;
    scrollRef.current?.scrollTo({ x: setWidth, animated: false });
  }, [marqueeEnabled, setWidth]);

  useEffect(() => {
    initializedRef.current = false;
    const t = setTimeout(anchorToMiddle, 50);
    return () => clearTimeout(t);
  }, [anchorToMiddle]);

  // Smooth RAF marquee loop (pauses when unfocused, backgrounded, or user-paused; 30fps cap on low-end Android)
  useEffect(() => {
    if (!marqueeEnabled || userPaused || paused || !appActive || setWidth <= 0) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      lastDrawTsRef.current = 0;
      return;
    }

    const minIntervalMs = IS_LOW_END_ANDROID ? 33 : 16;
    const wrapLimit = copyCount >= 3 ? setWidth * 2 : setWidth;
    const wrapFloor = copyCount >= 3 ? setWidth * 0.5 : 0;

    const tick = (ts: number) => {
      if (lastDrawTsRef.current > 0 && ts - lastDrawTsRef.current < minIntervalMs) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }
      const dtSec = Math.min(0.06, Math.max(0, (ts - lastTsRef.current) / 1000));
      lastTsRef.current = ts;
      lastDrawTsRef.current = ts;

      if (!draggingRef.current && initializedRef.current) {
        let next = offsetRef.current + speedPxPerSec * dtSec;
        if (next >= wrapLimit) {
          next -= setWidth;
        } else if (next < wrapFloor) {
          next += setWidth;
        }
        offsetRef.current = next;
        scrollRef.current?.scrollTo({ x: next, animated: false });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
    };
  }, [appActive, copyCount, marqueeEnabled, paused, setWidth, speedPxPerSec, userPaused]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const pauseForInteraction = () => {
    draggingRef.current = true;
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const scheduleResumeAfterInteraction = (currentX?: number) => {
    if (typeof currentX === 'number' && marqueeEnabled && setWidth > 0) {
      let wrapped = currentX;
      while (wrapped >= setWidth * 2) wrapped -= setWidth;
      while (wrapped < setWidth) wrapped += setWidth;
      if (Math.abs(wrapped - currentX) > 1) {
        scrollRef.current?.scrollTo({ x: wrapped, animated: false });
      }
      offsetRef.current = wrapped;
    }
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      draggingRef.current = false;
      lastTsRef.current = null;
    }, 1100);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (draggingRef.current) {
      offsetRef.current = e.nativeEvent.contentOffset.x;
    }
  };

  const transparentBg = fadeColor === '#FFFFFF' ? 'rgba(255,255,255,0)' : 'rgba(246,247,245,0)';

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onScroll={handleScroll}
        onScrollBeginDrag={pauseForInteraction}
        onScrollEndDrag={(e) =>
          scheduleResumeAfterInteraction(e.nativeEvent.contentOffset.x)
        }
        onMomentumScrollEnd={(e) =>
          scheduleResumeAfterInteraction(e.nativeEvent.contentOffset.x)
        }
        contentContainerStyle={[
          styles.track,
          !marqueeEnabled && styles.staticTrack,
        ]}
      >
        {clonedData.map(({ item, idx, copy }) => (
          <View
            key={`${copy}-${keyExtractor(item, idx)}`}
            style={{ width: itemWidth, marginRight: gap }}
          >
            {renderItem(item, idx)}
          </View>
        ))}
      </ScrollView>

      {/* Left & right edge fade masks in marquee mode */}
      {marqueeEnabled && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[fadeColor, transparentBg]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fadeLeft}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[transparentBg, fadeColor]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fadeRight}
          />
        </>
      )}

      {/* Floating Pause / Play toggle mirroring `.carousel-pause-play-btn` */}
      {marqueeEnabled && showPauseButton && (
        <Pressable
          onPress={() => setUserPaused((p) => !p)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={userPaused ? 'Play featured stores' : 'Pause featured stores'}
          style={({ pressed }) => [
            styles.pauseBtn,
            pressed && { transform: [{ scale: 0.92 }], opacity: 0.9 },
          ]}
        >
          <Ionicons
            name={userPaused ? 'play' : 'pause'}
            size={13}
            color="#FFF7D6"
            style={userPaused ? { marginLeft: 1.5 } : undefined}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'visible',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 4,
  },
  staticTrack: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  fadeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 24,
    zIndex: 6,
  },
  fadeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 24,
    zIndex: 6,
  },
  pauseBtn: {
    position: 'absolute',
    right: 18,
    bottom: 20,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(20, 10, 0, 0.84)',
    borderWidth: 1,
    borderColor: GOLD_CHROME.edgeGold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});
