import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PaliTrentoLogoSplash } from '../components/PaliTrentoLogoSplash';
import { NotificationToast } from '../components/NotificationToast';
import { COLORS } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

let logoSplashPlayed = false;

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, loading, onboarded, restriction, needsRoleChoice } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(logoSplashPlayed);

  useEffect(() => {
    if (logoSplashPlayed && fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  useEffect(() => {
    if (loading || !fontsReady) return;
    const first = segments[0] as string | undefined;
    const second = segments[1] as string | undefined;
    const inOnboarding = first === 'onboarding' || first === 'permissions';
    const inAuth = first === '(auth)';
    const onTerms = first === 'terms';
    const onStatus = first === 'auth-status';
    const onRoleChoice = first === 'choose-role';
    const onAuthCallback = first === 'auth-callback';

    if (onTerms) return; // readable from anywhere

    if (!onboarded) {
      if (!inOnboarding && !onAuthCallback) router.replace('/onboarding');
      return;
    }

    if (!session) {
      if (!inAuth && !onStatus && !onAuthCallback) router.replace('/(auth)/login');
      return;
    }

    // Suspended / banned accounts can only see the status screen
    if (restriction) {
      if (!onStatus) router.replace('/auth-status');
      return;
    }
    if (onStatus) {
      router.replace('/(tabs)');
      return;
    }

    // New Google accounts must choose Customer or Business owner first
    if (needsRoleChoice) {
      if (!onRoleChoice) router.replace('/choose-role');
      return;
    }

    if (inOnboarding || (inAuth && second !== 'verify') || onRoleChoice || onAuthCallback) {
      router.replace('/(tabs)');
    }
  }, [fontsReady, loading, needsRoleChoice, onboarded, restriction, router, segments, session]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="store/[trn]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="chat/[orderId]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="seller/product-form" />
        <Stack.Screen name="seller/bulk-products" />
        <Stack.Screen name="seller/standee" />
        <Stack.Screen name="seller/store-setup" />
        <Stack.Screen name="admin/store/[id]" />
        <Stack.Screen name="admin/advisory" />
        <Stack.Screen name="admin/accounts" />
        <Stack.Screen name="admin/reports-management" />
        <Stack.Screen name="admin/support" />
        <Stack.Screen name="admin/marketplace" />
        <Stack.Screen name="admin/pickup-cases" />
        <Stack.Screen name="admin/activity" />
        <Stack.Screen name="admin/reports" />
        <Stack.Screen name="admin/verification-docs" />
        <Stack.Screen name="auth-status" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="auth-callback" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="choose-role" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="terms" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="report-business" />
        <Stack.Screen name="report-product" />
        <Stack.Screen name="support" />
      </Stack>
      <NotificationToast />
      {!logoSplashPlayed && !splashDone && (
        <PaliTrentoLogoSplash
          appReady={fontsReady && !loading}
          onFinish={() => {
            logoSplashPlayed = true;
            setSplashDone(true);
          }}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <RootNavigator fontsReady={fontsReady} />
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
