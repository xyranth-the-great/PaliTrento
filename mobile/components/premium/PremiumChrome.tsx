import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Battery from 'expo-battery';
import { PREMIUM_LIQUID } from './tokens';

export interface PremiumChromeProps {
  width?: number;
  height?: number;
  radius: number;
  fill?: boolean;
  loopSeconds?: number;
  still?: boolean;
  children?: React.ReactNode;
  zoom?: number;
  mode?: 'banner' | 'ring' | 'chip';
  visible?: boolean;
  phaseOffset?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

let animatedInstances = 0;

function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function ChromeLayers({
  width,
  height,
  radius,
  loopSeconds,
  still,
  visible,
}: {
  width: number;
  height: number;
  radius: number;
  loopSeconds: number;
  still: boolean;
  visible: boolean;
}) {
  const size = Math.max(width, height);
  const layerWidth = size * PREMIUM_LIQUID.layerWidthFactor;
  const layerHeight = size * PREMIUM_LIQUID.layerHeightFactor;
  const tileHeight = size * PREMIUM_LIQUID.tileHeightFactor;
  const halfTile = tileHeight / 2;

  const y1 = useRef(new Animated.Value(halfTile)).current;
  const y2 = useRef(new Animated.Value(-halfTile)).current;
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [budgetAvailable, setBudgetAvailable] = useState(false);
  const reserved = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });

    if (typeof Battery.isLowPowerModeEnabledAsync === 'function') {
      Battery.isLowPowerModeEnabledAsync()
        .then((enabled) => {
          if (mounted) setLowPower(Boolean(enabled));
        })
        .catch(() => {});
    }

    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (mounted) setAppActive(state === 'active');
    });
    const lowPowerSub =
      typeof Battery.addLowPowerModeListener === 'function'
        ? Battery.addLowPowerModeListener((e) => {
            if (mounted) setLowPower(Boolean(e?.lowPowerMode));
          })
        : null;

    return () => {
      mounted = false;
      motionSub.remove();
      appSub.remove();
      lowPowerSub?.remove();
    };
  }, []);

  useEffect(() => {
    if (!still && visible) {
      if (!reserved.current && animatedInstances < PREMIUM_LIQUID.maxAnimatedInstances) {
        animatedInstances += 1;
        reserved.current = true;
        setBudgetAvailable(true);
      } else if (reserved.current) {
        setBudgetAvailable(true);
      } else {
        setBudgetAvailable(false);
      }
    } else {
      if (reserved.current) {
        animatedInstances = Math.max(0, animatedInstances - 1);
        reserved.current = false;
      }
      setBudgetAvailable(false);
    }

    return () => {
      if (reserved.current) {
        animatedInstances = Math.max(0, animatedInstances - 1);
        reserved.current = false;
      }
    };
  }, [still, visible]);

  const animate = !still && visible && budgetAvailable && appActive && !reduceMotion && !lowPower;

  useEffect(() => {
    if (!animate) {
      y1.stopAnimation();
      y2.stopAnimation();
      return;
    }

    y1.setValue(halfTile);
    y2.setValue(-halfTile);

    const first = Animated.loop(
      Animated.sequence([
        Animated.timing(y1, {
          toValue: -halfTile,
          duration: loopSeconds * 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(y1, {
          toValue: halfTile,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const second = Animated.loop(
      Animated.sequence([
        Animated.timing(y2, {
          toValue: halfTile,
          duration: loopSeconds * 1000 * PREMIUM_LIQUID.layerTwoDurationFactor,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(y2, {
          toValue: -halfTile,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    first.start();
    second.start();
    return () => {
      first.stop();
      second.stop();
    };
  }, [animate, halfTile, loopSeconds, y1, y2]);

  const common = {
    width: layerWidth,
    height: layerHeight,
    left: (width - layerWidth) / 2,
    top: (height - layerHeight) / 2,
  } as const;

  const renderTile = (key: number) => (
    <LinearGradient
      key={key}
      colors={[...PREMIUM_LIQUID.bandColors]}
      locations={[...PREMIUM_LIQUID.bandLocations]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ width: layerWidth, height: tileHeight }}
    />
  );

  const stillY = -tileHeight * PREMIUM_LIQUID.stillOffsetFactor;

  return (
    <View pointerEvents="none" style={[styles.outer, { width, height, borderRadius: radius }]}>
      <Animated.View
        style={[
          styles.layer,
          common,
          {
            transform: [
              { rotate: PREMIUM_LIQUID.layerOneRotate },
              { translateY: animate ? y1 : stillY },
            ],
          },
        ]}
      >
        {renderTile(1)}
        {renderTile(2)}
      </Animated.View>

      {animate ? (
        <Animated.View
          style={[
            styles.layer,
            common,
            {
              opacity: PREMIUM_LIQUID.layerTwoOpacity,
              transform: [{ rotate: PREMIUM_LIQUID.layerTwoRotate }, { translateY: y2 }],
            },
          ]}
        >
          {renderTile(3)}
          {renderTile(4)}
        </Animated.View>
      ) : null}

      <View
        pointerEvents="none"
        style={[styles.rim, { borderRadius: radius, borderColor: PREMIUM_LIQUID.rimColor }]}
      />
    </View>
  );
}

export function PremiumChrome({
  width,
  height,
  radius,
  fill = false,
  loopSeconds = PREMIUM_LIQUID.defaultLoopSeconds,
  still = false,
  visible = true,
  style,
  contentStyle,
  children,
}: PremiumChromeProps) {
  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  const handleFillLayout = (event: LayoutChangeEvent) => {
    const nextW = event.nativeEvent.layout.width;
    const nextH = event.nativeEvent.layout.height;
    if (
      isValidDimension(nextW) &&
      isValidDimension(nextH) &&
      (Math.abs(nextW - measured.width) > 0.5 || Math.abs(nextH - measured.height) > 0.5)
    ) {
      setMeasured({ width: nextW, height: nextH });
    }
  };

  if (fill) {
    const ready = isValidDimension(measured.width) && isValidDimension(measured.height);
    return (
      <View
        pointerEvents="none"
        onLayout={handleFillLayout}
        style={[StyleSheet.absoluteFill, styles.fillOuter, { borderRadius: radius }, style]}
      >
        {ready ? (
          <ChromeLayers
            width={measured.width}
            height={measured.height}
            radius={radius}
            loopSeconds={loopSeconds}
            still={still}
            visible={visible}
          />
        ) : null}
      </View>
    );
  }

  const valid = isValidDimension(width) && isValidDimension(height);
  return (
    <View
      style={[
        styles.shell,
        valid ? { width, height } : null,
        { borderRadius: radius },
        style,
      ]}
    >
      {valid ? (
        <ChromeLayers
          width={width}
          height={height}
          radius={radius}
          loopSeconds={loopSeconds}
          still={still}
          visible={visible}
        />
      ) : null}
      {children ? <View style={[styles.content, contentStyle]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'relative', overflow: 'hidden' },
  fillOuter: { overflow: 'hidden' },
  outer: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  layer: { position: 'absolute', overflow: 'hidden' },
  rim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: PREMIUM_LIQUID.rimWidth,
  },
  content: { position: 'relative', zIndex: 2, flex: 1 },
});
