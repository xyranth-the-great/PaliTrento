import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { BARANGAYS } from '../lib/constants';
import { removeUserAvatar, uploadUserAvatar } from '../lib/seller';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, Field, ScreenHeader, SectionLabel } from '../components/ui';
import { NotificationsTab } from '../components/settings/NotificationsTab';
import { PrivacyTab } from '../components/settings/PrivacyTab';
import { SecurityTab } from '../components/settings/SecurityTab';
import { DangerZoneTab } from '../components/settings/DangerZoneTab';
import { COLORS, FONTS, RADIUS } from '../lib/theme';

type SettingsTab = 'profile' | 'notifications' | 'privacy' | 'security' | 'danger';

const TABS: {
  key: SettingsTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
}[] = [
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'privacy', label: 'Privacy', icon: 'lock-closed-outline' },
  { key: 'security', label: 'Security', icon: 'key-outline' },
  { key: 'danger', label: 'Danger Zone', icon: 'warning-outline', danger: true },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id;
  const email = profile?.email || session?.user?.email || '';
  const role = profile?.role || session?.user?.user_metadata?.role || 'customer';

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const [fullName, setFullName] = useState(
    profile?.full_name || session?.user?.user_metadata?.full_name || ''
  );
  const [barangay, setBarangay] = useState(profile?.barangay || BARANGAYS[7]);
  const [showBarangays, setShowBarangays] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    const t = params.tab;
    if (
      t === 'profile' ||
      t === 'notifications' ||
      t === 'privacy' ||
      t === 'security' ||
      t === 'danger'
    ) {
      setActiveTab(t);
    }
  }, [params.tab]);

  const initials = (fullName || 'PT')
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('');

  const handlePickAvatar = async (useCamera: boolean) => {
    if (!userId) return;
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to update your profile picture.');
      return;
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
        });
    if (res.canceled || !res.assets[0]) return;

    setAvatarBusy(true);
    try {
      await uploadUserAvatar(userId, res.assets[0].uri, profile?.avatar_url);
      await refreshProfile();
      Alert.alert('Photo updated', 'Your profile picture has been saved.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not update profile picture.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = () => {
    if (!userId || !profile?.avatar_url) return;
    Alert.alert('Remove profile photo?', 'Your avatar will revert to your initials.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAvatarBusy(true);
          try {
            await removeUserAvatar(userId, profile.avatar_url);
            await refreshProfile();
          } catch (e: any) {
            Alert.alert('Could not remove photo', e?.message || 'Please try again.');
          } finally {
            setAvatarBusy(false);
          }
        },
      },
    ]);
  };

  const saveProfile = async () => {
    if (!userId) return;
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), barangay })
      .eq('id', userId);
    setSaving(false);
    if (error) {
      Alert.alert('Update failed', error.message);
    } else {
      await refreshProfile();
      Alert.alert('Saved', 'Your profile has been updated.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScreenHeader
        title="Settings"
        subtitle="Account, alerts, privacy & security"
      />

      {/* Horizontal Settings Tab Strip */}
      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((t) => {
            const active = activeTab === t.key;
            const isDanger = Boolean(t.danger);
            return (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={[
                  styles.tabPill,
                  active && (isDanger ? styles.tabPillDangerActive : styles.tabPillActive),
                ]}
              >
                <Ionicons
                  name={t.icon}
                  size={14}
                  color={
                    active
                      ? COLORS.white
                      : isDanger
                        ? COLORS.bad
                        : COLORS.primary
                  }
                />
                <Text
                  style={[
                    styles.tabText,
                    isDanger && !active && { color: COLORS.bad },
                    active && styles.tabTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'profile' ? (
          <>
            <SectionLabel>Profile Photo</SectionLabel>
            <Card style={styles.avatarCard}>
              <View style={styles.avatarWrap}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitials}>{initials || 'PT'}</Text>
                  </View>
                )}
                {avatarBusy && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={COLORS.white} />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.avatarHint}>
                  Square photo (256×256 WebP). Visible when you chat or place orders.
                </Text>
                <View style={styles.avatarBtns}>
                  <Button
                    title="Gallery"
                    icon="images-outline"
                    variant="soft"
                    small
                    disabled={avatarBusy}
                    onPress={() => handlePickAvatar(false)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Camera"
                    icon="camera-outline"
                    variant="outline"
                    small
                    disabled={avatarBusy}
                    onPress={() => handlePickAvatar(true)}
                    style={{ flex: 1 }}
                  />
                </View>
                {profile?.avatar_url ? (
                  <Pressable onPress={handleRemoveAvatar} disabled={avatarBusy}>
                    <Text style={styles.removePhotoLink}>Remove current photo</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>

            <SectionLabel>Account Details</SectionLabel>
            <Card>
              <Field
                label="Full name"
                required
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
              />

              <View style={styles.readonlyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.readonlyBox}>
                    <Text style={styles.readonlyText} numberOfLines={1}>
                      {email || '—'}
                    </Text>
                  </View>
                </View>
                <View style={{ width: 120 }}>
                  <Text style={styles.label}>Role</Text>
                  <View style={styles.readonlyBox}>
                    <Text style={[styles.readonlyText, { textTransform: 'capitalize' }]} numberOfLines={1}>
                      {String(role).replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Barangay</Text>
              <Pressable
                onPress={() => setShowBarangays((v) => !v)}
                style={styles.pickerTrigger}
              >
                <Text style={styles.pickerText}>{barangay}</Text>
                <Ionicons
                  name={showBarangays ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.muted}
                />
              </Pressable>

              {showBarangays && (
                <View style={styles.chipGrid}>
                  {BARANGAYS.map((b) => (
                    <Chip
                      key={b}
                      label={b}
                      active={barangay === b}
                      onPress={() => {
                        setBarangay(b);
                        setShowBarangays(false);
                      }}
                    />
                  ))}
                </View>
              )}

              <Button
                title="Save profile"
                icon="checkmark"
                loading={saving}
                onPress={saveProfile}
                style={{ marginTop: 16 }}
              />
            </Card>
          </>
        ) : null}

        {activeTab === 'notifications' ? <NotificationsTab userId={userId} /> : null}
        {activeTab === 'privacy' ? <PrivacyTab userId={userId} email={email} /> : null}
        {activeTab === 'security' ? <SecurityTab user={session?.user} /> : null}
        {activeTab === 'danger' ? (
          <DangerZoneTab userId={userId} role={role} onRefreshProfile={refreshProfile} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  tabBarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
    backgroundColor: COLORS.bg,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  tabPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabPillDangerActive: {
    backgroundColor: COLORS.bad,
    borderColor: COLORS.bad,
  },
  tabText: { fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  tabTextActive: { color: COLORS.white },
  body: { paddingHorizontal: 16, paddingTop: 4 },
  avatarCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatarImg: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: COLORS.mutedBg,
    borderWidth: 2,
    borderColor: COLORS.line,
  },
  avatarPlaceholder: {
    backgroundColor: '#FBC14E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.primaryDark },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(17,29,21,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 16 },
  avatarBtns: { flexDirection: 'row', gap: 8 },
  removePhotoLink: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.bad },
  readonlyRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  readonlyBox: {
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.mutedBg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  readonlyText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.muted },
  label: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  pickerTrigger: {
    height: 46,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.ink },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
});
