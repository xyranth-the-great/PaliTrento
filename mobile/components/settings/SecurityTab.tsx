import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PASSWORD_RULES, passwordStrength } from '../../lib/account';
import { supabase } from '../../lib/supabase';
import { Button, Card, SectionLabel } from '../ui';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

interface Props {
  user: any;
}

export function SecurityTab({ user }: Props) {
  const isGoogle = user?.app_metadata?.provider === 'google';
  const [setupRequired, setSetupRequired] = useState(
    Boolean(isGoogle && user?.user_metadata?.password_setup_completed !== true)
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const pwCheck = passwordStrength(newPassword);
  const strengthColor =
    pwCheck.passed <= 2 ? COLORS.bad : pwCheck.passed <= 4 ? COLORS.warn : COLORS.ok;

  const handleUpdate = async () => {
    if ((!setupRequired && !currentPassword) || !newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    if (!pwCheck.valid) {
      Alert.alert('Weak password', 'Please satisfy all 5 password requirements below.');
      return;
    }

    setSaving(true);
    try {
      if (!setupRequired) {
        const email = user?.email;
        if (!email) throw new Error('Account email is unavailable.');
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyErr) {
          throw new Error('Current password is incorrect.');
        }
      }

      const updatePayload: any = { password: newPassword };
      if (setupRequired) {
        updatePayload.data = {
          ...(user?.user_metadata || {}),
          password_setup_completed: true,
        };
      }

      const { error } = await supabase.auth.updateUser(updatePayload);
      if (error) throw new Error(error.message);

      const wasSetup = setupRequired;
      if (wasSetup) setSetupRequired(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(
        wasSetup ? 'Password set' : 'Password updated',
        wasSetup
          ? 'You can now sign in with Google or with your email and password.'
          : 'Your password has been changed successfully.'
      );
    } catch (e: any) {
      Alert.alert('Could not update password', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <SectionLabel>Password & Sign-In</SectionLabel>
      <Card>
        <Text style={styles.desc}>
          {setupRequired
            ? 'Add a password so you can also sign in with your email and password. Google sign-in will keep working.'
            : 'Verify your current password before choosing a strong new password.'}
        </Text>

        {!setupRequired ? (
          <PasswordInput
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            visible={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            placeholder="Enter current password"
          />
        ) : null}

        <PasswordInput
          label={setupRequired ? 'Create password' : 'New password'}
          value={newPassword}
          onChangeText={setNewPassword}
          visible={showNew}
          onToggle={() => setShowNew((v) => !v)}
          placeholder="8+ chars, upper, lower, number, symbol"
        />

        {newPassword.length > 0 ? (
          <View style={styles.strengthBox}>
            <View style={styles.strengthHead}>
              <Text style={styles.strengthLabel}>Strength</Text>
              <Text style={[styles.strengthBadge, { color: strengthColor }]}>{pwCheck.label}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${(pwCheck.passed / pwCheck.total) * 100}%`,
                    backgroundColor: strengthColor,
                  },
                ]}
              />
            </View>
            <View style={styles.rulesList}>
              {PASSWORD_RULES.map((r) => {
                const met = r.test(newPassword);
                return (
                  <View key={r.key} style={styles.ruleRow}>
                    <Ionicons
                      name={met ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={met ? COLORS.ok : COLORS.muted}
                    />
                    <Text style={[styles.ruleText, met && { color: COLORS.ok }]}>{r.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <PasswordInput
          label={setupRequired ? 'Confirm password' : 'Confirm new password'}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          visible={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
          placeholder="Re-enter new password"
        />

        {confirmPassword.length > 0 && confirmPassword !== newPassword ? (
          <Text style={styles.mismatchText}>Passwords do not match yet.</Text>
        ) : null}

        <Button
          title={setupRequired ? 'Set password' : 'Change password'}
          icon="key-outline"
          variant="amber"
          loading={saving}
          onPress={handleUpdate}
          style={{ marginTop: 8 }}
        />
      </Card>
    </View>
  );
}

function PasswordInput({
  label,
  value,
  onChangeText,
  visible,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          style={styles.input}
        />
        <Pressable onPress={onToggle} hitSlop={8} style={styles.eyeBtn}>
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={19}
            color={COLORS.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desc: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, lineHeight: 17.5, marginBottom: 14 },
  label: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingLeft: 13,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    paddingVertical: 10,
  },
  eyeBtn: { padding: 6 },
  strengthBox: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  strengthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strengthLabel: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.muted },
  strengthBadge: { fontSize: 11.5, fontFamily: FONTS.extrabold },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.line,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  rulesList: { gap: 4, marginTop: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.muted },
  mismatchText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.bad, marginBottom: 6 },
});
