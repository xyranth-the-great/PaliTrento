import { useEffect, useState } from 'react';
import { AccessibilityInfo, PixelRatio, Platform } from 'react-native';

/**
 * Heuristic for low-end / older Android devices (Android 10 / API <= 29 or low-DPI budget screens)
 * so we can trim heavy animations, marquee clones, and FlatList memory footprint automatically.
 */
export const IS_LOW_END_ANDROID =
  Platform.OS === 'android' &&
  ((typeof Platform.Version === 'number' && Platform.Version <= 29) || PixelRatio.get() <= 2);

/** Tuned FlatList virtualization defaults — lighter memory window on low-end Android. */
export const LIST_PERF_PROPS = IS_LOW_END_ANDROID
  ? {
      initialNumToRender: 6,
      maxToRenderPerBatch: 5,
      windowSize: 5,
      updateCellsBatchingPeriod: 60,
    }
  : {
      initialNumToRender: 8,
      maxToRenderPerBatch: 8,
      windowSize: 7,
      updateCellsBatchingPeriod: 50,
    };

let cachedReduceMotion = false;
let reduceMotionLoaded = false;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(cachedReduceMotion);

  useEffect(() => {
    let mounted = true;
    if (!reduceMotionLoaded) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          cachedReduceMotion = Boolean(enabled);
          reduceMotionLoaded = true;
          if (mounted) setReduced(cachedReduceMotion);
        })
        .catch(() => {});
    }
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      cachedReduceMotion = Boolean(enabled);
      if (mounted) setReduced(cachedReduceMotion);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
