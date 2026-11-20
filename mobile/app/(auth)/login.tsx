import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LogoMark } from '../../components/LogoMark';
import { GoogleLogo } from '../../components/GoogleLogo';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signInWithGoogle, oauthError, clearOAuthError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const visibleError = errorMsg || oauthError;

  const handleLogin = async () => {
    setErrorMsg(null);
    clearOAuthError();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    setBusy(true);
    const { error, restricted } = await signInWithEmail(email, password);
    setBusy(false);
    if (restricted) {
      router.push({ pathname: '/auth-status', params: { email: email.trim().toLowerCase() } });
    } else if (error) {
      setErrorMsg(error.toLowerCase().includes('invalid login') ? 'Incorrect email or password.' : error);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    clearOAuthError();
    setGoogleBusy(true);
    const { error, restricted, signedIn, needsRoleChoice } = await signInWithGoogle();
    setGoogleBusy(false);
    if (restricted) {
      router.push('/auth-status');
    } else if (error) {
      setErrorMsg(error);
    } else if (signedIn) {
      router.replace(needsRoleChoice ? '/choose-role' : '/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#122D1C', '#1B4329', '#235737']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.brandBanner, { paddingTop: insets.top + 22 }]}
        >
          <View style={styles.bannerGlow} />
          <View style={styles.logoCard}>
            <LogoMark size={40} />
          </View>
          <Text style={styles.wordmark}>
            Pali<Text style={{ color: '#FBC14E' }}>Trento</Text>
          </Text>
          <Text style={styles.tagline}>Tara, Palit Ta sa Trento!</Text>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Log in to explore Trento stores & live prices.</Text>

          {visibleError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.bad} />
              <Text style={styles.errorText}>{visibleError}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 14 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!showPassword}
                textContentType="password"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={COLORS.muted}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotLink}
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={handleLogin}
            disabled={busy}
            style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.btnPressed]}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Log in</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={handleGoogle}
            disabled={googleBusy}
            style={({ pressed }) => [styles.googleBtn, pressed && styles.btnPressed]}
          >
            {googleBusy ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <>
                <GoogleLogo size={20} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footCard}>
            <Pressable
              onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'customer' } })}
              style={styles.footRow}
            >
              <Text style={styles.footMuted}>Don't have an account? </Text>
              <Text style={styles.linkText}>Register</Text>
            </Pressable>
            <View style={styles.footSep} />
            <Pressable
              onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'business_owner' } })}
              style={styles.footRow}
            >
              <Text style={styles.footMuted}>Business owner? </Text>
              <Text style={styles.linkText}>Create business account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  brandBanner: {
    paddingBottom: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerGlow: {
    position: 'absolute',
    right: -45,
    top: -45,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(240,160,48,0.2)',
  },
  logoCard: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...SHADOW.floating,
  },
  wordmark: {
    fontSize: 23,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
  },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  heading: {
    fontSize: 22,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    marginTop: 3,
    marginBottom: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.badBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.bad },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
  },
  passwordWrap: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  eyeBtn: { paddingHorizontal: 13, height: '100%', justifyContent: 'center' },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 4, marginBottom: 14 },
  linkText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary },
  primaryBtn: {
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.floating,
  },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  primaryBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.white },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.line },
  dividerText: { fontSize: 12, color: COLORS.muted, fontFamily: FONTS.semibold },
  googleBtn: {
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...SHADOW.card,
  },
  googleBtnText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.ink },
  footCard: {
    marginTop: 18,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
  },
  footRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 13,
    justifyContent: 'center',
  },
  footSep: { height: 1, backgroundColor: COLORS.lineSubtle },
  footMuted: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.muted },
});
