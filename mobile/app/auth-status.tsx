import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';
import { FadeInView } from '../components/FadeInView';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
}

function timeLeft(iso?: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.ceil(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours ? `, ${hours} hr` : ''} left`;
  if (hours > 0) return `${hours} hr ${mins % 60} min left`;
  return `${mins} min left`;
}

export default function AuthStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const { session, profile, restriction, restrictedEmail, clearRestriction, signOut, refreshProfile } = useAuth();
  const [, tick] = useState(0);

  // Live countdown for temporary suspensions
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const kind = restriction?.kind ?? 'restricted';
  const email = restrictedEmail || profile?.email || session?.user?.email || params.email || '';
  const until = restriction?.until;
  const remaining = timeLeft(until);

  const meta =
    kind === 'banned'
      ? { icon: 'ban-outline' as const, color: COLORS.bad, bg: COLORS.badBg, title: 'Account banned', text: 'You have been logged out. This account can no longer use PaliTrento.' }
      : kind === 'suspended'
        ? { icon: 'time-outline' as const, color: COLORS.warn, bg: COLORS.warnBg, title: 'Account suspended', text: until ? 'You have been logged out. Your access is paused until the date below.' : 'You have been logged out. Your access is paused until an admin restores it.' }
        : { icon: 'lock-closed-outline' as const, color: COLORS.warn, bg: COLORS.warnBg, title: 'Sign-in restricted', text: 'This account is currently restricted. Contact PaliTrento support for help.' };

  const leave = async () => {
    clearRestriction();
    if (session) await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <StatusBar style="dark" />
      <FadeInView offsetY={16} duration={260}>
      <View style={styles.card}>
        <View style={[styles.iconRing, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={40} color={meta.color} />
        </View>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.text}>{meta.text}</Text>

        <View style={styles.details}>
          {email ? <Row label="Account" value={email} /> : null}
          {kind === 'suspended' && until ? <Row label="Suspended until" value={formatDate(until) || '—'} /> : null}
          {remaining ? <Row label="Time remaining" value={remaining} highlight /> : null}
          {kind === 'banned' && restriction?.since ? <Row label="Banned on" value={formatDate(restriction.since) || '—'} /> : null}
          {restriction?.reason ? <Row label="Reason" value={restriction.reason} stacked /> : null}
        </View>

        <Text style={styles.help}>If you think this is a mistake, contact the PaliTrento team through the Help & Support page on palitrento.online.</Text>
      </View>
      </FadeInView>

      <View style={{ gap: 10 }}>
        {kind === 'suspended' && session ? (
          <Button title="Check again" icon="refresh" variant="soft" onPress={refreshProfile} />
        ) : null}
        <Button title={session ? 'Log out' : 'Back to log in'} icon="log-out-outline" onPress={leave} />
      </View>
    </View>
  );
}

function Row({ label, value, highlight, stacked }: { label: string; value: string; highlight?: boolean; stacked?: boolean }) {
  return (
    <View style={[styles.row, stacked && { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, stacked && { textAlign: 'left' }, highlight && { color: COLORS.warn, fontFamily: FONTS.extrabold }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 18, justifyContent: 'space-between' },
  card: { backgroundColor: COLORS.card, borderRadius: 28, borderWidth: 1, borderColor: COLORS.line, padding: 22, alignItems: 'center', ...SHADOW.floating },
  iconRing: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 21, fontFamily: FONTS.extrabold, color: COLORS.ink },
  text: { fontSize: 13.5, fontFamily: FONTS.medium, color: COLORS.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  details: { alignSelf: 'stretch', backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, paddingHorizontal: 14, marginTop: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.lineSubtle },
  rowLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.muted },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.ink },
  help: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
