import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_NOTIFICATION_PREFS, NotificationPreferences } from '../../lib/notifications';
import { loadNotificationPrefs, saveNotificationPrefs } from '../../lib/settings';
import {
  getPushPermissionStatus,
  PushPermissionState,
  registerDevicePushToken,
  requestPushPermission,
  sendTestPushNotification,
  unregisterDevicePushToken,
} from '../../lib/push';
import { useNotifications } from '../../context/NotificationContext';
import { Button, Card, SectionLabel, StatusPill, Tone } from '../ui';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

interface Props {
  userId?: string;
}

export function NotificationsTab({ userId }: Props) {
  const { refreshUnreadCount, pushState, refreshPushRegistration } = useNotifications();
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [osPermission, setOsPermission] = useState<PushPermissionState>('undetermined');

  const checkOsPermission = useCallback(async () => {
    setOsPermission(await getPushPermissionStatus());
  }, []);

  useEffect(() => {
    let active = true;
    checkOsPermission();
    if (!userId) {
      setLoading(false);
      return;
    }
    loadNotificationPrefs(userId)
      .then((loaded) => {
        if (active) setPrefs(loaded);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [checkOsPermission, userId]);

  const togglePush = async (nextVal: boolean) => {
    if (nextVal && Platform.OS !== 'web') {
      const nextPerm = await requestPushPermission();
      setOsPermission(nextPerm);
      if (nextPerm !== 'granted') {
        Alert.alert(
          'Notification permission needed',
          'Enable notifications for PaliTrento in your device settings to receive alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }
    setPrefs((prev) => ({ ...prev, push: nextVal }));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await saveNotificationPrefs(userId, prefs);
      if (Platform.OS !== 'web') {
        if (prefs.push) {
          await registerDevicePushToken(userId);
        } else {
          await unregisterDevicePushToken(userId);
        }
      }
      await Promise.all([refreshUnreadCount(), refreshPushRegistration(), checkOsPermission()]);
      Alert.alert('Saved', 'Your notification preferences have been updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await sendTestPushNotification();
      await checkOsPermission();
      if (!res.ok) {
        Alert.alert('Could not send test alert', res.error || 'Check device notification permission.');
      }
    } finally {
      setTestingPush(false);
    }
  };

  const fcmPill: { label: string; tone: Tone } =
    pushState.status === 'registered'
      ? { label: 'Background FCM active', tone: 'ok' }
      : pushState.status === 'token_local_only'
        ? { label: 'FCM token ready (run SQL)', tone: 'warn' }
        : pushState.status === 'firebase_not_configured'
          ? { label: 'Local alerts ready • FCM pending Firebase', tone: 'info' }
          : pushState.status === 'web'
            ? { label: 'Web preview', tone: 'muted' }
            : { label: prefs.push ? 'Push enabled' : 'Push off', tone: prefs.push ? 'info' : 'muted' };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />;
  }

  return (
    <View>
      <SectionLabel>Activity Alerts</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        <ToggleRow
          title="Order status updates"
          description="Get notified when your order is confirmed, ready for pickup, or completed."
          value={prefs.orders}
          onValueChange={(v) => setPrefs((p) => ({ ...p, orders: v }))}
        />
        <ToggleRow
          title="New messages"
          description="Get notified when a buyer or seller sends you a chat message."
          value={prefs.messages}
          onValueChange={(v) => setPrefs((p) => ({ ...p, messages: v }))}
        />
        <ToggleRow
          title="Price cap changes"
          description="Receive alerts when Trento LGU posts new Bantay Presyo price ceilings."
          value={prefs.price_caps}
          onValueChange={(v) => setPrefs((p) => ({ ...p, price_caps: v }))}
        />
        <ToggleRow
          title="Store announcements"
          description="Get notified when local stores post updates or promotions."
          value={prefs.store_announcements}
          onValueChange={(v) => setPrefs((p) => ({ ...p, store_announcements: v }))}
          last
        />
      </Card>

      <SectionLabel>Device Push & Channels</SectionLabel>
      <Card style={{ gap: 10 }}>
        <ToggleRow
          title="Push notifications"
          description="Deliver native Android status-bar alerts with sound, vibration, and tap-to-open routing."
          value={prefs.push}
          onValueChange={togglePush}
          last
        />

        <View style={styles.statusBlock}>
          <View style={styles.pillRow}>
            <StatusPill
              label={
                osPermission === 'granted'
                  ? 'OS permission allowed'
                  : osPermission === 'denied'
                    ? 'Blocked in OS settings'
                    : osPermission === 'web'
                      ? 'Web preview mode'
                      : 'Permission not requested'
              }
              tone={
                osPermission === 'granted'
                  ? 'ok'
                  : osPermission === 'denied'
                    ? 'bad'
                    : 'info'
              }
            />
            <StatusPill label={fcmPill.label} tone={fcmPill.tone} />
          </View>

          {pushState.token ? (
            <Text style={styles.tokenText} numberOfLines={1}>
              Device token: {pushState.token.slice(0, 24)}…
            </Text>
          ) : pushState.status === 'firebase_not_configured' ? (
            <Text style={styles.tokenHint}>
              Realtime & local Android alerts work now. Add Firebase google-services.json to enable background FCM while the app is closed.
            </Text>
          ) : null}

          <View style={styles.actionRow}>
            {Platform.OS !== 'web' ? (
              <Button
                title="Send test notification"
                icon="notifications-outline"
                variant="soft"
                small
                loading={testingPush}
                onPress={handleTestPush}
                style={{ flex: 1 }}
              />
            ) : null}
            {osPermission === 'denied' && Platform.OS !== 'web' ? (
              <Button
                title="OS Settings"
                icon="settings-outline"
                variant="outline"
                small
                onPress={() => Linking.openSettings()}
              />
            ) : null}
          </View>
        </View>
      </Card>

      <View style={styles.noteBox}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
        <Text style={styles.noteText}>
          Ready-for-pickup reminders and 72-hour expiry alerts are transactional and always delivered so you never miss a pickup.
        </Text>
      </View>

      <Button
        title="Save notification preferences"
        icon="checkmark"
        loading={saving}
        onPress={handleSave}
        style={{ marginTop: 14 }}
      />
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
  rowDesc: {
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    marginTop: 2,
    lineHeight: 16.5,
  },
  statusBlock: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.lineSubtle,
    gap: 8,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tokenText: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.primary },
  tokenHint: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 16.5 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 12,
  },
  noteText: { flex: 1, fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.primary, lineHeight: 17 },
});
