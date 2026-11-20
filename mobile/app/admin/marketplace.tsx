import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATS, peso } from '../../lib/constants';
import {
  adminGetMarketplaceListings,
  AdminMarketplaceProduct,
  AdminMarketplaceStore,
  adminSetMarketplaceVisibility,
  adminUpdateProductPriceCap,
} from '../../lib/admin';
import { Button, Card, Chip, EmptyState, ScreenHeader, StatusPill } from '../../components/ui';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../lib/theme';

type Kind = 'stores' | 'products';
type VisFilter = 'all' | 'public' | 'removed';

export default function AdminMarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string; q?: string }>();

  const [kind, setKind] = useState<Kind>(params.kind === 'products' ? 'products' : 'stores');
  const [stores, setStores] = useState<AdminMarketplaceStore[]>([]);
  const [products, setProducts] = useState<AdminMarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState(params.q ? String(params.q) : '');
  const [filter, setFilter] = useState<VisFilter>('all');

  // Remove modal state
  const [removeTarget, setRemoveTarget] = useState<{
    kind: Kind;
    id: string;
    name: string;
    initialReason: string;
  } | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [savingRemove, setSavingRemove] = useState(false);

  // Price cap modal state
  const [capTarget, setCapTarget] = useState<AdminMarketplaceProduct | null>(null);
  const [capValue, setCapValue] = useState('');
  const [savingCap, setSavingCap] = useState(false);

  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (params.kind === 'stores' || params.kind === 'products') setKind(params.kind);
    if (params.q != null) setSearch(String(params.q));
  }, [params.kind, params.q]);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      const res = await adminGetMarketplaceListings();
      setStores(res.stores);
      setProducts(res.products);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load marketplace listings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const productCountByStore = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.store_id, (map.get(p.store_id) || 0) + 1);
    }
    return map;
  }, [products]);

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      const hidden = Boolean(s.marketplace_removed_at);
      if (filter === 'public' && hidden) return false;
      if (filter === 'removed' && !hidden) return false;
      if (!q) return true;
      const hay = `${s.business_name} ${s.trn_code} ${s.barangay || ''} ${CATS[s.trade_category] || s.trade_category}`;
      return hay.toLowerCase().includes(q);
    });
  }, [filter, search, stores]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const st = storeById.get(p.store_id);
      const hidden = Boolean(p.marketplace_removed_at || st?.marketplace_removed_at);
      if (filter === 'public' && hidden) return false;
      if (filter === 'removed' && !hidden) return false;
      if (!q) return true;
      const hay = `${p.name} ${p.category || ''} ${st?.business_name || ''} ${st?.trn_code || ''}`;
      return hay.toLowerCase().includes(q);
    });
  }, [filter, products, search, storeById]);

  const openRemoveModal = (targetKind: Kind, id: string, name: string, existingReason?: string | null) => {
    setRemoveTarget({ kind: targetKind, id, name, initialReason: existingReason || '' });
    setRemoveReason(existingReason || '');
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const trimmed = removeReason.trim();
    if (!trimmed) {
      Alert.alert('Reason required', 'Enter a short reason before hiding this listing.');
      return;
    }
    setSavingRemove(true);
    try {
      await adminSetMarketplaceVisibility({
        kind: removeTarget.kind,
        id: removeTarget.id,
        remove: true,
        reason: trimmed,
      });
      setRemoveTarget(null);
      await load();
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Could not remove listing.');
    } finally {
      setSavingRemove(false);
    }
  };

  const handleRestore = (targetKind: Kind, id: string, name: string) => {
    Alert.alert(
      'Restore to marketplace?',
      `Make "${name}" visible in the public marketplace again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setRestoringId(id);
            try {
              await adminSetMarketplaceVisibility({ kind: targetKind, id, remove: false });
              await load();
            } catch (e: any) {
              Alert.alert('Restore failed', e?.message || 'Could not restore listing.');
            } finally {
              setRestoringId(null);
            }
          },
        },
      ]
    );
  };

  const openCapModal = (product: AdminMarketplaceProduct) => {
    setCapTarget(product);
    setCapValue(product.lgu_srp_ceiling != null ? String(product.lgu_srp_ceiling) : '');
  };

  const savePriceCap = async (clear = false) => {
    if (!capTarget) return;
    let nextCap: number | null = null;
    if (!clear) {
      const raw = capValue.trim();
      if (raw !== '') {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          Alert.alert('Invalid amount', 'Enter a valid price cap of 0 or more, or clear the cap.');
          return;
        }
        nextCap = Math.round(parsed * 100) / 100;
      }
    }

    const currentCap = capTarget.lgu_srp_ceiling == null ? null : Number(capTarget.lgu_srp_ceiling);
    if (nextCap === currentCap) {
      setCapTarget(null);
      return;
    }

    setSavingCap(true);
    try {
      await adminUpdateProductPriceCap(capTarget.id, nextCap);
      setCapTarget(null);
      Alert.alert(
        'Price cap updated',
        nextCap == null
          ? `Price cap cleared for "${capTarget.name}".`
          : `LGU price cap set to ${peso(nextCap)} for "${capTarget.name}".`
      );
      await load();
    } catch (e: any) {
      Alert.alert('Could not save cap', e?.message || 'Ensure you are signed in as an admin.');
    } finally {
      setSavingCap(false);
    }
  };

  const activeCount = kind === 'stores' ? filteredStores.length : filteredProducts.length;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Marketplace & price caps"
        subtitle={`${activeCount} ${kind === 'stores' ? 'store' : 'product'}${activeCount === 1 ? '' : 's'}`}
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
        <View style={styles.segRow}>
          <Pressable
            onPress={() => setKind('stores')}
            style={[styles.segBtn, kind === 'stores' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, kind === 'stores' && styles.segTextActive]}>
              Stores ({stores.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setKind('products')}
            style={[styles.segBtn, kind === 'products' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, kind === 'products' && styles.segTextActive]}>
              Products & Caps ({products.length})
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              kind === 'stores'
                ? 'Search store name, TRN, or barangay...'
                : 'Search product, category, or store...'
            }
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
          {(
            [
              ['all', 'All listings'],
              ['public', 'In marketplace'],
              ['removed', 'Removed / hidden'],
            ] as [VisFilter, string][]
          ).map(([val, label]) => (
            <Chip key={val} label={label} active={filter === val} onPress={() => setFilter(val)} />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : errorMsg ? (
          <EmptyState
            icon="storefront-outline"
            title="Could not load listings"
            text={errorMsg}
            action={<Button title="Retry" variant="soft" small onPress={load} style={{ marginTop: 8 }} />}
          />
        ) : activeCount === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No listings match"
            text="Try adjusting your search query or visibility filter."
          />
        ) : kind === 'stores' ? (
          <View style={{ gap: 10 }}>
            {filteredStores.map((s) => {
              const removed = Boolean(s.marketplace_removed_at);
              const prodCount = productCountByStore.get(s.id) || 0;
              return (
                <Card key={s.id} style={{ gap: 8 }}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {s.business_name}
                      </Text>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {CATS[s.trade_category] || s.trade_category} • {s.barangay || 'No barangay'} •{' '}
                        {s.trn_code}
                      </Text>
                    </View>
                    <StatusPill
                      label={removed ? 'Removed' : 'In marketplace'}
                      tone={removed ? 'bad' : 'ok'}
                    />
                  </View>

                  <Text style={styles.metaLine}>
                    {prodCount} product{prodCount === 1 ? '' : 's'} • Removing a store hides all of its products
                  </Text>

                  {removed && s.marketplace_removal_reason ? (
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonText}>
                        Reason: {s.marketplace_removal_reason}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFoot}>
                    {removed ? (
                      <Button
                        title="Restore store"
                        icon="refresh"
                        variant="primary"
                        small
                        loading={restoringId === s.id}
                        onPress={() => handleRestore('stores', s.id, s.business_name)}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <Button
                        title="Hide from marketplace"
                        icon="eye-off-outline"
                        variant="danger"
                        small
                        onPress={() =>
                          openRemoveModal('stores', s.id, s.business_name, s.marketplace_removal_reason)
                        }
                        style={{ flex: 1 }}
                      />
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredProducts.map((p) => {
              const st = storeById.get(p.store_id);
              const removed = Boolean(p.marketplace_removed_at);
              const hiddenWithStore = !removed && Boolean(st?.marketplace_removed_at);
              const overCap =
                p.lgu_srp_ceiling != null && Number(p.current_price) > Number(p.lgu_srp_ceiling);

              return (
                <Card key={p.id} style={{ gap: 8 }}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {st?.business_name || 'Unknown store'} • {p.category || 'Uncategorized'}
                      </Text>
                    </View>
                    <Text style={styles.priceText}>{peso(p.current_price)}</Text>
                  </View>

                  <View style={styles.pillRow}>
                    <StatusPill
                      label={
                        removed
                          ? 'Removed'
                          : hiddenWithStore
                            ? 'Hidden with store'
                            : 'In marketplace'
                      }
                      tone={removed || hiddenWithStore ? 'bad' : 'ok'}
                    />
                    {p.lgu_srp_ceiling != null ? (
                      <StatusPill
                        label={`LGU Cap ${peso(p.lgu_srp_ceiling)}${overCap ? ' • Over' : ''}`}
                        tone={overCap ? 'bad' : 'info'}
                      />
                    ) : (
                      <StatusPill label="No price cap" tone="muted" />
                    )}
                  </View>

                  {removed && p.marketplace_removal_reason ? (
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonText}>Reason: {p.marketplace_removal_reason}</Text>
                    </View>
                  ) : hiddenWithStore && st?.marketplace_removal_reason ? (
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonText}>
                        Store removal reason: {st.marketplace_removal_reason}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFoot}>
                    <Button
                      title={p.lgu_srp_ceiling != null ? 'Edit cap' : 'Set cap'}
                      icon="pricetag-outline"
                      variant="soft"
                      small
                      onPress={() => openCapModal(p)}
                      style={{ flex: 1 }}
                    />
                    {removed ? (
                      <Button
                        title="Restore"
                        icon="refresh"
                        variant="primary"
                        small
                        loading={restoringId === p.id}
                        onPress={() => handleRestore('products', p.id, p.name)}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <Button
                        title="Remove"
                        icon="eye-off-outline"
                        variant="danger"
                        small
                        onPress={() =>
                          openRemoveModal('products', p.id, p.name, p.marketplace_removal_reason)
                        }
                        style={{ flex: 1 }}
                      />
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Remove Listing Modal */}
      <Modal
        visible={Boolean(removeTarget)}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!savingRemove) setRemoveTarget(null); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => !savingRemove && setRemoveTarget(null)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>
              Hide {removeTarget?.kind === 'stores' ? 'store' : 'product'}
            </Text>
            <Text style={styles.sheetSub}>
              {removeTarget?.kind === 'stores'
                ? `Hiding "${removeTarget.name}" also hides all its products from the public marketplace. You can restore it anytime.`
                : `Hide "${removeTarget?.name}" from the public marketplace. The seller will see this reason.`}
            </Text>
            <Text style={styles.fieldLabel}>
              Removal reason <Text style={{ color: COLORS.bad }}>*</Text>
            </Text>
            <TextInput
              value={removeReason}
              onChangeText={setRemoveReason}
              multiline
              placeholder="Explain why this listing is being hidden..."
              placeholderTextColor={COLORS.muted}
              style={styles.textArea}
            />
            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                disabled={savingRemove}
                onPress={() => setRemoveTarget(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Hide listing"
                variant="danger"
                loading={savingRemove}
                onPress={confirmRemove}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* LGU Price Cap Modal */}
      <Modal
        visible={Boolean(capTarget)}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!savingCap) setCapTarget(null); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => !savingCap && setCapTarget(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>LGU Bantay Presyo cap</Text>
            <Text style={styles.sheetSub}>
              {capTarget?.name} • Current seller price: {peso(capTarget?.current_price || 0)}
            </Text>
            <Text style={styles.fieldLabel}>Official price ceiling (₱)</Text>
            <TextInput
              value={capValue}
              onChangeText={setCapValue}
              keyboardType="decimal-pad"
              placeholder="Leave empty for no cap"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />
            <View style={styles.modalBtnRow}>
              {capTarget?.lgu_srp_ceiling != null ? (
                <Button
                  title="Clear cap"
                  variant="danger"
                  disabled={savingCap}
                  onPress={() => savePriceCap(true)}
                  style={{ flex: 1 }}
                />
              ) : (
                <Button
                  title="Cancel"
                  variant="outline"
                  disabled={savingCap}
                  onPress={() => setCapTarget(null)}
                  style={{ flex: 1 }}
                />
              )}
              <Button
                title="Save cap"
                variant="primary"
                loading={savingCap}
                onPress={() => savePriceCap(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  segRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: COLORS.primary },
  segText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  segTextActive: { color: COLORS.white },
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
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemTitle: { fontSize: 14.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  itemSub: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  priceText: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.primary },
  metaLine: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonBox: {
    backgroundColor: COLORS.badBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reasonText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.bad, lineHeight: 17 },
  cardFoot: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17,29,21,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 18,
    paddingTop: 10,
    ...SHADOW.floating,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  sheetSub: { fontSize: 12.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2, marginBottom: 14, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  input: {
    height: 46,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
  },
  textArea: {
    minHeight: 84,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
