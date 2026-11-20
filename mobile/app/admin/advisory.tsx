import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADVISORY_CATEGORIES, ADVISORY_PRIORITIES, BARANGAYS } from '../../lib/constants';
import { adminGetAdvisories, adminSendAdvisory } from '../../lib/seller';
import { Button, Card, ChipGroup, Field, ScreenHeader, SectionLabel, StatusPill } from '../../components/ui';
import { COLORS, FONTS } from '../../lib/theme';

const PRIORITY_TONE: Record<string, 'muted' | 'info' | 'warn' | 'bad'> = {
  low: 'muted',
  normal: 'info',
  high: 'warn',
  critical: 'bad',
};

export default function AdvisoryScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('PRICE_CAP');
  const [priority, setPriority] = useState('normal');
  const [barangay, setBarangay] = useState('');
  const [days, setDays] = useState('');
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  const loadRecent = useCallback(async () => {
    setRecent(await adminGetAdvisories(10));
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing details', 'Title and message are required.');
      return;
    }
    const d = parseInt(days, 10);
    setSending(true);
    try {
      await adminSendAdvisory({
        title: title.trim(),
        body: body.trim(),
        category,
        priority,
        barangay: barangay || null,
        expires_at: Number.isFinite(d) && d > 0 ? new Date(Date.now() + d * 86400000).toISOString() : null,
      });
      setTitle('');
      setBody('');
      setDays('');
      Alert.alert('Advisory sent', 'Residents will see it in their notifications.');
      loadRecent();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader title="Send advisory" subtitle="Bantay Presyo & public notices" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SectionLabel>Message</SectionLabel>
          <Card>
            <Field label="Title" required value={title} onChangeText={setTitle} placeholder="e.g. New price cap for rice" />
            <Field label="Message" required value={body} onChangeText={setBody} multiline placeholder="Details residents should know..." />
          </Card>

          <SectionLabel>Type & priority</SectionLabel>
          <Card style={{ gap: 12 }}>
            <ChipGroup value={category} onChange={setCategory} options={Object.entries(ADVISORY_CATEGORIES).map(([v, l]) => ({ value: v, label: l }))} />
            <ChipGroup value={priority} onChange={setPriority} options={Object.entries(ADVISORY_PRIORITIES).map(([v, l]) => ({ value: v, label: l }))} />
          </Card>

          <SectionLabel>Audience</SectionLabel>
          <Card>
            <ChipGroup
              value={barangay}
              onChange={setBarangay}
              options={[{ value: '', label: 'All barangays' }, ...BARANGAYS.map((b) => ({ value: b, label: b }))]}
            />
            <View style={{ height: 12 }} />
            <Field label="Expires after (days)" value={days} onChangeText={setDays} keyboardType="number-pad" hint="Optional. Leave empty to keep it active." />
          </Card>

          <Button title="Send advisory" icon="megaphone" loading={sending} onPress={send} style={{ marginTop: 16 }} />

          <SectionLabel>Recent advisories</SectionLabel>
          <View style={{ gap: 8 }}>
            {recent.length === 0 ? <Text style={styles.muted}>No advisories sent yet.</Text> : null}
            {recent.map((a) => (
              <Card key={a.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <StatusPill label={ADVISORY_CATEGORIES[a.category] || a.category} tone="info" />
                  <StatusPill label={ADVISORY_PRIORITIES[a.priority] || a.priority} tone={PRIORITY_TONE[a.priority] || 'muted'} />
                </View>
                <Text style={styles.title}>{a.title}</Text>
                <Text style={styles.body} numberOfLines={3}>{a.body}</Text>
                <Text style={styles.muted}>
                  {a.barangay || 'All barangays'} • {new Date(a.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              </Card>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  title: { fontSize: 14.5, fontFamily: FONTS.bold, color: COLORS.ink },
  body: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 18 },
  muted: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
});
