import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { COLORS, FONTS } from '../lib/theme';

interface AppSplashProps {
  onFinish: () => void;
}

const SCALLOPS: readonly { d: string; fill: string }[] = [
  { d: 'M55 46Q55 32 69 32H140V150A42.5 42.5 0 0 1 55 150Z', fill: '#1E4B46' },
  { d: 'M140 32H225V150A42.5 42.5 0 0 1 140 150Z', fill: '#FDC147' },
  { d: 'M225 32H310V150A42.5 42.5 0 0 1 225 150Z', fill: '#1E4B46' },
  { d: 'M310 32H395V150A42.5 42.5 0 0 1 310 150Z', fill: '#FDC147' },
  { d: 'M395 32H466Q480 32 480 46V150A42.5 42.5 0 0 1 395 150Z', fill: '#1E4B46' },
];

const LOGO_W = 84;
const LOGO_H = Math.round(LOGO_W * (515 / 465));

/**
 * Mirrors the website's signature sequential PaliTrento awning splash animation
 * (`index.html:33-55` & `css/styles.css:2528-2555`):
 * - 5 awning scallops drop in sequentially (70ms stagger, `pt-drop`)
 * - Brown stall pole grows downward (`pt-grow`)
 * - Base shadow pops in (`pt-pop`)
 * - Wordmark "PaliTrento" & tagline "Tara, Palit Ta sa Trento!" rise smoothly (`pt-rise`)
 */
export function AppSplash({ onFinish }: AppSplashProps) {
  const scallopAnims = useRef(SCALLOPS.map(() => new Animated.Value(0))).current;
  const poleAnim = useRef(new Animated.Value(0)).current;
  const baseAnim = useRef(new Animated.Value(0)).current;
  const wordAnim = useRef(new Animated.Value(0)).current;
  const tagAnim = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const easeOutExpo = Easing.bezier(0.22, 1, 0.36, 1);

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.stagger(
          70,
          scallopAnims.map((v) =>
            Animated.timing(v, {
              toValue: 1,
              duration: 500,
              easing: easeOutExpo,
              useNativeDriver: true,
            })
          )
        ),
        Animated.sequence([
          Animated.delay(340),
          Animated.timing(poleAnim, {
            toValue: 1,
            duration: 420,
            easing: easeOutExpo,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(640),
          Animated.spring(baseAnim, {
            toValue: 1,
            friction: 6,
            tension: 90,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(760),
          Animated.timing(wordAnim, {
            toValue: 1,
            duration: 420,
            easing: easeOutExpo,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(900),
          Animated.timing(tagAnim, {
            toValue: 1,
            duration: 400,
            easing: easeOutExpo,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(barProgress, {
          toValue: 1,
          duration: 1450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(160),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]);

    anim.start(() => onFinish());
    return () => anim.stop();
  }, [barProgress, baseAnim, onFinish, overlayOpacity, poleAnim, scallopAnims, tagAnim, wordAnim]);

  const barWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['10%', '100%'],
  });
  const poleScaleY = poleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] });
  const poleTy = poleAnim.interpolate({ inputRange: [0, 1], outputRange: [-22, 0] });
  const baseScale = baseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const wordTy = wordAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const tagTy = tagAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]}>
      <LinearGradient
        colors={['#122D1C', '#1B4329', '#235737']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.center}>
          <View style={styles.logoBadge}>
            <View style={{ width: LOGO_W, height: LOGO_H, position: 'relative' }}>
              {/* Base Shadow (pt-pop) */}
              <Animated.View
                style={[
                  styles.svgLayer,
                  { opacity: baseAnim, transform: [{ scale: baseScale }] },
                ]}
              >
                <Svg width={LOGO_W} height={LOGO_H} viewBox="35 15 465 515">
                  <Ellipse cx="267.5" cy="490" rx="82" ry="22" fill="#1F4C47" />
                </Svg>
              </Animated.View>

              {/* Brown Pole (pt-grow) */}
              <Animated.View
                style={[
                  styles.svgLayer,
                  {
                    opacity: poleAnim,
                    transform: [{ translateY: poleTy }, { scaleY: poleScaleY }],
                  },
                ]}
              >
                <Svg width={LOGO_W} height={LOGO_H} viewBox="35 15 465 515">
                  <Path d="M225 150H310V440L267.5 474L225 440Z" fill="#70401A" />
                </Svg>
              </Animated.View>

              {/* 5 Awning Scallops dropping in sequentially (pt-drop) */}
              {SCALLOPS.map((s, idx) => {
                const ty = scallopAnims[idx].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-32, 0],
                });
                return (
                  <Animated.View
                    key={idx}
                    style={[
                      styles.svgLayer,
                      {
                        opacity: scallopAnims[idx],
                        transform: [{ translateY: ty }],
                      },
                    ]}
                  >
                    <Svg width={LOGO_W} height={LOGO_H} viewBox="35 15 465 515">
                      <Path d={s.d} fill={s.fill} />
                    </Svg>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          <Animated.View
            style={{
              opacity: wordAnim,
              transform: [{ translateY: wordTy }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.wordmark}>
              Pali<Text style={styles.wordAmber}>Trento</Text>
            </Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: tagAnim,
              transform: [{ translateY: tagTy }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.tagline}>Tara, Palit Ta sa Trento!</Text>
          </Animated.View>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: barWidth }]} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(240,160,48,0.16)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -90,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  center: {
    alignItems: 'center',
    marginTop: -24,
  },
  logoBadge: {
    width: 118,
    height: 118,
    borderRadius: 30,
    backgroundColor: '#FCF9F2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 20,
    overflow: 'visible',
  },
  svgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  wordmark: {
    fontSize: 31,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
    letterSpacing: -0.8,
  },
  wordAmber: {
    color: '#FBC14E',
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: FONTS.semibold,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.78)',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 64,
    width: 88,
    height: 3.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FBC14E',
  },
});
