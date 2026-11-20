import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_CONFIG: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  explore: { label: 'Explore', icon: 'compass-outline', activeIcon: 'compass' },
  map: { label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  orders: { label: 'Orders', icon: 'bag-check-outline', activeIcon: 'bag-check' },
  store: { label: 'Store', icon: 'storefront-outline', activeIcon: 'storefront' },
  admin: { label: 'Admin', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
  account: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
};

const DOCK_HORIZONTAL_PAD = 8;
const PILL_WIDTH = 48;

const TAB_TRANSITION_SPEC = {
  animation: 'timing' as const,
  config: {
    duration: 240,
    easing: Easing.out(Easing.cubic),
  },
};

// Which bottom tabs each role sees (hidden routes are still reachable in-app).
function visibleTabsFor(role?: string | null): string[] {
  const middle = role === 'admin' ? 'admin' : role === 'business_owner' ? 'store' : 'orders';
  return ['index', 'explore', 'map', middle, 'account'];
}

interface TabNavBridge {
  activeName: string;
  navigateByName: (name: string) => void;
}

const ModernTabBar = React.memo(function ModernTabBar({
  state,
  navigation,
  emitter,
  navigateToTab,
  visible,
  reduceMotion,
  navBridgeRef,
}: any) {
  const insets = useSafeAreaInsets();
  const [dockWidth, setDockWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const pillReady = useRef(false);

  const visibleRoutes: { route: { key: string; name: string }; stateIdx: number }[] = useMemo(() => {
    const list: { route: { key: string; name: string }; stateIdx: number }[] = [];
    state.routes.forEach((route: { key: string; name: string }, stateIdx: number) => {
      if (visible.includes(route.name)) {
        list.push({ route, stateIdx });
      }
    });
    return list;
  }, [state.routes, visible]);

  const activeRoute = state.routes[state.index];
  const activeVisibleIdx = Math.max(
    0,
    visibleRoutes.findIndex((item) => item.route.name === activeRoute?.name)
  );

  // Keep swipe bridge synced with the latest navigator state without causing parent re-renders
  navBridgeRef.current = {
    activeName: activeRoute?.name ?? 'index',
    navigateByName: (targetName: string) => {
      const targetRoute = state.routes.find((r: { name: string }) => r.name === targetName);
      if (!targetRoute || targetRoute.name === activeRoute?.name) return;
      const event = emitter
        ? emitter.emit({ type: 'tabPress', target: targetRoute.key, canPreventDefault: true })
        : navigation?.emit({ type: 'tabPress', target: targetRoute.key, canPreventDefault: true });
      if (!event?.defaultPrevented) {
        if (navigateToTab) navigateToTab(targetRoute.key);
        else navigation?.navigate(targetRoute.name);
      }
    },
  };

  const count = visibleRoutes.length || 1;
  const innerWidth = Math.max(0, dockWidth - DOCK_HORIZONTAL_PAD * 2);
  const slotWidth = innerWidth / count;
  const targetX = DOCK_HORIZONTAL_PAD + slotWidth * activeVisibleIdx + (slotWidth - PILL_WIDTH) / 2;

  useEffect(() => {
    if (dockWidth <= 0) return;
    if (!pillReady.current || reduceMotion) {
      pillReady.current = true;
      pillX.setValue(targetX);
      return;
    }
    Animated.spring(pillX, {
      toValue: targetX,
      stiffness: 340,
      damping: 28,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [dockWidth, pillX, reduceMotion, targetX]);

  const handleDockLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setDockWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
  }, []);

  return (
    <View
      onLayout={handleDockLayout}
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {dockWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingPill,
            { transform: [{ translateX: pillX }] },
          ]}
        />
      ) : null}

      {visibleRoutes.map(({ route, stateIdx }) => {
        const focused = state.index === stateIdx;
        const cfg = TAB_CONFIG[route.name];

        const onPress = () => {
          const event = emitter
            ? emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            : navigation?.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event?.defaultPrevented) {
            if (navigateToTab) navigateToTab(route.key);
            else navigation?.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [styles.tabBtn, pressed && { opacity: 0.72 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
          >
            <View style={styles.iconPill}>
              <Ionicons
                name={focused ? cfg.activeIcon : cfg.icon}
                size={20}
                color={focused ? COLORS.primary : COLORS.muted}
              />
            </View>
            <Text allowFontScaling={false} style={[styles.label, focused && styles.labelActive]}>
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export default function TabsLayout() {
  const { width: screenWidth } = useWindowDimensions();
  const { profile, session } = useAuth();
  const role = profile?.role || session?.user?.user_metadata?.role;
  const visible = useMemo(() => visibleTabsFor(role), [role]);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const [reduceMotion, setReduceMotion] = useState(false);

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
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const navBridgeRef = useRef<TabNavBridge>({
    activeName: 'index',
    navigateByName: () => {},
  });

  // Intentional horizontal swipe switches between adjacent visible tabs (paused on Map so map panning stays smooth)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        const currentName = navBridgeRef.current.activeName;
        if (currentName === 'map') return false;
        const absDx = Math.abs(gesture.dx);
        const absDy = Math.abs(gesture.dy);
        if (absDx < 28 || absDx < absDy * 1.8) return false;

        const tabs = visibleRef.current;
        const idx = tabs.indexOf(currentName);
        if (idx === -1) return false;
        if (gesture.dx > 0 && idx <= 0) return false;
        if (gesture.dx < 0 && idx >= tabs.length - 1) return false;
        return true;
      },
      onPanResponderRelease: (_evt, gesture) => {
        const currentName = navBridgeRef.current.activeName;
        if (currentName === 'map') return;
        const tabs = visibleRef.current;
        const idx = tabs.indexOf(currentName);
        if (idx === -1) return;

        const swipedLeft = gesture.dx <= -56 || gesture.vx <= -0.45;
        const swipedRight = gesture.dx >= 56 || gesture.vx >= 0.45;

        if (swipedLeft && idx < tabs.length - 1) {
          navBridgeRef.current.navigateByName(tabs[idx + 1]);
        } else if (swipedRight && idx > 0) {
          navBridgeRef.current.navigateByName(tabs[idx - 1]);
        }
      },
    })
  ).current;

  const sceneStyleInterpolator = useCallback(
    ({ current }: { current: { progress: Animated.Value } }) => ({
      sceneStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-screenWidth, 0, screenWidth],
            }),
          },
        ],
      },
    }),
    [screenWidth]
  );

  const screenOptions = useMemo(
    () =>
      reduceMotion
        ? { headerShown: false, animation: 'none' as const }
        : {
            headerShown: false,
            transitionSpec: TAB_TRANSITION_SPEC,
            sceneStyleInterpolator,
          },
    [reduceMotion, sceneStyleInterpolator]
  );

  const renderTabBar = useCallback(
    (props: any) => (
      <ModernTabBar
        {...props}
        visible={visible}
        reduceMotion={reduceMotion}
        navBridgeRef={navBridgeRef}
      />
    ),
    [reduceMotion, visible]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Tabs tabBar={renderTabBar} screenOptions={screenOptions}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="store" />
        <Tabs.Screen name="admin" />
        <Tabs.Screen name="account" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  dock: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
    paddingTop: 7,
    paddingHorizontal: DOCK_HORIZONTAL_PAD,
    elevation: 8,
  },
  slidingPill: {
    position: 'absolute',
    top: 7,
    left: 0,
    width: PILL_WIDTH,
    height: 28,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconPill: {
    width: PILL_WIDTH,
    height: 28,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: FONTS.semibold,
    color: COLORS.muted,
  },
  labelActive: { fontFamily: FONTS.bold, color: COLORS.primary },
});
