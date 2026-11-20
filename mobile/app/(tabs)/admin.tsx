import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BARANGAYS, CATS } from '../../lib/constants';
import { Store } from '../../lib/data';
import { adminGetStores, adminStatus, PERMITS } from '../../lib/seller';
import { AdminDashboardCounts, adminGetDashboardCounts } from '../../lib/admin';
import { Chip, EmptyState, StatusBarCover, StatusPill } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

type AdminStore = Store & Record<string, any>;
type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ALL';

const EMPTY_COUNTS: AdminDashboardCounts = {
  openBusinessReports: 0,
  openProductReports: 0,
  openSupportTickets: 0,
  pendingDocs: 0,
  pickupCases: 0,
  removedStores: 0,
  removedProducts: 0,
};

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [hubCounts, setHubCounts] = useState<AdminDashboardCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [barangay, setBarangay] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [storeList, summary] = await Promise.all([
        adminGetStores(),
        adminGetDashboardCounts(),
      ]);
      setStores(storeList);
      setHubCounts(summary);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const counts = useMemo(
    () => ({
      PENDING: stores.filter(
        (s) => !s.is_suspended && s.approval_status !== 'APPROVED' && s.approval_status !== 'REJECTED'
      ).length,
      APPROVED: stores.filter((s) => !s.is_suspended && s.approval_status === 'APPROVED').length,
      REJECTED: stores.filter((s) => !s.is_suspended && s.approval_status === 'REJECTED').length,
      SUSPENDED: stores.filter((s) => s.is_suspended).length,
      ALL: stores.length,
    }),
    [stores]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (filter === 'SUSPENDED' && !s.is_suspended) return false;
      if (
        filter === 'PENDING' &&
        (s.is_suspended || s.approval_status === 'APPROVED' || s.approval_status === 'REJECTED')
      ) {
        return false;
      }
      if ((filter === 'APPROVED' || filter === 'REJECTED') && (s.is_suspended || s.approval_status !== filter)) {
        return false;
      }
      if (barangay && s.barangay !== barangay) return false;
      if (q) {
        const hay = `${s.business_name || ''} ${s.proprietor_name || ''} ${s.trn_code || ''} ${s.barangay || ''}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [barangay, filter, search, stores]);

  const openReports = hubCounts.openBusinessReports + hubCounts.openProductReports;
  const hiddenTotal = hubCounts.removedStores + hubCounts.removedProducts;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[COLORS.primary]}
          />
        }
      >
        <Text style={styles.pageTitle}>Admin</Text>

        <LinearGradient
          colors={['#143520', '#1E4E30']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <Text style={styles.heroEyebrow}>MUNICIPALITY OF TRENTO</Text>
          <Text style={styles.heroTitle}>Marketplace command center</Text>
          <View style={styles.heroStats}>
            <HeroStat value={counts.PENDING} label="Pending" />
            <HeroStat value={counts.APPROVED} label="Approved" />
            <HeroStat value={counts.REJECTED + counts.SUSPENDED} label="Flagged" />
            <HeroStat value={counts.ALL} label="Stores" />
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Admin tools</Text>
        <View style={styles.toolsGrid}>
          <ToolCard
            icon="people-outline"
            title="Accounts"
            sub="Warn, suspend, ban"
            onPress={() => router.push('/admin/accounts')}
          />
          <ToolCard
            icon="flag-outline"
            title="Reports"
            sub="Businesses & products"
            badge={openReports > 0 ? String(openReports) : undefined}
            badgeTone="bad"
            onPress={() => router.push('/admin/reports-management')}
          />
          <ToolCard
            icon="mail-unread-outline"
            title="Support inbox"
            sub="Tickets & replies"
            badge={hubCounts.openSupportTickets > 0 ? String(hubCounts.openSupportTickets) : undefined}
            badgeTone="info"
            onPress={() => router.push('/admin/support')}
          />
          <ToolCard
            icon="pricetag-outline"
            title="Marketplace"
            sub="Hide items & LGU caps"
            badge={hiddenTotal > 0 ? `${hiddenTotal} hidden` : undefined}
            badgeTone="warn"
            onPress={() => router.push('/admin/marketplace')}
          />
          <ToolCard
            icon="time-outline"
            title="Pickup cases"
            sub="72h no-show records"
            badge={hubCounts.pickupCases > 0 ? String(hubCounts.pickupCases) : undefined}
            badgeTone="warn"
            onPress={() => router.push('/admin/pickup-cases')}
          />
          <ToolCard
            icon="document-text-outline"
            title="Permit docs"
            sub="Submitted files"
            badge={hubCounts.pendingDocs > 0 ? String(hubCounts.pendingDocs) : undefined}
            badgeTone="warn"
            onPress={() => router.push('/admin/verification-docs')}
          />
          <ToolCard
            icon="bar-chart-outline"
            title="Overview"
            sub="SRP & barangay stats"
            onPress={() => router.push('/admin/reports')}
          />
          <ToolCard
            icon="receipt-outline"
            title="Activity log"
            sub="Immutable audit trail"
            onPress={() => router.push('/admin/activity')}
          />
        </View>

        <Pressable
          onPress={() => router.push('/admin/advisory')}
          style={({ pressed }) => [styles.advisoryBar, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.advisoryIcon}>
            <Ionicons name="megaphone" size={19} color={COLORS.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.advisoryTitle}>Send Bantay Presyo & public advisory</Text>
            <Text style={styles.advisorySub}>Broadcast price updates and notices to Trento residents</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </Pressable>

        <Text style={styles.sectionTitle}>Store verification</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search store, proprietor, or TRN..."
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingTop: 10, paddingBottom: 6 }}
        >
          {(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ALL'] as Filter[]).map((f) => (
            <Chip
              key={f}
              label={`${f.charAt(0)}${f.slice(1).toLowerCase()} (${counts[f]})`}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 12 }}
        >
          <Chip label="All barangays" active={barangay === ''} onPress={() => setBarangay('')} />
          {BARANGAYS.map((b) => (
            <Chip key={b} label={b} active={barangay === b} onPress={() => setBarangay(b)} />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="Nothing here"
            text="No stores match this filter right now."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((s) => {
              const st = adminStatus(s);
              const approvedPermits = PERMITS.filter((p) => s[p.statusColumn] === 'APPROVED').length;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push({ pathname: '/admin/store/[id]', params: { id: s.id } })}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
                >
                  {s.storefront_image_url ? (
                    <Image source={{ uri: s.storefront_image_url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Ionicons name="storefront-outline" size={20} color={COLORS.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {s.business_name}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {CATS[s.trade_category] || s.trade_category} • {s.barangay} • {s.proprietor_name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                      <StatusPill label={st.label} tone={st.tone} />
                      <StatusPill
                        label={`Permits ${approvedPermits}/3`}
                        tone={approvedPermits === 3 ? 'ok' : 'info'}
                      />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <StatusBarCover />
    </View>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function ToolCard({
  icon,
  title,
  sub,
  badge,
  badgeTone = 'info',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  badge?: string;
  badgeTone?: 'bad' | 'warn' | 'info';
  onPress: () => void;
}) {
  const badgeColors =
    badgeTone === 'bad'
      ? { bg: COLORS.badBg, fg: COLORS.bad }
      : badgeTone === 'warn'
        ? { bg: COLORS.warnBg, fg: COLORS.warn }
        : { bg: COLORS.infoBg, fg: COLORS.info };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toolCard, pressed && { opacity: 0.88 }]}>
      <View style={styles.toolTop}>
        <View style={styles.qaIcon}>
          <Ionicons name={icon} size={19} color={COLORS.primary} />
        </View>
        {badge ? (
          <View style={[styles.toolBadge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.toolBadgeText, { color: badgeColors.fg }]} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.qaTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.qaSub} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  pageTitle: { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.ink, letterSpacing: -0.5, marginBottom: 14 },
  hero: { borderRadius: RADIUS.xl, padding: 18, overflow: 'hidden', ...SHADOW.floating },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(240,160,48,0.2)',
  },
  heroEyebrow: { fontSize: 10, fontFamily: FONTS.extrabold, letterSpacing: 1.2, color: '#FBC14E' },
  heroTitle: { fontSize: 20, fontFamily: FONTS.extrabold, color: COLORS.white, marginTop: 4 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: 'center',
  },
  heroStatValue: { fontSize: 18.5, fontFamily: FONTS.extrabold, color: COLORS.white },
  heroStatLabel: { fontSize: 10.5, fontFamily: FONTS.semibold, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  sectionTitle: { fontSize: 16.5, fontFamily: FONTS.extrabold, color: COLORS.ink, marginTop: 20, marginBottom: 10 },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolCard: {
    width: '48.4%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    gap: 2,
    ...SHADOW.card,
  },
  toolTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 6,
  },
  qaIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBadge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 88,
  },
  toolBadgeText: { fontSize: 10, fontFamily: FONTS.extrabold },
  qaTitle: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.ink },
  qaSub: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.muted },
  advisoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FEF7E6',
    borderWidth: 1,
    borderColor: '#F6DCA0',
    borderRadius: RADIUS.lg,
    padding: 13,
    marginTop: 10,
  },
  advisoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FBC14E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryTitle: { fontSize: 13.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  advisorySub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.inkSecondary, marginTop: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 44,
    ...SHADOW.card,
  },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: FONTS.medium, color: COLORS.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 11,
    ...SHADOW.card,
  },
  thumb: { width: 58, height: 58, borderRadius: RADIUS.sm, backgroundColor: COLORS.mutedBg },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  rowTitle: { fontSize: 14.5, fontFamily: FONTS.bold, color: COLORS.ink },
  rowSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
});
