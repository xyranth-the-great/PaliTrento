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
import { Ionicons } from '@expo/vector-icons';
import { adminGetAuditLogs, AuditLogEntry, formatAdminDate } from '../../lib/admin';
import { Button, Card, Chip, EmptyState, ScreenHeader, StatusPill, Tone } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

function actionTone(action: string): Tone {
  if (action === 'DELETE') return 'bad';
  if (action === 'INSERT') return 'ok';
  return 'info';
}

export default function AdminActivityLogScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      setLogs(await adminGetAuditLogs(actionFilter || undefined));
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load activity records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const hay = `${l.actor_name || ''} ${l.actor_role || ''} ${l.target_name || ''} ${l.resource_type} ${l.summary || ''} ${(l.changed_fields || []).join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }, [logs, search]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Activity log"
        subtitle={`${filtered.length} recent record${filtered.length === 1 ? '' : 's'}`}
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
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search actor, table, summary, or field..."
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingVertical: 12 }}
        >
          {[
            ['', 'All actions'],
            ['INSERT', 'INSERT'],
            ['UPDATE', 'UPDATE'],
            ['DELETE', 'DELETE'],
          ].map(([val, label]) => (
            <Chip
              key={val || 'all'}
              label={label}
              active={actionFilter === val}
              onPress={() => setActionFilter(val)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg ? (
          <EmptyState
            icon="receipt-outline"
            title="Activity log unavailable"
            text={errorMsg}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="No activity records"
            text="No audit records match your current filter."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((log) => {
              const actorName =
                log.actor_name ||
                (log.actor_user_id ? `User ${log.actor_user_id.slice(0, 8)}` : 'System');
              const hasTarget =
                log.target_user_id && log.target_user_id !== log.actor_user_id;
              const targetLabel =
                log.target_name ||
                (log.target_user_id ? `User ${log.target_user_id.slice(0, 8)}` : '');
              const fields = Array.isArray(log.changed_fields) ? log.changed_fields : [];

              return (
                <Card key={String(log.id)} style={{ gap: 7 }}>
                  <View style={styles.cardHead}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                      <StatusPill label={log.action} tone={actionTone(log.action)} />
                      <View style={styles.resBadge}>
                        <Text style={styles.resBadgeText}>{log.resource_type}</Text>
                      </View>
                    </View>
                    <Text style={styles.timeText}>{formatAdminDate(log.created_at)}</Text>
                  </View>

                  <Text style={styles.summaryText} numberOfLines={2}>
                    {log.summary || log.resource_id || log.resource_type}
                  </Text>

                  <View style={styles.actorRow}>
                    <Ionicons name="person-circle-outline" size={14} color={COLORS.muted} />
                    <Text style={styles.actorText} numberOfLines={1}>
                      {actorName} ({log.actor_role || 'user'})
                      {hasTarget ? ` → ${targetLabel}` : ''}
                    </Text>
                  </View>

                  {fields.length > 0 ? (
                    <View style={styles.fieldsWrap}>
                      {fields.slice(0, 8).map((f) => (
                        <View key={f} style={styles.fieldPill}>
                          <Text style={styles.fieldPillText}>{f.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                      {fields.length > 8 ? (
                        <Text style={styles.moreFields}>+{fields.length - 8} more</Text>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
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
    ...SHADOW.card,
  },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: FONTS.medium, color: COLORS.ink },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  resBadge: {
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  resBadgeText: { fontSize: 10.5, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  timeText: { fontSize: 10.5, fontFamily: FONTS.medium, color: COLORS.muted },
  summaryText: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.ink },
  actorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actorText: { flex: 1, fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted },
  fieldsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingTop: 2 },
  fieldPill: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  fieldPillText: { fontSize: 10.5, fontFamily: FONTS.semibold, color: COLORS.inkSecondary },
  moreFields: { fontSize: 10.5, fontFamily: FONTS.bold, color: COLORS.muted, alignSelf: 'center' },
});
