import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polyline } from 'react-native-svg';
import { RADIUS } from '../../lib/theme';
import {
  PIKACHU_CARD_BOLTS,
  PIKACHU_DETAIL_BOLTS,
  PIKACHU_SPARKLES,
} from './showcaseConfig';

interface PikachuShowcaseFrameProps {
  children: React.ReactNode;
  variant?: 'card' | 'detail';
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}

/**
 * Pikachu / Electric Product Showcase Effect (`product-card--pk` & `pk-showcase`):
 * - Spinning electric gold/white/cyan conic-style border ring (`3.5s linear infinite`)
 * - Electric surge flicker glow (`pk-flick`, `3.2s` double-surge flash cadence)
 * - Holographic yellow/white/cyan foil drift (`pk-holo`, `5.5s`)
 * - 6 twinkling golden/white star sparkles (`pk-glit`)
 * - 6 (card) or 9 (detail) zapping SVG lightning bolts (`pk-bolt`) with double-flash zap cadence
 * - Detail mode: passive touch-tracked 3D tilt (`perspective` + `rotateX` / `rotateY`)!
 */
export function PikachuShowcaseFrame({
  children,
  variant = 'card',
  borderRadius = variant === 'detail' ? 18 : RADIUS.lg,
  style,
  innerStyle,
}: PikachuShowcaseFrameProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const surge = useRef(new Animated.Value(0)).current;
  const holo = useRef(new Animated.Value(0)).current;
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState({ w: variant === 'detail' ? 340 : 180, h: variant === 'detail' ? 320 : 250 });

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Mirrors website `pk-flick` 3.2s cadence: baseline -> 8% surge -> 11% dip -> 14% flash -> 72% surge
    const surgeLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(240),
        Animated.timing(surge, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(surge, { toValue: 0.35, duration: 80, useNativeDriver: true }),
        Animated.timing(surge, { toValue: 0.92, duration: 90, useNativeDriver: true }),
        Animated.timing(surge, { toValue: 0.25, duration: 150, useNativeDriver: true }),
        Animated.delay(1650),
        Animated.timing(surge, { toValue: 0.85, duration: 100, useNativeDriver: true }),
        Animated.timing(surge, { toValue: 0.25, duration: 150, useNativeDriver: true }),
        Animated.delay(650),
      ])
    );

    const holoLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(holo, {
          toValue: 1,
          duration: 5500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(holo, {
          toValue: 0,
          duration: 5500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinLoop.start();
    surgeLoop.start();
    holoLoop.start();

    return () => {
      spinLoop.stop();
      surgeLoop.stop();
      holoLoop.stop();
    };
  }, [holo, spin, surge]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (
      width > 0 &&
      height > 0 &&
      width < 1200 &&
      height < 1200 &&
      (Math.abs(width - box.w) > 4 || Math.abs(height - box.h) > 4)
    ) {
      setBox({ w: width, h: height });
    }
  };

  const updateTilt = (e: GestureResponderEvent) => {
    if (variant !== 'detail' || box.w <= 0 || box.h <= 0) return;
    const nx = Math.max(-1, Math.min(1, (e.nativeEvent.locationX / box.w) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, (e.nativeEvent.locationY / box.h) * 2 - 1));
    tiltY.setValue(nx * 10);
    tiltX.setValue(-ny * 8);
  };

  const resetTilt = () => {
    if (variant !== 'detail') return;
    Animated.parallel([
      Animated.spring(tiltX, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.spring(tiltY, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const outerHaloOpacity = surge.interpolate({ inputRange: [0, 1], outputRange: [0.30, 0.78] });
  const innerHaloOpacity = surge.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.95] });
  const holoShift = holo.interpolate({ inputRange: [0, 1], outputRange: [-65, 65] });
  const rotXStr = tiltX.interpolate({ inputRange: [-12, 12], outputRange: ['-12deg', '12deg'] });
  const rotYStr = tiltY.interpolate({ inputRange: [-12, 12], outputRange: ['-12deg', '12deg'] });

  const borderWidth = variant === 'detail' ? 4 : 3.5;
  const innerRadius = Math.max(4, borderRadius - borderWidth);
  const diag = Math.min(1100, Math.ceil(Math.hypot(box.w, box.h) * 1.2));
  const bolts = variant === 'detail' ? PIKACHU_DETAIL_BOLTS : PIKACHU_CARD_BOLTS;

  return (
    <Animated.View
      onTouchStart={updateTilt}
      onTouchMove={updateTilt}
      onTouchEnd={resetTilt}
      onTouchCancel={resetTilt}
      style={[
        styles.outer,
        variant === 'detail' && {
          transform: [{ perspective: 850 }, { rotateX: rotXStr }, { rotateY: rotYStr }],
        },
        style,
      ]}
    >
      {/* Electric surge outer halo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pkHaloOuter,
          { borderRadius: borderRadius + 7, opacity: outerHaloOpacity },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pkHaloInner,
          { borderRadius: borderRadius + 3, opacity: innerHaloOpacity },
        ]}
      />

      {/* Spinning Electric Conic Ring */}
      <View
        onLayout={onLayout}
        style={[
          styles.ringClip,
          { borderRadius, padding: borderWidth },
          variant === 'detail' && { flex: 1 },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: diag,
            height: diag,
            left: (box.w - diag) / 2,
            top: (box.h - diag) / 2,
            transform: [{ rotate }],
          }}
        >
          <LinearGradient
            colors={[
              '#FFE14D',
              '#FFFFFF',
              '#F5B400',
              '#FFD93B',
              '#9BE6FF',
              '#FFE14D',
              '#F5B400',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.absFill}
          />
        </Animated.View>

        {/* Inner Content Card */}
        <View style={[styles.inner, { borderRadius: innerRadius }, innerStyle]}>
          {children}

          {/* Holographic Electric Foil Overlay (card top media & full detail) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.holoLayer,
              variant === 'card' && styles.holoCardRegion,
              { transform: [{ translateX: holoShift }, { rotate: '-18deg' }] },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255, 225, 80, 0)',
                'rgba(255, 225, 80, 0.34)',
                'rgba(255, 255, 255, 0.30)',
                'rgba(120, 220, 255, 0.28)',
                'rgba(255, 225, 80, 0)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.7 }}
              style={styles.absFill}
            />
          </Animated.View>

          {/* Twinkling Sparkles (`pk-glit`) */}
          <View
            pointerEvents="none"
            style={[styles.sparklesWrap, variant === 'card' && styles.holoCardRegion]}
          >
            {PIKACHU_SPARKLES.map(([xPct, yPct, sz, delay], idx) => (
              <TwinkleSpark
                key={idx}
                xPct={xPct}
                yPct={yPct}
                size={variant === 'detail' ? sz + 1.5 : sz}
                delay={delay}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Zapping SVG Lightning Bolts around the perimeter */}
      <View pointerEvents="none" style={styles.boltsOverlay}>
        {bolts.map(([leftPct, topPct], idx) => (
          <PikachuBolt
            key={idx}
            index={idx}
            leftPct={leftPct}
            topPct={topPct}
            scale={variant === 'detail' ? 1.15 : 0.85}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function TwinkleSpark({
  xPct,
  yPct,
  size,
  delay,
}: {
  xPct: number;
  yPct: number;
  size: number;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    let active = true;
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      if (!active) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.2,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
      loop?.stop();
    };
  }, [anim, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        opacity: anim,
        shadowColor: '#FFE14D',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 4,
      }}
    />
  );
}

function PikachuBolt({
  index,
  leftPct,
  topPct,
  scale,
}: {
  index: number;
  leftPct: number;
  topPct: number;
  scale: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.8)).current;

  const angle = ((index * 47) % 70) - 35;
  const delay = index * 240;
  const cycleMs = 1750 + (index % 4) * 320;
  const idleMs = Math.max(680, cycleMs - 560);

  useEffect(() => {
    let active = true;
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      if (!active) return;
      // Mirrors website `pk-zap`: idle -> flash (scale 1) -> brief dip -> bright flash (scale 1.2) -> vanish
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(idleMs),
          Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 75, useNativeDriver: true }),
            Animated.timing(pop, { toValue: 1.05, duration: 75, useNativeDriver: true }),
          ]),
          Animated.timing(opacity, { toValue: 0.35, duration: 70, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 90, useNativeDriver: true }),
            Animated.timing(pop, { toValue: 1.24, duration: 90, useNativeDriver: true }),
          ]),
          Animated.delay(95),
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 130, useNativeDriver: true }),
            Animated.timing(pop, { toValue: 0.78, duration: 130, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
      loop?.stop();
    };
  }, [delay, idleMs, opacity, pop]);

  const w = Math.round(20 * scale);
  const h = Math.round(34 * scale);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: w,
        height: h,
        opacity,
        transform: [{ rotate: `${angle}deg` }, { scale: pop }],
      }}
    >
      <Svg width={w} height={h} viewBox="0 0 14 26">
        <Path
          d="M8 0L1 14h5l-2 12 9-16H8z"
          fill="#FFE14D"
          stroke="#FFFFFF"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * Animated sliding yellow zig-zag lightning underline (`pk-price::after`, `1.2s linear infinite`)
 * shown beneath the price on Pikachu showcase cards and product detail!
 */
export function PikachuPriceUnderline({
  width,
  style,
}: {
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const [measuredW, setMeasuredW] = useState(width ?? 116);
  const period = 10;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  const effectiveW = width ?? measuredW;
  const tx = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -period] });

  const totalW = effectiveW + period * 2;
  const points: string[] = [];
  for (let x = 0; x <= totalW; x += period / 2) {
    const y = (x / (period / 2)) % 2 === 0 ? 5.5 : 1.5;
    points.push(`${x},${y}`);
  }

  return (
    <View
      onLayout={(e) => {
        if (width == null) {
          const w = Math.ceil(e.nativeEvent.layout.width);
          if (w > 12 && Math.abs(w - measuredW) > 2) setMeasuredW(w);
        }
      }}
      style={[{ width: width ?? '100%', height: 7, overflow: 'hidden' }, style]}
    >
      <Animated.View style={{ width: totalW, height: 7, transform: [{ translateX: tx }] }}>
        <Svg width={totalW} height={7}>
          <Polyline
            points={points.join(' ')}
            fill="none"
            stroke="#F5B400"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={points.join(' ')}
            fill="none"
            stroke="#FFE14D"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  outer: {
    position: 'relative',
    overflow: 'visible',
  },
  pkHaloOuter: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    backgroundColor: 'rgba(255, 225, 77, 0.30)',
  },
  pkHaloInner: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    backgroundColor: 'rgba(255, 235, 90, 0.48)',
  },
  ringClip: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5B400',
    shadowColor: '#FFD93B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 7,
  },
  inner: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    zIndex: 2,
  },
  holoLayer: {
    position: 'absolute',
    top: '-25%',
    left: '-35%',
    right: '-35%',
    bottom: '-25%',
    zIndex: 4,
  },
  holoCardRegion: {
    bottom: '38%',
  },
  sparklesWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 5,
  },
  boltsOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'visible',
    zIndex: 12,
  },
});
