import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { AccountWarning, getAccountWarnings } from '../../lib/seller';
import { StatusBarCover } from '../../components/ui';
import { PremiumMembershipBanner, ProPill } from '../../components/premium';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, signOut, resetOnboarding } = useAuth();
  const { unreadCount } = useNotifications();
  const [warnings, setWarnings] = useState<AccountWarning[]>([]);

  useEffect(() => {
    if (!session?.user?.id) {
      setWarnings([]);
      return;
    }
    getAccountWarnings(session.user.id).then(setWarnings);
  }, [session?.user?.id]);

  const displayName =
    profile?.full_name || session?.user?.user_metadata?.full_name || 'PaliTrento User';
  const email = profile?.email || session?.user?.email || '';
  const roleLabel = (profile?.role || 'customer').replace('_', ' ');
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('');

  const confirmSignOut = () => {
    Alert.alert('Log out?', 'You will need to sign in again to access PaliTrento.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleReplayOnboarding = async () => {
    await resetOnboarding();
    router.replace('/onboarding');
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: 16 }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Profile</Text>
          <ProPill />
        </View>

        {/* Flagship Gradient Profile Card */}
        <LinearGradient
          colors={['#143520', '#1E4E30']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroGlow} />
          <View style={styles.profileRow}>
            <Pressable onPress={() => router.push('/settings')} style={styles.avatarTouch}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>{initials || 'PT'}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={11} color={COLORS.primaryDark} />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {email}
              </Text>
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {profile?.is_premium === true ? (
          <PremiumMembershipBanner
            currentPeriodEnd={profile.premium_details?.current_period_end ?? null}
            onManage={() =>
              router.push({ pathname: '/(tabs)/store', params: { tab: 'subscription' } })
            }
            style={{ marginTop: 14 }}
          />
        ) : null}

        {warnings.length > 0 && (
          <View style={styles.warningsCard}>
            <View style={styles.warningsHead}>
              <Ionicons name="warning" size={17} color={COLORS.warn} />
              <Text style={styles.warningsTitle}>
                Account {warnings.length === 1 ? 'Warning' : `Warnings (${warnings.length})`}
              </Text>
            </View>
            {warnings.map((w) => (
              <View key={w.id} style={styles.warningItem}>
                <Text style={styles.warningReason}>{w.reason}</Text>
                <Text style={styles.warningDate}>
                  {new Date(w.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>ACTIVITY</Text>
        <View style={styles.group}>
          <RowItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Price advisories, order updates, and messages"
            badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : undefined}
            onPress={() => router.push('/notifications')}
          />
          <RowItem
            icon="bag-check-outline"
            title="My Orders"
            subtitle="Track reservations and pickup deadlines"
            onPress={() => router.push('/(tabs)/orders')}
          />
          <RowItem
            icon="map-outline"
            title="Explore Trento Map"
            subtitle="Browse verified stores around you"
            onPress={() => router.push('/(tabs)/map')}
            last
          />
        </View>

        {profile?.role === 'business_owner' ? (
          <>
            <Text style={styles.sectionLabel}>MY BUSINESS</Text>
            <View style={styles.group}>
              <RowItem
                icon="storefront-outline"
                title="Store dashboard"
                subtitle="Orders, products, verification, and analytics"
                onPress={() => router.push('/(tabs)/store')}
              />
              <RowItem
                icon="sparkles-outline"
                title="Subscription & Promotions"
                subtitle="Premium plan, listing quota, and Featured Store"
                onPress={() => router.push({ pathname: '/(tabs)/store', params: { tab: 'subscription' } })}
              />
              <RowItem
                icon="qr-code-outline"
                title="Store QR Standee"
                subtitle="Counter display QR and printable A5/A4 PDF"
                onPress={() => router.push('/seller/standee')}
              />
              <RowItem
                icon="create-outline"
                title="Edit store details"
                subtitle="Hours, location, photos, and permits"
                onPress={() => router.push('/seller/store-setup')}
                last
              />
            </View>
          </>
        ) : null}

        {profile?.role === 'admin' ? (
          <>
            <Text style={styles.sectionLabel}>ADMIN</Text>
            <View style={styles.group}>
              <RowItem
                icon="shield-checkmark-outline"
                title="Admin command center"
                subtitle="Store verification & quick tools"
                onPress={() => router.push('/(tabs)/admin')}
              />
              <RowItem
                icon="people-outline"
                title="Accounts moderation"
                subtitle="Warnings, suspensions, bans & Premium"
                onPress={() => router.push('/admin/accounts')}
              />
              <RowItem
                icon="flag-outline"
                title="Reports management"
                subtitle="Review business and product reports"
                onPress={() => router.push('/admin/reports-management')}
              />
              <RowItem
                icon="mail-unread-outline"
                title="Support inbox"
                subtitle="Respond to user tickets"
                onPress={() => router.push('/admin/support')}
              />
              <RowItem
                icon="pricetag-outline"
                title="Marketplace & LGU caps"
                subtitle="Hide/restore listings and edit SRP ceilings"
                onPress={() => router.push('/admin/marketplace')}
              />
              <RowItem
                icon="megaphone-outline"
                title="Send advisory"
                subtitle="Bantay Presyo and public notices"
                onPress={() => router.push('/admin/advisory')}
                last
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>SUPPORT & PREFERENCES</Text>
        <View style={styles.group}>
          <RowItem
            icon="help-buoy-outline"
            title="Help & Support"
            subtitle="FAQs, contact admin, and support tickets"
            onPress={() => router.push('/support')}
          />
          <RowItem
            icon="settings-outline"
            title="Profile & Settings"
            subtitle="Photo, notifications, privacy, security & danger zone"
            onPress={() => router.push('/settings')}
          />
          <RowItem
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Marketplace rules and policies"
            onPress={() => router.push('/terms')}
          />
          <RowItem
            icon="sparkles-outline"
            title="Replay App Intro"
            subtitle="View the onboarding slides and permissions"
            onPress={handleReplayOnboarding}
            last
          />
        </View>

        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.bad} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
      <StatusBarCover />
    </View>
  );
}

function RowItem({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        pressed && { backgroundColor: COLORS.bg },
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText} allowFontScaling={false}>
            {badge}
          </Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={17} color={COLORS.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOW.floating,
  },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(240,160,48,0.22)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarTouch: { position: 'relative' },
  avatarEditBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FBC14E',
    borderWidth: 2,
    borderColor: '#143520',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningsCard: {
    marginTop: 14,
    backgroundColor: COLORS.warnBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.3)',
    padding: 13,
    gap: 8,
  },
  warningsHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warningsTitle: { fontSize: 13.5, fontFamily: FONTS.extrabold, color: COLORS.warn },
  warningItem: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(180, 83, 9, 0.2)',
    gap: 2,
  },
  warningReason: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.ink },
  warningDate: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.warn },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  avatarPlaceholder: {
    backgroundColor: '#FBC14E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
  },
  name: { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.white },
  email: { fontSize: 12, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  roleText: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    color: '#FBC14E',
    textTransform: 'capitalize',
  },
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.9,
    color: COLORS.muted,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 20,
  },
  group: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.ink },
  rowSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 1 },
  rowBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: COLORS.bad,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
    textAlign: 'center',
  },
  logoutBtn: {
    marginTop: 22,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.badBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.bad },
});
