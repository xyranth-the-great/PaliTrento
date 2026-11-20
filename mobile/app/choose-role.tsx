import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';
import { LogoMark } from '../components/LogoMark';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

type Role = 'customer' | 'business_owner';

const OPTIONS: { role: Role; icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { role: 'customer', icon: 'bag-handle-outline', title: 'Customer', text: 'Find stores, check prices, and reserve items for pickup.' },
  { role: 'business_owner', icon: 'storefront-outline', title: 'Business owner', text: 'List your store and products, and manage reservations.' },
];

export default function ChooseRoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeGoogleRole, signOut, session } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  const firstName = (session?.user?.user_metadata?.full_name || '').split(' ')[0];

  const submit = async () => {
    if (!role) return;
    setBusy(true);
    const { error } = await completeGoogleRole(role);
    setBusy(false);
    if (error) {
      Alert.alert('Could not save', error);
      return;
    }
    router.replace(role === 'business_owner' ? '/seller/store-setup' : '/(tabs)');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <StatusBar style="dark" />
      <View>
        <View style={styles.logo}>
          <LogoMark size={34} />
        </View>
        <Text style={styles.title}>{firstName ? `Welcome, ${firstName}!` : 'Welcome to PaliTrento!'}</Text>
        <Text style={styles.sub}>How will you use PaliTrento? You can't change this later.</Text>

        <View style={{ gap: 12, marginTop: 22 }}>
          {OPTIONS.map((o) => {
            const active = role === o.role;
            return (
              <Pressable key={o.role} onPress={() => setRole(o.role)} style={[styles.option, active && styles.optionActive]}>
                <View style={[styles.optionIcon, active && { backgroundColor: COLORS.primary }]}>
                  <Ionicons name={o.icon} size={22} color={active ? COLORS.white : COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{o.title}</Text>
                  <Text style={styles.optionText}>{o.text}</Text>
                </View>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? COLORS.primary : COLORS.line} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Button title="Continue" icon="arrow-forward" disabled={!role} loading={busy} onPress={submit} />
        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
          style={{ alignSelf: 'center', padding: 8 }}
        >
          <Text style={styles.cancel}>Use a different account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 18, justifyContent: 'space-between' },
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontFamily: FONTS.extrabold, color: COLORS.ink, letterSpacing: -0.5 },
  sub: { fontSize: 13.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 6, lineHeight: 19 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: COLORS.card, ...SHADOW.card },
  optionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  optionIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.ink },
  optionText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2, lineHeight: 17 },
  cancel: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.muted },
});
