import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COLORS, RADIUS } from '../../lib/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const handleReset = async () => {
    setStatus(null);
    if (!email.trim()) {
      setStatus({ ok: false, text: 'Enter your email address first.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setBusy(false);
    if (error) {
      setStatus({ ok: false, text: error.message });
    } else {
      setStatus({ ok: true, text: 'Password reset link sent! Check your inbox.' });
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.topTitle}>Reset password</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconBadge}>
          <Ionicons name="key-outline" size={28} color={COLORS.amber} />
        </View>
        <Text style={styles.title}>Forgot your password?</Text>
        <Text style={styles.subtitle}>
          Enter the email linked to your PaliTrento account and we'll send you a reset link.
        </Text>

        {status && (
          <View style={[styles.msgBox, status.ok ? styles.msgOk : styles.msgBad]}>
            <Text style={[styles.msgText, status.ok ? styles.msgOkText : styles.msgBadText]}>
              {status.text}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          onPress={handleReset}
          disabled={busy}
          style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && { opacity: 0.88 }]}
        >
          {busy ? (
            <ActivityIndicator color={COLORS.primaryDark} />
          ) : (
            <Text style={styles.primaryBtnText}>Send reset link</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    height: 50,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  body: { padding: 20 },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.amberLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
    marginBottom: 18,
  },
  msgBox: {
    borderRadius: RADIUS.sm,
    padding: 11,
    marginBottom: 14,
  },
  msgOk: { backgroundColor: COLORS.okBg },
  msgBad: { backgroundColor: COLORS.badBg },
  msgText: { fontSize: 13, fontWeight: '600' },
  msgOkText: { color: COLORS.ok },
  msgBadText: { color: COLORS.bad },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.ink, marginBottom: 5 },
  input: {
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1.2,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 16,
  },
  primaryBtn: {
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.primaryDark },
});
