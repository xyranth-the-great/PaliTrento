import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { sendEmailCode, verifyEmailCode } from '../../lib/account';
import { clearPendingRegistration, getPendingRegistration } from '../../lib/pendingRegistration';
import { Button, ScreenHeader } from '../../components/ui';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { signUpWithEmail, signInWithEmail } = useAuth();
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!getPendingRegistration()) {
      Alert.alert('Registration expired', 'Please fill in the registration form again.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/register') },
      ]);
    }
  }, [router]);

  const submit = async (value = code) => {
    if (value.length !== LENGTH || busy) return;
    const pending = getPendingRegistration();
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyEmailCode(String(email), value);
      if (!ok) {
        setError('Invalid or expired code. Please try again.');
        setCode('');
        return;
      }
      const res = await signUpWithEmail(pending);
      if (res.error) {
        setError(res.error);
        return;
      }
      // Verified by our own code, so sign them straight in
      const login = await signInWithEmail(pending.email, pending.password);
      clearPendingRegistration();
      if (login.error) {
        Alert.alert('Account created', 'Your email is verified. Please log in.', [
          { text: 'Log in', onPress: () => router.replace('/(auth)/login') },
        ]);
        return;
      }
      router.replace(pending.role === 'business_owner' ? '/seller/store-setup' : '/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    const { error: err } = await sendEmailCode(String(email));
    if (err) setError(err);
    else {
      setError(null);
      setCooldown(RESEND_SECONDS);
      Alert.alert('Code sent', `A new code was sent to ${email}.`);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader title="Verify your email" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <View style={styles.icon}>
            <Ionicons name="mail-open-outline" size={30} color={COLORS.amber} />
          </View>
          <Text style={styles.title}>Enter the 6-digit code</Text>
          <Text style={styles.sub}>
            We sent it to <Text style={styles.email}>{email}</Text>
          </Text>

          {/* One hidden input drives the 6 visible boxes */}
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes}>
            {Array.from({ length: LENGTH }).map((_, i) => {
              const filled = i < code.length;
              const active = i === code.length;
              return (
                <View key={i} style={[styles.box, filled && styles.boxFilled, active && styles.boxActive]}>
                  <Text style={styles.digit}>{code[i] ?? ''}</Text>
                </View>
              );
            })}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, LENGTH);
              setCode(digits);
              if (digits.length === LENGTH) submit(digits);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={LENGTH}
            style={styles.hidden}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Verify & create account" icon="checkmark" loading={busy} disabled={code.length !== LENGTH} onPress={() => submit()} style={{ marginTop: 18, alignSelf: 'stretch' }} />

          <Pressable onPress={resend} disabled={cooldown > 0} style={{ marginTop: 16 }}>
            <Text style={[styles.resend, cooldown > 0 && { color: COLORS.muted }]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 22, alignItems: 'center' },
  icon: { width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.amberLight, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 16 },
  title: { fontSize: 21, fontFamily: FONTS.extrabold, color: COLORS.ink },
  sub: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 6, textAlign: 'center' },
  email: { fontFamily: FONTS.bold, color: COLORS.ink },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 24 },
  box: { width: 46, height: 56, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: COLORS.primary },
  boxActive: { borderColor: COLORS.amber, borderWidth: 2 },
  digit: { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.ink },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  error: { marginTop: 14, fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.bad, textAlign: 'center' },
  resend: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.primary },
});
