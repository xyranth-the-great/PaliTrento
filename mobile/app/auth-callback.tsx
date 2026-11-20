import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS } from '../lib/theme';

/**
 * Handles `palitrento://auth-callback` deep links from Google OAuth so Expo Router
 * never shows "Unmatched Route" while Supabase completes PKCE code exchange.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session, handleOAuthCallbackUrl } = useAuth();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    let active = true;

    const process = async () => {
      const targetUrl = incomingUrl || (await Linking.getInitialURL().catch(() => null));
      if (!active) return;

      if (targetUrl) {
        const res = await handleOAuthCallbackUrl(targetUrl);
        if (!active) return;
        if (res.restricted) {
          router.replace('/auth-status');
          return;
        }
        if (res.error) {
          router.replace('/(auth)/login');
          return;
        }
      }
    };

    void process();

    const fallbackTimer = setTimeout(() => {
      if (active && !session) {
        router.replace('/(auth)/login');
      }
    }, 3500);

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, [handleOAuthCallbackUrl, incomingUrl, router, session]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.label}>Completing Google sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
    color: COLORS.ink,
    textAlign: 'center',
  },
});
