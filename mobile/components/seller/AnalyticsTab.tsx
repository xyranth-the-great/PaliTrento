import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { peso } from '../../lib/constants';
import { SellerAnalytics } from '../../lib/seller';
import { Card } from '../ui';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const STATUS_ROWS = [
  { key: 'PENDING', label: 'Pending', color: COLORS.warn },
  { key: 'CONFIRMED', label: 'Confirmed', color: COLORS.info },
  { key: 'READY_FOR_PICKUP', label: 'Ready for pickup', color: COLORS.primary },
  { key: 'COMPLETED', label: 'Completed', color: COLORS.ok },
  { key: 'CANCELLED', label: 'Cancelled', color: COLORS.bad },
  { key: 'EXPIRED', label: 'Expired', color: COLORS.muted },
];

export function AnalyticsTab({ analytics }: { analytics: SellerAnalytics }) {
  const maxDailyOrders = Math.max(1, ...analytics.dailySeries.map((d) => d.orders));
  const totalPay = Math.max(1, analytics.paymentCounts.CASH + analytics.paymentCounts.GCASH);
  const cashPct = Math.round((analytics.paymentCounts.CASH / totalPay) * 100);
  const gcashPct = analytics.totalOrders > 0 ? 100 - cashPct : 0;

  return (
    <View style={{ gap: 12 }}>
      {/* Revenue & Conversion KPIs */}
      <View style={styles.kpiGrid}>
        <KpiTile
          icon="cash-outline"
          accent={COLORS.ok}
          label="Completed Revenue"
          value={peso(analytics.completedRevenue)}
        />
        <KpiTile
          icon="hourglass-outline"
          accent={COLORS.warn}
          label="Active Pipeline"
          value={peso(analytics.pipelineRevenue)}
        />
        <KpiTile
          icon="checkmark-done-outline"
          accent={COLORS.primary}
          label="Completion Rate"
          value={`${analytics.completionRate}%`}
        />
        <KpiTile
          icon="trending-up-outline"
          accent={COLORS.info}
          label="Avg Order Value"
          value={peso(analytics.avgOrderValue)}
        />
      </View>

      {/* Last 7 Days Order Volume */}
      <Card style={{ gap: 12 }}>
        <View style={styles.headRow}>
          <Text style={styles.cardHeading}>Last 7 Days Activity</Text>
          <Text style={styles.cardSub}>Orders / day</Text>
        </View>
        <View style={styles.chartRow}>
          {analytics.dailySeries.map((day, idx) => {
            const pct = day.orders > 0 ? Math.max(14, (day.orders / maxDailyOrders) * 100) : 6;
            return (
              <View key={`${day.label}-${idx}`} style={styles.chartCol}>
                <Text style={styles.chartVal}>{day.orders > 0 ? day.orders : ''}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${pct}%`,
                        backgroundColor: day.orders > 0 ? COLORS.primary : COLORS.mutedBg,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel} allowFontScaling={false}>
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Order Status Breakdown */}
      <Card style={{ gap: 10 }}>
        <View style={styles.headRow}>
          <Text style={styles.cardHeading}>Order Status Breakdown</Text>
          <Text style={styles.cardSub}>{analytics.totalOrders} total</Text>
        </View>
        {STATUS_ROWS.map((row) => {
          const count = analytics.statusCounts[row.key] || 0;
          const pct = analytics.totalOrders > 0 ? (count / analytics.totalOrders) * 100 : 0;
          return (
            <View key={row.key} style={{ gap: 4 }}>
              <View style={styles.headRow}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowCount}>{count}</Text>
              </View>
              <View style={styles.hBarTrack}>
                <View style={[styles.hBarFill, { width: `${pct}%`, backgroundColor: row.color }]} />
              </View>
            </View>
          );
        })}
      </Card>

      {/* Payment Method Split */}
      <Card style={{ gap: 10 }}>
        <Text style={styles.cardHeading}>Payment Methods</Text>
        <View style={styles.payRow}>
          <View style={styles.payTile}>
            <Ionicons name="cash-outline" size={18} color={COLORS.primary} />
            <Text style={styles.payVal}>{analytics.paymentCounts.CASH}</Text>
            <Text style={styles.payLabel}>
              Cash ({analytics.totalOrders > 0 ? `${cashPct}%` : '0%'})
            </Text>
          </View>
          <View style={styles.payTile}>
            <Ionicons name="phone-portrait-outline" size={18} color={COLORS.info} />
            <Text style={styles.payVal}>{analytics.paymentCounts.GCASH}</Text>
            <Text style={styles.payLabel}>GCash ({gcashPct}%)</Text>
          </View>
        </View>
      </Card>

      {/* Top Selling Products */}
      <Card style={{ gap: 10 }}>
        <Text style={styles.cardHeading}>Top Selling Products</Text>
        {analytics.topProducts.length === 0 ? (
          <Text style={styles.emptySub}>Complete customer orders to see your top performers here.</Text>
        ) : (
          analytics.topProducts.map((p, idx) => (
            <View key={p.id} style={styles.topRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.topUnits}>{p.unitsSold} sold</Text>
              </View>
              <Text style={styles.topRev}>{peso(p.revenue)}</Text>
            </View>
          ))
        )}
      </Card>

      {/* Catalog & Price-Cap Health */}
      <Card style={{ gap: 10 }}>
        <Text style={styles.cardHeading}>Catalog & Bantay Presyo Health</Text>
        <View style={styles.healthGrid}>
          <HealthBadge label="In stock" value={analytics.inStockCount} color={COLORS.ok} bg={COLORS.okBg} />
          <HealthBadge label="Out of stock" value={analytics.outOfStockCount} color={COLORS.bad} bg={COLORS.badBg} />
          <HealthBadge label="LGU capped" value={analytics.cappedCount} color={COLORS.info} bg={COLORS.infoBg} />
          <HealthBadge
            label="Over cap"
            value={analytics.overCapCount}
            color={analytics.overCapCount > 0 ? COLORS.bad : COLORS.muted}
            bg={analytics.overCapCount > 0 ? COLORS.badBg : COLORS.mutedBg}
          />
        </View>
      </Card>
    </View>
  );
}

function KpiTile({
  icon,
  accent,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.kpiTile}>
      <View style={[styles.kpiIcon, { backgroundColor: accent + '1A' }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={styles.kpiVal} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function HealthBadge({
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
    <View style={[styles.healthTile, { backgroundColor: bg }]}>
      <Text style={[styles.healthVal, { color }]}>{value}</Text>
      <Text style={[styles.healthLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiTile: {
    width: '48.4%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    gap: 4,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kpiVal: { fontSize: 17.5, fontFamily: FONTS.extrabold, color: COLORS.ink, letterSpacing: -0.3 },
  kpiLabel: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.muted },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeading: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  cardSub: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.muted },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    gap: 6,
    paddingTop: 10,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: 5 },
  chartVal: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.primary, height: 14 },
  barTrack: {
    width: '100%',
    maxWidth: 26,
    height: 70,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 8 },
  chartLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
    fontFamily: FONTS.bold,
    color: COLORS.muted,
  },
  rowLabel: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.inkSecondary },
  rowCount: { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.ink },
  hBarTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  hBarFill: { height: '100%', borderRadius: 4 },
  payRow: { flexDirection: 'row', gap: 10 },
  payTile: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.lineSubtle,
  },
  payVal: { fontSize: 19, fontFamily: FONTS.extrabold, color: COLORS.ink },
  payLabel: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.muted },
  emptySub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.muted },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.primary },
  topName: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.ink },
  topUnits: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
  topRev: { fontSize: 13.5, fontFamily: FONTS.extrabold, color: COLORS.primary },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  healthTile: {
    width: '48.2%',
    borderRadius: RADIUS.md,
    padding: 11,
    gap: 2,
  },
  healthVal: { fontSize: 19, fontFamily: FONTS.extrabold },
  healthLabel: { fontSize: 11.5, fontFamily: FONTS.bold },
});
