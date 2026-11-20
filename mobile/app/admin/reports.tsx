import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATS } from '../../lib/constants';
import { adminGetReportsOverview, AdminReportsOverview } from '../../lib/admin';
import { Button, Card, EmptyState, ScreenHeader, SectionLabel } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function AdminReportsOverviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<AdminReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      setData(await adminGetReportsOverview());
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load platform reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cappedTotal = data ? data.withinCap + data.overCap : 0;
  const compliancePct = cappedTotal > 0 && data ? Math.round((data.withinCap / cappedTotal) * 100) : 100;
  const maxCat = data?.categoryBreakdown[0]?.count || 1;
  const maxBrgy = data?.barangayBreakdown[0]?.count || 1;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Platform overview"
        subtitle="Municipality of Trento marketplace stats"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 16 }}
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
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg || !data ? (
          <EmptyState
            icon="bar-chart-outline"
            title="Overview unavailable"
            text={errorMsg || 'Could not load marketplace summary.'}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : (
          <>
            {/* 2x2 KPI Grid */}
            <View style={styles.kpiGrid}>
              <KpiTile
                icon="storefront-outline"
                label="Total Stores"
                value={data.totalStores}
                accent={COLORS.primary}
              />
              <KpiTile
                icon="shield-checkmark-outline"
                label="Verified Stores"
                value={data.verifiedStores}
                accent={COLORS.ok}
              />
              <KpiTile
                icon="pricetag-outline"
                label="Total Products"
                value={data.totalProducts}
                accent={COLORS.info}
              />
              <KpiTile
                icon="bag-check-outline"
                label="Total Orders"
                value={data.totalOrders}
                accent="#D97706"
              />
            </View>

            {/* Bantay Presyo Compliance */}
            <SectionLabel>Bantay Presyo SRP Compliance</SectionLabel>
            <Card style={{ gap: 12 }}>
              <View style={styles.complianceHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.complianceTitle}>
                    {cappedTotal > 0 ? `${compliancePct}% within LGU cap` : 'No capped items yet'}
                  </Text>
                  <Text style={styles.muted}>
                    {cappedTotal} product{cappedTotal === 1 ? '' : 's'} monitored with LGU SRP ceilings
                  </Text>
                </View>
                <Button
                  title="Edit caps"
                  icon="pricetag-outline"
                  variant="soft"
                  small
                  onPress={() =>
                    router.push({ pathname: '/admin/marketplace', params: { kind: 'products' } })
                  }
                />
              </View>

              {data.totalProducts > 0 ? (
                <View style={styles.stackedBar}>
                  {data.withinCap > 0 ? (
                    <View
                      style={[
                        styles.stackSegment,
                        { flex: data.withinCap, backgroundColor: COLORS.ok },
                      ]}
                    />
                  ) : null}
                  {data.overCap > 0 ? (
                    <View
                      style={[
                        styles.stackSegment,
                        { flex: data.overCap, backgroundColor: COLORS.bad },
                      ]}
                    />
                  ) : null}
                  {data.noCap > 0 ? (
                    <View
                      style={[
                        styles.stackSegment,
                        { flex: data.noCap, backgroundColor: COLORS.line },
                      ]}
                    />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.capGrid}>
                <CapStat label="Within cap" value={data.withinCap} color={COLORS.ok} bg={COLORS.okBg} />
                <CapStat label="Over cap" value={data.overCap} color={COLORS.bad} bg={COLORS.badBg} />
                <CapStat label="No cap" value={data.noCap} color={COLORS.muted} bg={COLORS.mutedBg} />
              </View>
            </Card>

            {/* Stores by Category */}
            <SectionLabel>Stores by Trade Category</SectionLabel>
            <Card style={{ gap: 10 }}>
              {data.categoryBreakdown.length === 0 ? (
                <Text style={styles.muted}>No store records yet.</Text>
              ) : (
                data.categoryBreakdown.map((item) => (
                  <BarRow
                    key={item.category}
                    label={CATS[item.category] || item.category}
                    count={item.count}
                    max={maxCat}
                    color={COLORS.primary}
                  />
                ))
              )}
            </Card>

            {/* Stores by Barangay */}
            <SectionLabel>Stores by Barangay</SectionLabel>
            <Card style={{ gap: 10 }}>
              {data.barangayBreakdown.length === 0 ? (
                <Text style={styles.muted}>No barangay records yet.</Text>
              ) : (
                data.barangayBreakdown.map((item) => (
                  <BarRow
                    key={item.barangay}
                    label={item.barangay}
                    count={item.count}
                    max={maxBrgy}
                    color="#D97706"
                  />
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function KpiTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.kpiTile}>
      <View style={[styles.kpiIcon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function CapStat({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.capStat, { backgroundColor: bg }]}>
      <Text style={[styles.capVal, { color }]}>{value}</Text>
      <Text style={[styles.capLbl, { color }]}>{label}</Text>
    </View>
  );
}

function BarRow({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = Math.max(6, Math.round((count / Math.max(max, 1)) * 100));
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barCount}>{count}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiTile: {
    width: '48.4%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    gap: 4,
    ...SHADOW.card,
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiValue: { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.ink, letterSpacing: -0.4 },
  kpiLabel: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.muted },
  complianceHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  complianceTitle: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  muted: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 1 },
  stackedBar: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: COLORS.mutedBg,
  },
  stackSegment: { height: '100%' },
  capGrid: { flexDirection: 'row', gap: 8 },
  capStat: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  capVal: { fontSize: 18, fontFamily: FONTS.extrabold },
  capLbl: { fontSize: 11, fontFamily: FONTS.bold },
  barLabel: { flex: 1, fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.ink, paddingRight: 8 },
  barCount: { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.primary },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.mutedBg,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
});
