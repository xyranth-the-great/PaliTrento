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
import { RADIUS } from '../../lib/theme';
import { SHOWCASE_EMBERS } from './showcaseConfig';

interface FireShowcaseFrameProps {
  children: React.ReactNode;
  variant?: 'card' | 'detail';
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}

/**
 * Charizard / Fire Product Showcase Effect (`product-card--fire` & `ps-showcase`):
 * - Dual counter-rotating fiery conic-style border rings (`4s` + `6s reverse`)
 * - Flickering warm orange/red outer aura (`1.8s alternate`)
 * - 12 rising drifting glowing embers floating above the card (`SHOWCASE_EMBERS`)
 * - Detail mode: rainbow holographic foil (`ps-holo`), diagonal specular sweep (`ps-sweep`),
 *   and passive touch-tracked 3D tilt (`perspective` + `rotateX` / `rotateY`)!
 */
export function FireShowcaseFrame({
  children,
  variant = 'card',
  borderRadius = variant === 'detail' ? 18 : RADIUS.lg,
  style,
  innerStyle,
}: FireShowcaseFrameProps) {
  const spinA = useRef(new Animated.Value(0)).current;
  const spinB = useRef(new Animated.Value(0)).current;
  const flicker = useRef(new Animated.Value(0)).current;
  const holo = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState({ w: variant === 'detail' ? 340 : 180, h: variant === 'detail' ? 320 : 250 });

  useEffect(() => {
    const aLoop = Animated.loop(
      Animated.timing(spinA, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const bLoop = Animated.loop(
      Animated.timing(spinB, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const flickLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    aLoop.start();
    bLoop.start();
    flickLoop.start();

    let holoLoop: Animated.CompositeAnimation | null = null;
    let sweepLoop: Animated.CompositeAnimation | null = null;
    if (variant === 'detail') {
      holoLoop = Animated.loop(
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
      sweepLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(2800),
          Animated.timing(sweep, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(1400),
          Animated.timing(sweep, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      holoLoop.start();
      sweepLoop.start();
    }

    return () => {
      aLoop.stop();
      bLoop.stop();
      flickLoop.stop();
      holoLoop?.stop();
      sweepLoop?.stop();
    };
  }, [flicker, holo, spinA, spinB, sweep, variant]);

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

  // Passive touch-tracked 3D tilt (never steals scrolling from ScrollView)
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

  const rotA = spinA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotB = spinB.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const auraOpacity = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.85] });
  const coreHaloOpacity = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] });
  const holoShift = holo.interpolate({ inputRange: [0, 1], outputRange: [-70, 70] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, box.w + 180] });
  const rotXStr = tiltX.interpolate({ inputRange: [-12, 12], outputRange: ['-12deg', '12deg'] });
  const rotYStr = tiltY.interpolate({ inputRange: [-12, 12], outputRange: ['-12deg', '12deg'] });

  const borderWidth = variant === 'detail' ? 4 : 3.5;
  const innerRadius = Math.max(4, borderRadius - borderWidth);
  const diag = Math.min(1100, Math.ceil(Math.hypot(box.w, box.h) * 1.2));
  const embers = variant === 'detail' ? SHOWCASE_EMBERS : SHOWCASE_EMBERS.slice(0, 10);
  const riseDistance = variant === 'detail' ? -72 : -52;

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
      {/* Flickering fire outer glow aura */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fireHaloOuter,
          { borderRadius: borderRadius + 7, opacity: auraOpacity },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fireHaloInner,
          { borderRadius: borderRadius + 3, opacity: coreHaloOpacity },
        ]}
      />

      {/* Clipped dual counter-rotating fire border */}
      <View
        onLayout={onLayout}
        style={[
          styles.ringClip,
          { borderRadius, padding: borderWidth },
          variant === 'detail' && { flex: 1 },
        ]}
      >
        {/* Primary Fire Conic-Style Spinner */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: diag,
            height: diag,
            left: (box.w - diag) / 2,
            top: (box.h - diag) / 2,
            transform: [{ rotate: rotA }],
          }}
        >
          <LinearGradient
            colors={['#FF5A1F', '#FFB02E', '#E5321B', '#FF8A1F', '#FFD45C', '#FF5A1F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.absFill}
          />
        </Animated.View>

        {/* Secondary Reverse Golden Highlight Sweep */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: diag,
            height: diag,
            left: (box.w - diag) / 2,
            top: (box.h - diag) / 2,
            transform: [{ rotate: rotB }],
          }}
        >
          <LinearGradient
            colors={[
              'rgba(255, 232, 150, 0)',
              'rgba(255, 232, 150, 0.92)',
              'rgba(255, 232, 150, 0)',
              'rgba(255, 176, 46, 0.55)',
              'rgba(255, 232, 150, 0)',
            ]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.absFill}
          />
        </Animated.View>

        {/* Inner Content Card */}
        <View style={[styles.inner, { borderRadius: innerRadius }, innerStyle]}>
          {children}

          {/* Detail-only Holographic Foil + Specular White Sweep */}
          {variant === 'detail' && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.holoLayer,
                  { transform: [{ translateX: holoShift }, { rotate: '-20deg' }] },
                ]}
              >
                <LinearGradient
                  colors={[
                    'rgba(255, 214, 90, 0)',
                    'rgba(255, 214, 90, 0.30)',
                    'rgba(120, 255, 200, 0.22)',
                    'rgba(120, 160, 255, 0.24)',
                    'rgba(255, 120, 220, 0.22)',
                    'rgba(255, 214, 90, 0)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.6 }}
                  style={styles.absFill}
                />
              </Animated.View>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sweepBeam,
                  { transform: [{ translateX: sweepX }, { skewX: '-22deg' }] },
                ]}
              >
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0)',
                    'rgba(255, 255, 255, 0.42)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.absFill}
                />
              </Animated.View>
            </>
          )}
        </View>
      </View>

      {/* Rising Glowing Embers Overlay */}
      <View pointerEvents="none" style={styles.embersOverlay}>
        {embers.map(([leftPct, size, delay, duration, driftX], idx) => (
          <FireEmber
            key={idx}
            leftPct={leftPct}
            size={variant === 'detail' ? size + 1 : size}
            delay={delay}
            duration={duration}
            driftX={driftX}
            riseDistance={riseDistance}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function FireEmber({
  leftPct,
  size,
  delay,
  duration,
  driftX,
  riseDistance,
}: {
  leftPct: number;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  riseDistance: number;
}) {
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      if (!active) return;
      loop = Animated.loop(
        Animated.timing(prog, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      );
      loop.start();
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
      loop?.stop();
    };
  }, [delay, duration, prog]);

  const translateY = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [0, riseDistance],
  });
  const translateX = prog.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, driftX * 0.6, driftX],
  });
  const scale = prog.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0.5, 1.05, 0.25],
  });
  const opacity = prog.interpolate({
    inputRange: [0, 0.12, 0.72, 1],
    outputRange: [0, 0.95, 0.75, 0],
  });

  return (
    <Animated.View
      style={[
        styles.emberWrap,
        {
          left: `${leftPct}%`,
          width: size * 2.2,
          height: size * 2.2,
          borderRadius: size * 1.1,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFF3B0',
          shadowColor: '#FF5A1F',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 4,
        }}
      />
    </Animated.View>
  );
}

/**
 * Animated sliding fire gradient underline (`ps-price::after`, `3s linear infinite`)
 * shown beneath the product price on Charizard fire showcase listings.
 */
export function FirePriceUnderline({
  width,
  height = 3.5,
  style,
}: {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const [measuredW, setMeasuredW] = useState(width ?? 110);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  const effectiveW = width ?? measuredW;
  const tx = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -effectiveW] });

  return (
    <View
      onLayout={(e) => {
        if (width == null) {
          const w = Math.ceil(e.nativeEvent.layout.width);
          if (w > 12 && Math.abs(w - measuredW) > 2) setMeasuredW(w);
        }
      }}
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: height / 2,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={{ width: effectiveW * 2, height, transform: [{ translateX: tx }] }}>
        <LinearGradient
          colors={[
            '#FF5A1F',
            '#FFB02E',
            '#FFD45C',
            '#FFB02E',
            '#FF5A1F',
            '#FFB02E',
            '#FFD45C',
            '#FFB02E',
            '#FF5A1F',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: effectiveW * 2, height }}
        />
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
  fireHaloOuter: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    backgroundColor: 'rgba(229, 50, 27, 0.28)',
  },
  fireHaloInner: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    backgroundColor: 'rgba(255, 138, 31, 0.42)',
  },
  ringClip: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FF5A1F',
    shadowColor: '#FF6A1F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.48,
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
    top: '-30%',
    left: '-40%',
    right: '-40%',
    bottom: '-30%',
    zIndex: 4,
  },
  sweepBeam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 84,
    zIndex: 5,
  },
  embersOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'visible',
    zIndex: 10,
  },
  emberWrap: {
    position: 'absolute',
    top: 2,
    backgroundColor: 'rgba(255, 146, 36, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
