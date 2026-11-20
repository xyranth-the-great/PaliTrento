import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

// Which bottom tabs each role sees (hidden routes are still reachable in-app).
function visibleTabsFor(role?: string | null): string[] {
  const middle = role === 'admin' ? 'admin' : role === 'business_owner' ? 'store' : 'orders';
  return ['index', 'explore', 'map', middle, 'account'];
}

function ModernTabBar({ state, navigation, emitter, navigateToTab }: any) {
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const role = profile?.role || session?.user?.user_metadata?.role;
  const visible = visibleTabsFor(role);

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route: { key: string; name: string }, idx: number) => {
        if (!visible.includes(route.name)) return null;
        const focused = state.index === idx;
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
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Ionicons name={focused ? cfg.activeIcon : cfg.icon} size={20} color={focused ? COLORS.primary : COLORS.muted} />
            </View>
            <Text allowFontScaling={false} style={[styles.label, focused && styles.labelActive]}>
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <ModernTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="store" />
      <Tabs.Screen name="admin" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
    paddingTop: 7,
    paddingHorizontal: 8,
    elevation: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconPill: { width: 48, height: 28, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: COLORS.primarySoft },
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
