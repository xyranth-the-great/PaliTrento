import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { initNativeNotifications, requestPushPermission } from '../lib/push';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

type PermState = 'idle' | 'granted' | 'denied';

export default function PermissionsScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [locStatus, setLocStatus] = useState<PermState>('idle');
  const [notifStatus, setNotifStatus] = useState<PermState>('idle');

  const askLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocStatus(status === 'granted' ? 'granted' : 'denied');
    } catch {
      setLocStatus('denied');
    }
  };

  const askNotifications = async () => {
    try {
      await initNativeNotifications();
      const status = await requestPushPermission();
      setNotifStatus(status === 'granted' ? 'granted' : 'denied');
    } catch {
      setNotifStatus('denied');
    }
  };

  const handleContinue = async () => {
    await completeOnboarding();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primaryDark} />
        </Pressable>
      </View>

      <View style={styles.head}>
        <Text style={styles.title}>Allow access</Text>
        <Text style={styles.subtitle}>
          PaliTrento works best with these permissions. You can change them anytime in your phone settings.
        </Text>
      </View>

      <View style={styles.list}>
        <View style={[styles.card, locStatus === 'granted' && styles.cardGranted]}>
          <View style={[styles.iconWrap, { backgroundColor: COLORS.primary }]}>
            <Ionicons name="location-outline" size={22} color={COLORS.white} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Location</Text>
            <Text style={styles.cardDesc}>Find stores near you and show your pin on the map.</Text>
          </View>
          <Pressable
            onPress={askLocation}
            disabled={locStatus === 'granted'}
            style={[styles.pillBtn, locStatus === 'granted' && styles.pillBtnGranted]}
          >
            <Text style={[styles.pillBtnText, locStatus === 'granted' && styles.pillBtnTextGranted]}>
              {locStatus === 'granted' ? 'Allowed' : locStatus === 'denied' ? 'Retry' : 'Allow'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, notifStatus === 'granted' && styles.cardGranted]}>
          <View style={[styles.iconWrap, { backgroundColor: COLORS.amber }]}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Notifications</Text>
            <Text style={styles.cardDesc}>Get order updates, seller replies, and price advisories.</Text>
          </View>
          <Pressable
            onPress={askNotifications}
            disabled={notifStatus === 'granted'}
            style={[styles.pillBtn, notifStatus === 'granted' && styles.pillBtnGranted]}
          >
            <Text style={[styles.pillBtnText, notifStatus === 'granted' && styles.pillBtnTextGranted]}>
              {notifStatus === 'granted' ? 'Allowed' : notifStatus === 'denied' ? 'Retry' : 'Allow'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.primaryBtnText}>Continue to Log in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  top: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
  },
  title: {
    fontSize: 25,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    lineHeight: 20,
    color: COLORS.muted,
  },
  list: {
    flex: 1,
    paddingHorizontal: 18,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW.card,
  },
  cardGranted: {
    borderColor: COLORS.primary,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.mutedBg,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  pillBtnGranted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  pillBtnTextGranted: {
    color: COLORS.white,
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  primaryBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.floating,
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
});
