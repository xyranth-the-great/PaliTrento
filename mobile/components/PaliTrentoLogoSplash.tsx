import React, { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { FONTS } from '../lib/theme';

// Numeric & layout constants (each literal defined once)
const ZERO = 0;
const ONE = 1;
const POLE_REVEAL_EPSILON = 0.001;
const MS_PER_SECOND = 1000;

const VIEWBOX_X = 35;
const VIEWBOX_Y = 15;
const VIEWBOX_W = 465;
const VIEWBOX_H = 515;
const LOGO_VIEWBOX = `${VIEWBOX_X} ${VIEWBOX_Y} ${VIEWBOX_W} ${VIEWBOX_H}`;

const LOGO_WIDTH = 150;
const LOGO_HEIGHT = (LOGO_WIDTH * VIEWBOX_H) / VIEWBOX_W;
const OUTLINE_STROKE_WIDTH = 14;
const SCALLOP_DROP_UNITS = 70;
const SCALLOP_DROP_PX = -(SCALLOP_DROP_UNITS * LOGO_WIDTH) / VIEWBOX_W;

const BASE_CX = 267.5;
const BASE_CY = 490;
const BASE_RX = 82;
const BASE_RY = 22;
const BASE_SCALE_START = 0.3;

const EASE_X1 = 0.22;
const EASE_X2 = 0.36;
const SPLASH_EASING = Easing.bezier(EASE_X1, ONE, EASE_X2, ONE);

// Timeline constants (ms)
const SCALLOP_DURATION_MS = 0.6 * MS_PER_SECOND;
const SCALLOP_STAGGER_MS = 0.07 * MS_PER_SECOND;
const HALF_SECOND_MS = 0.5 * MS_PER_SECOND;
const POLE_DELAY_AND_BASE_DURATION_MS = 0.45 * MS_PER_SECOND;
const BASE_DELAY_MS = 0.85 * MS_PER_SECOND;
const WORDMARK_DELAY_MS = ONE * MS_PER_SECOND;
const TAGLINE_DELAY_MS = 1.15 * MS_PER_SECOND;
const MIN_DISPLAY_MS = 2 * MS_PER_SECOND;
const MAX_WAIT_MS = 4 * MS_PER_SECOND;
const FADE_OUT_MS = 0.4 * MS_PER_SECOND;
const REDUCE_HOLD_MS = 0.65 * MS_PER_SECOND;
const REDUCE_FADE_MS = 0.2 * MS_PER_SECOND;

// Typography, spacing & stacking
const WORDMARK_FONT_SIZE = 30;
const WORDMARK_LINE_HEIGHT = 38;
const WORDMARK_MARGIN_TOP = OUTLINE_STROKE_WIDTH;
const TAGLINE_FONT_SIZE = OUTLINE_STROKE_WIDTH;
const TAGLINE_LINE_HEIGHT = 20;
const TAGLINE_MARGIN_TOP = 6;
const TEXT_RISE_PX = 12;
const TEXT_PAD_H = 16;
const FULL_WIDTH = '100%';
const SPLASH_Z_INDEX = 9999;

// Exact colors
const BG_CREAM = '#fcf9f2';
const OUTLINE_WHITE = '#ffffff';
const WORDMARK_COLOR = '#1f4d2e';
const TAGLINE_COLOR = '#5b675f';
const BASE_FILL = '#1f4c47';
const POLE_FILL = '#70401a';
const SCALLOP_TEAL = '#1e4b46';
const SCALLOP_GOLD = '#fdc147';

// Transform origins matching logo coordinate anchors
const POLE_TRANSFORM_ORIGIN = '50% 26.2%';
const BASE_TRANSFORM_ORIGIN = '50% 92.2%';

// Exact copy & SVG vector paths
const WORDMARK_TEXT = 'PaliTrento';
const TAGLINE_TEXT = 'Tara, Palit Ta sa Trento!';
const POLE_PATH = 'M225 150H310V440L267.5 474L225 440Z';

const SCALLOPS: readonly { d: string; fill: string }[] = [
  { d: 'M55 46Q55 32 69 32H140V150A42.5 42.5 0 0 1 55 150Z', fill: SCALLOP_TEAL },
  { d: 'M140 32H225V150A42.5 42.5 0 0 1 140 150Z', fill: SCALLOP_GOLD },
  { d: 'M225 32H310V150A42.5 42.5 0 0 1 225 150Z', fill: SCALLOP_TEAL },
  { d: 'M310 32H395V150A42.5 42.5 0 0 1 310 150Z', fill: SCALLOP_GOLD },
  { d: 'M395 32H466Q480 32 480 46V150A42.5 42.5 0 0 1 395 150Z', fill: SCALLOP_TEAL },
];

export interface PaliTrentoLogoSplashProps {
  appReady: boolean;
  onFinish: () => void;
}

export function PaliTrentoLogoSplash({ appReady, onFinish }: PaliTrentoLogoSplashProps) {
  const scallopAnims = useRef(SCALLOPS.map(() => new Animated.Value(ZERO))).current;
  const poleAnim = useRef(new Animated.Value(ZERO)).current;
  const baseAnim = useRef(new Animated.Value(ZERO)).current;
  const wordmarkAnim = useRef(new Animated.Value(ZERO)).current;
  const taglineAnim = useRef(new Animated.Value(ZERO)).current;
  const screenOpacity = useRef(new Animated.Value(ONE)).current;

  const appReadyRef = useRef(appReady);
  const onFinishRef = useRef(onFinish);
  const nativeSplashHiddenRef = useRef(false);
  const minElapsedRef = useRef(false);
  const fadingRef = useRef(false);
  const finishedRef = useRef(false);
  const reduceMotionRef = useRef(false);

  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const fadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  appReadyRef.current = appReady;
  onFinishRef.current = onFinish;

  const clearTimers = useCallback(() => {
    if (minTimerRef.current !== null) {
      clearTimeout(minTimerRef.current);
      minTimerRef.current = null;
    }
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const startFadeOut = useCallback(() => {
    if (fadingRef.current || finishedRef.current) return;
    fadingRef.current = true;
    clearTimers();

    const duration = reduceMotionRef.current ? REDUCE_FADE_MS : FADE_OUT_MS;
    const anim = Animated.timing(screenOpacity, {
      toValue: ZERO,
      duration,
      easing: SPLASH_EASING,
      useNativeDriver: true,
    });
    fadeAnimRef.current = anim;
    anim.start(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinishRef.current();
    });
  }, [clearTimers, screenOpacity]);

  const handleRootLayout = useCallback(() => {
    if (nativeSplashHiddenRef.current) return;
    nativeSplashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const beginTimeline = (reduced: boolean) => {
      if (cancelled) return;
      reduceMotionRef.current = reduced;

      if (reduced) {
        scallopAnims.forEach((v) => v.setValue(ONE));
        poleAnim.setValue(ONE);
        baseAnim.setValue(ONE);
        wordmarkAnim.setValue(ONE);
        taglineAnim.setValue(ONE);
      } else {
        const anim = Animated.parallel([
          ...scallopAnims.map((v, idx) =>
            Animated.sequence([
              Animated.delay(idx * SCALLOP_STAGGER_MS),
              Animated.timing(v, {
                toValue: ONE,
                duration: SCALLOP_DURATION_MS,
                easing: SPLASH_EASING,
                useNativeDriver: true,
              }),
            ])
          ),
          Animated.sequence([
            Animated.delay(POLE_DELAY_AND_BASE_DURATION_MS),
            Animated.timing(poleAnim, {
              toValue: ONE,
              duration: HALF_SECOND_MS,
              easing: SPLASH_EASING,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(BASE_DELAY_MS),
            Animated.timing(baseAnim, {
              toValue: ONE,
              duration: POLE_DELAY_AND_BASE_DURATION_MS,
              easing: SPLASH_EASING,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(WORDMARK_DELAY_MS),
            Animated.timing(wordmarkAnim, {
              toValue: ONE,
              duration: HALF_SECOND_MS,
              easing: SPLASH_EASING,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(TAGLINE_DELAY_MS),
            Animated.timing(taglineAnim, {
              toValue: ONE,
              duration: HALF_SECOND_MS,
              easing: SPLASH_EASING,
              useNativeDriver: true,
            }),
          ]),
        ]);
        buildAnimRef.current = anim;
        anim.start();
      }

      const holdMs = reduced ? REDUCE_HOLD_MS : MIN_DISPLAY_MS;
      minTimerRef.current = setTimeout(() => {
        minElapsedRef.current = true;
        if (appReadyRef.current) {
          startFadeOut();
        }
      }, holdMs);

      maxTimerRef.current = setTimeout(() => {
        startFadeOut();
      }, MAX_WAIT_MS);
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => beginTimeline(Boolean(enabled)))
      .catch(() => beginTimeline(false));

    return () => {
      cancelled = true;
      clearTimers();
      buildAnimRef.current?.stop();
      fadeAnimRef.current?.stop();
    };
  }, [baseAnim, clearTimers, poleAnim, scallopAnims, startFadeOut, taglineAnim, wordmarkAnim]);

  useEffect(() => {
    if (appReady && minElapsedRef.current) {
      startFadeOut();
    }
  }, [appReady, startFadeOut]);

  const poleOpacity = poleAnim.interpolate({
    inputRange: [ZERO, POLE_REVEAL_EPSILON, ONE],
    outputRange: [ZERO, ONE, ONE],
  });
  const baseScale = baseAnim.interpolate({
    inputRange: [ZERO, ONE],
    outputRange: [BASE_SCALE_START, ONE],
  });
  const wordmarkTranslateY = wordmarkAnim.interpolate({
    inputRange: [ZERO, ONE],
    outputRange: [TEXT_RISE_PX, ZERO],
  });
  const taglineTranslateY = taglineAnim.interpolate({
    inputRange: [ZERO, ONE],
    outputRange: [TEXT_RISE_PX, ZERO],
  });

  return (
    <Animated.View
      onLayout={handleRootLayout}
      pointerEvents="auto"
      style={[styles.root, { opacity: screenOpacity }]}
    >
      <View style={styles.logoGroup}>
        <View style={styles.logoBox}>
          {/* Layer 1 (back): Base */}
          <Animated.View
            style={[
              styles.layer,
              {
                opacity: baseAnim,
                transformOrigin: BASE_TRANSFORM_ORIGIN,
                transform: [{ scale: baseScale }],
              },
            ]}
          >
            <Svg width={LOGO_WIDTH} height={LOGO_HEIGHT} viewBox={LOGO_VIEWBOX}>
              <Ellipse
                cx={BASE_CX}
                cy={BASE_CY}
                rx={BASE_RX}
                ry={BASE_RY}
                fill={OUTLINE_WHITE}
                stroke={OUTLINE_WHITE}
                strokeWidth={OUTLINE_STROKE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Ellipse cx={BASE_CX} cy={BASE_CY} rx={BASE_RX} ry={BASE_RY} fill={BASE_FILL} />
            </Svg>
          </Animated.View>

          {/* Layer 2: Pole */}
          <Animated.View
            style={[
              styles.layer,
              {
                opacity: poleOpacity,
                transformOrigin: POLE_TRANSFORM_ORIGIN,
                transform: [{ scaleY: poleAnim }],
              },
            ]}
          >
            <Svg width={LOGO_WIDTH} height={LOGO_HEIGHT} viewBox={LOGO_VIEWBOX}>
              <Path
                d={POLE_PATH}
                fill={OUTLINE_WHITE}
                stroke={OUTLINE_WHITE}
                strokeWidth={OUTLINE_STROKE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Path d={POLE_PATH} fill={POLE_FILL} />
            </Svg>
          </Animated.View>

          {/* Layers 3 to 7 (front): Scallops 0 to 4 */}
          {SCALLOPS.map((scallop, idx) => {
            const translateY = scallopAnims[idx].interpolate({
              inputRange: [ZERO, ONE],
              outputRange: [SCALLOP_DROP_PX, ZERO],
            });
            return (
              <Animated.View
                key={scallop.d}
                style={[
                  styles.layer,
                  {
                    opacity: scallopAnims[idx],
                    transform: [{ translateY }],
                  },
                ]}
              >
                <Svg width={LOGO_WIDTH} height={LOGO_HEIGHT} viewBox={LOGO_VIEWBOX}>
                  <Path
                    d={scallop.d}
                    fill={OUTLINE_WHITE}
                    stroke={OUTLINE_WHITE}
                    strokeWidth={OUTLINE_STROKE_WIDTH}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <Path d={scallop.d} fill={scallop.fill} />
                </Svg>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.textWrap,
            {
              opacity: wordmarkAnim,
              transform: [{ translateY: wordmarkTranslateY }],
            },
          ]}
        >
          <Text style={styles.wordmark} allowFontScaling={false}>
            {WORDMARK_TEXT}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.textWrap,
            {
              opacity: taglineAnim,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
          <Text style={styles.tagline} allowFontScaling={false}>
            {TAGLINE_TEXT}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: ZERO,
    right: ZERO,
    bottom: ZERO,
    left: ZERO,
    zIndex: SPLASH_Z_INDEX,
    backgroundColor: BG_CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGroup: {
    width: FULL_WIDTH,
    alignItems: 'center',
  },
  logoBox: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    top: ZERO,
    right: ZERO,
    bottom: ZERO,
    left: ZERO,
  },
  textWrap: {
    width: FULL_WIDTH,
    paddingHorizontal: TEXT_PAD_H,
    alignItems: 'center',
  },
  wordmark: {
    width: FULL_WIDTH,
    marginTop: WORDMARK_MARGIN_TOP,
    fontSize: WORDMARK_FONT_SIZE,
    lineHeight: WORDMARK_LINE_HEIGHT,
    includeFontPadding: false,
    fontFamily: FONTS.extrabold,
    color: WORDMARK_COLOR,
    textAlign: 'center',
  },
  tagline: {
    width: FULL_WIDTH,
    marginTop: TAGLINE_MARGIN_TOP,
    fontSize: TAGLINE_FONT_SIZE,
    lineHeight: TAGLINE_LINE_HEIGHT,
    includeFontPadding: false,
    fontFamily: FONTS.medium,
    color: TAGLINE_COLOR,
    textAlign: 'center',
  },
});
