import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS } from '../../lib/theme';

function firstParam(val: string | string[] | undefined): string | null {
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

/**
 * Handles `palitrento://auth/callback` deep links from Google OAuth so Expo Router
 * never shows "Unmatched Route" while Supabase completes PKCE code exchange.
 */
export default function AuthCallbackRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    access_token?: string | string[];
    refresh_token?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const { session, needsRoleChoice, handleOAuthCallbackUrl, handleOAuthParams } = useAuth();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    if (session) {
      router.replace(needsRoleChoice ? '/choose-role' : '/(tabs)');
      return;
    }

    let active = true;

    const process = async () => {
      const code = firstParam(params.code);
      const accessToken = firstParam(params.access_token);
      const refreshToken = firstParam(params.refresh_token);
      const errorDescription =
        firstParam(params.error_description) || firstParam(params.error);

      let res: {
        error: string | null;
        restricted?: boolean;
        signedIn?: boolean;
        needsRoleChoice?: boolean;
      } | null = null;

      if (code || (accessToken && refreshToken) || errorDescription) {
        res = await handleOAuthParams({
          code,
          accessToken,
          refreshToken,
          errorDescription,
        });
      } else {
        const targetUrl =
          incomingUrl || (await Linking.getInitialURL().catch(() => null));
        if (!active) return;
        if (targetUrl) {
          res = await handleOAuthCallbackUrl(targetUrl);
        }
      }

      if (!active || !res) return;
      if (res.restricted) {
        router.replace('/auth-status');
        return;
      }
      if (res.error) {
        router.replace('/(auth)/login');
        return;
      }
      if (res.signedIn) {
        router.replace(res.needsRoleChoice ? '/choose-role' : '/(tabs)');
      }
    };

    void process();

    const fallbackTimer = setTimeout(() => {
      if (active && !session) {
        router.replace('/(auth)/login');
      }
    }, 8000);

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, [
    handleOAuthCallbackUrl,
    handleOAuthParams,
    incomingUrl,
    needsRoleChoice,
    params.access_token,
    params.code,
    params.error,
    params.error_description,
    params.refresh_token,
    router,
    session,
  ]);

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
