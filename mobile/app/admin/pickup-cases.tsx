import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminGetPickupCases, formatAdminDate, PickupNoShowCase } from '../../lib/admin';
import { Button, Card, EmptyState, ScreenHeader, StatusPill } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

export default function AdminPickupCasesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cases, setCases] = useState<PickupNoShowCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      setCases(await adminGetPickupCases());
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load pickup no-show records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) => {
      const hay = `${c.customer_name} ${c.store_name} ${c.product_name} ${c.order_id} ${c.reason}`;
      return hay.toLowerCase().includes(q);
    });
  }, [cases, search]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Pickup no-show cases"
        subtitle={`${cases.length} recorded 72h expiry case${cases.length === 1 ? '' : 's'}`}
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
        <View style={styles.infoBanner}>
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Reservations not picked up within 72 hours of being marked ready expire automatically and are logged here for repeat no-show review.
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search customer, store, product, or order..."
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Records unavailable"
            text={errorMsg}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title={cases.length === 0 ? 'No pickup no-show cases' : 'No matching cases'}
            text={
              cases.length === 0
                ? 'All ready reservations have been picked up on time.'
                : 'Try clearing your search query.'
            }
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((item) => (
              <Card key={item.id} style={{ gap: 8 }}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {item.customer_name || 'Customer'}
                    </Text>
                    <Text style={styles.storeSub} numberOfLines={1}>
                      {item.store_name || 'Store'} • Order #{item.order_id.slice(0, 8)}
                    </Text>
                  </View>
                  <StatusPill label="Expired 72h" tone="bad" />
                </View>

                <View style={styles.productBox}>
                  <Text style={styles.productTitle} numberOfLines={1}>
                    {item.product_name || 'Product'}
                  </Text>
                  <Text style={styles.productQty}>Qty: {item.quantity}</Text>
                </View>

                <View style={styles.metaGrid}>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>MARKED READY</Text>
                    <Text style={styles.metaVal}>{formatAdminDate(item.ready_at)}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>EXPIRED AT</Text>
                    <Text style={styles.metaVal}>{formatAdminDate(item.expired_at)}</Text>
                  </View>
                </View>

                {item.reason ? <Text style={styles.reasonText}>{item.reason}</Text> : null}

                <View style={styles.cardFoot}>
                  {item.customer_id ? (
                    <Button
                      title="Review customer account"
                      icon="shield-outline"
                      variant="soft"
                      small
                      onPress={() =>
                        router.push({
                          pathname: '/admin/accounts',
                          params: { userId: item.customer_id! },
                        })
                      }
                      style={{ flex: 1 }}
                    />
                  ) : (
                    <Text style={styles.unavailText}>Account unavailable (deleted)</Text>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#C5DEC9',
    padding: 12,
    marginBottom: 12,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: FONTS.medium, color: COLORS.primary, lineHeight: 17.5 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 12,
    ...SHADOW.card,
  },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: FONTS.medium, color: COLORS.ink },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  customerName: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.ink },
  storeSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  productBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  productTitle: { flex: 1, fontSize: 13, fontFamily: FONTS.bold, color: COLORS.ink, paddingRight: 8 },
  productQty: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },
  metaGrid: { flexDirection: 'row', gap: 8 },
  metaCell: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    padding: 8,
    gap: 2,
  },
  metaLabel: { fontSize: 9.5, fontFamily: FONTS.extrabold, letterSpacing: 0.6, color: COLORS.muted },
  metaVal: { fontSize: 11.5, fontFamily: FONTS.semibold, color: COLORS.ink },
  reasonText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 17 },
  cardFoot: { flexDirection: 'row', paddingTop: 4 },
  unavailText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted },
});
