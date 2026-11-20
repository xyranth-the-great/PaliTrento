import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Switch, Text, View } from 'react-native';
import {
  buildChatHistoryExport,
  buildPersonalDataExport,
  DEFAULT_PRIVACY_PREFS,
  loadPrivacyPrefs,
  PrivacyPreferences,
  savePrivacyPrefs,
} from '../../lib/settings';
import { Button, Card, SectionLabel } from '../ui';
import { COLORS, FONTS } from '../../lib/theme';

interface Props {
  userId?: string;
  email?: string | null;
}

export function PrivacyTab({ userId, email }: Props) {
  const [prefs, setPrefs] = useState<PrivacyPreferences>({ ...DEFAULT_PRIVACY_PREFS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [exportingChat, setExportingChat] = useState(false);

  useEffect(() => {
    let active = true;
    loadPrivacyPrefs()
      .then((loaded) => {
        if (active) setPrefs(loaded);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePrivacyPrefs(prefs);
      Alert.alert('Saved', 'Your privacy preferences have been saved on this device.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!userId) return;
    setExportingData(true);
    try {
      const res = await buildPersonalDataExport(userId, email);
      await Share.share({
        title: 'PaliTrento Personal Data Export',
        message: res.text,
      });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export your data right now.');
    } finally {
      setExportingData(false);
    }
  };

  const handleExportChat = async () => {
    if (!userId) return;
    setExportingChat(true);
    try {
      const res = await buildChatHistoryExport(userId, email);
      if (res.messagesCount === 0) {
        Alert.alert('No chat history', 'You do not have any order chat messages to export yet.');
        return;
      }
      await Share.share({
        title: 'PaliTrento Chat History',
        message: res.text,
      });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export chat history right now.');
    } finally {
      setExportingChat(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />;
  }

  return (
    <View>
      <SectionLabel>Visibility & Data Sharing</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        <ToggleRow
          title="Show my name in chat"
          description="Display your full name to buyers and sellers in chat. If off, shows only your first name."
          value={prefs.show_name}
          onValueChange={(v) => setPrefs((p) => ({ ...p, show_name: v }))}
        />
        <ToggleRow
          title="Show my barangay"
          description="Let other users see your barangay on your profile and in chat."
          value={prefs.show_barangay}
          onValueChange={(v) => setPrefs((p) => ({ ...p, show_barangay: v }))}
        />
        <ToggleRow
          title="Allow stores to contact me"
          description="Enable stores to message you about order updates and promotions."
          value={prefs.store_contact}
          onValueChange={(v) => setPrefs((p) => ({ ...p, store_contact: v }))}
        />
        <ToggleRow
          title="Analytics tracking"
          description="Help improve PaliTrento by allowing anonymous usage analytics."
          value={prefs.analytics}
          onValueChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
        />
        <ToggleRow
          title="Data sharing with Admin"
          description="Share anonymized order data with the Municipality of Trento for price monitoring."
          value={prefs.lgu_data}
          onValueChange={(v) => setPrefs((p) => ({ ...p, lgu_data: v }))}
          last
        />
      </Card>

      <Button
        title="Save privacy settings"
        icon="checkmark"
        loading={saving}
        onPress={handleSave}
        style={{ marginTop: 14 }}
      />

      <SectionLabel>Your Data</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Text style={styles.dataHint}>
          Access or share a copy of your profile details, order summary, and chat transcripts anytime.
        </Text>
        <View style={styles.btnRow}>
          <Button
            title="Export my data"
            icon="download-outline"
            variant="soft"
            small
            loading={exportingData}
            disabled={exportingChat}
            onPress={handleExportData}
            style={{ flex: 1 }}
          />
          <Button
            title="Chat history"
            icon="chatbubbles-outline"
            variant="outline"
            small
            loading={exportingChat}
            disabled={exportingData}
            onPress={handleExportChat}
            style={{ flex: 1 }}
          />
        </View>
      </Card>
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onValueChange,
  last,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.line, true: '#94C5A3' }}
        thumbColor={value ? COLORS.primary : '#FFFFFF'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
  },
  rowTitle: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.ink },
  rowDesc: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2, lineHeight: 16.5 },
  dataHint: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 17.5 },
  btnRow: { flexDirection: 'row', gap: 8 },
});
