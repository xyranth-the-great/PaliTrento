import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BARANGAYS } from '../../lib/constants';
import { PASSWORD_RULES, passwordStrength, sendEmailCode } from '../../lib/account';
import { setPendingRegistration } from '../../lib/pendingRegistration';
import { Button, Card, ChipGroup, Field, ScreenHeader, SectionLabel } from '../../components/ui';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

type Role = 'customer' | 'business_owner';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();

  const [role, setRole] = useState<Role>(params.role === 'business_owner' ? 'business_owner' : 'customer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [barangay, setBarangay] = useState<string>('Poblacion');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const strength = passwordStrength(password);
  const meterColor = strength.passed <= 2 ? COLORS.bad : strength.passed <= 4 ? COLORS.warn : COLORS.ok;

  const handleRegister = async () => {
    setErrorMsg(null);
    if (!fullName.trim() || !email.trim() || !password) return setErrorMsg('Please fill out all required fields.');
    if (!strength.valid) return setErrorMsg('Your password does not meet all the requirements.');
    if (password !== confirm) return setErrorMsg('Passwords do not match.');
    if (!acceptTerms) return setErrorMsg('Please agree to the Terms and Agreement.');

    const cleanEmail = email.trim().toLowerCase();
    setBusy(true);
    // Same as the website: send a 6-digit code first; the account is created after it is verified.
    setPendingRegistration({ email: cleanEmail, password, fullName, barangay, role });
    const { error } = await sendEmailCode(cleanEmail);
    setBusy(false);
    if (error) return setErrorMsg(error);
    router.push({ pathname: '/(auth)/verify', params: { email: cleanEmail } });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader title="Create account" subtitle="Join PaliTrento in a minute" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.bad} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <SectionLabel>Account type</SectionLabel>
          <View style={styles.roleRow}>
            {(['customer', 'business_owner'] as Role[]).map((r) => {
              const active = role === r;
              return (
                <Pressable key={r} onPress={() => setRole(r)} style={[styles.roleCard, active && styles.roleCardActive]}>
                  <Ionicons name={r === 'customer' ? 'person-outline' : 'storefront-outline'} size={20} color={active ? COLORS.primary : COLORS.muted} />
                  <Text style={[styles.roleText, active && styles.roleTextActive]}>{r === 'customer' ? 'Customer' : 'Business owner'}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>Your details</SectionLabel>
          <Card>
            <Field label="Full name" required value={fullName} onChangeText={setFullName} placeholder="Juan Dela Cruz" />
            <Field label="Email" required value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.label}>Barangay in Trento</Text>
            <ChipGroup value={barangay} onChange={setBarangay} options={BARANGAYS.map((b) => ({ value: b, label: b }))} />
          </Card>

          <SectionLabel>Security</SectionLabel>
          <Card>
            <Field label="Password" required value={password} onChangeText={setPassword} secureTextEntry placeholder="Create a strong password" />
            {password ? (
              <View style={styles.meterWrap}>
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${(strength.passed / strength.total) * 100}%`, backgroundColor: meterColor }]} />
                </View>
                <Text style={[styles.meterLabel, { color: meterColor }]}>{strength.label}</Text>
              </View>
            ) : null}
            <View style={styles.rules}>
              {PASSWORD_RULES.map((r) => {
                const ok = r.test(password);
                return (
                  <View key={r.key} style={styles.rule}>
                    <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={ok ? COLORS.ok : COLORS.muted} />
                    <Text style={[styles.ruleText, ok && { color: COLORS.ok }]}>{r.label}</Text>
                  </View>
                );
              })}
            </View>
            <Field label="Confirm password" required value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Re-enter password" />
          </Card>

          <Pressable onPress={() => setAcceptTerms((v) => !v)} style={styles.termsRow}>
            <Ionicons name={acceptTerms ? 'checkbox' : 'square-outline'} size={22} color={acceptTerms ? COLORS.primary : COLORS.muted} />
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.link} onPress={() => router.push('/terms')}>
                Terms and Agreement
              </Text>
            </Text>
          </Pressable>

          <Button title="Send verification code" icon="mail-outline" loading={busy} onPress={handleRegister} style={{ marginTop: 6 }} />
          <Text style={styles.footNote}>We'll email you a 6-digit code to confirm your address.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.badBg, borderRadius: RADIUS.sm, padding: 11 },
  errorText: { flex: 1, fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.bad },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleCard: { flex: 1, height: 56, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  roleCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  roleText: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.muted },
  roleTextActive: { color: COLORS.primary },
  label: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 8 },
  meterWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, marginBottom: 8 },
  meterTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.mutedBg, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  meterLabel: { fontSize: 11.5, fontFamily: FONTS.bold, width: 48, textAlign: 'right' },
  rules: { gap: 5, marginBottom: 12 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 12, paddingHorizontal: 2 },
  termsText: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.ink },
  link: { fontFamily: FONTS.bold, color: COLORS.primary },
  footNote: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, textAlign: 'center', marginTop: 10 },
});
