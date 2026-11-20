import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
const NativeWebView = WebView as unknown as React.ComponentType<any>;
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { CATS, isStoreOpen, TRENTO_CENTER } from '../../lib/constants';
import { getStores, Store } from '../../lib/data';
import { LIST_PERF_PROPS, useReducedMotion } from '../../lib/perf';
import { COLORS, RADIUS, SHADOW } from '../../lib/theme';

const SHEET_OPEN_HEIGHT = 222;
const SHEET_COLLAPSED_HEIGHT = 56;
const SHEET_SLIDE_DELTA = SHEET_OPEN_HEIGHT - SHEET_COLLAPSED_HEIGHT;

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapActivated, setMapActivated] = useState(false);
  const reduceMotion = useReducedMotion();
  const sheetProgress = useRef(new Animated.Value(0)).current; // 0 = open, 1 = collapsed

  useEffect(() => {
    const toValue = sheetOpen ? 0 : 1;
    if (reduceMotion) {
      sheetProgress.setValue(toValue);
      return;
    }
    Animated.spring(sheetProgress, {
      toValue,
      stiffness: 290,
      damping: 26,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, sheetOpen, sheetProgress]);

  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SHEET_SLIDE_DELTA],
  });
  const gpsTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SHEET_SLIDE_DELTA - 4],
  });
  const chevronRotate = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Lazy-activate Chromium WebView only once Map is actually visited (saves ~80MB RAM on startup for low-end Android)
  useFocusEffect(
    useCallback(() => {
      setMapActivated(true);
    }, [])
  );

  useEffect(() => {
    if (!mapActivated) return;
    (async () => {
      const list = await getStores();
      setStores(list.filter((s) => s.lat != null && s.lng != null));
      setLoading(false);
    })();
  }, [mapActivated]);

  const mapHtml = useMemo(() => {
    const markersJson = JSON.stringify(
      stores.map((s) => ({
        id: s.id,
        trn: s.trn_code,
        name: s.business_name,
        cat: CATS[s.trade_category] || s.trade_category,
        brgy: s.barangay,
        lat: s.lat,
        lng: s.lng,
        open: isStoreOpen(s),
      }))
    );
    return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#e8efe9;font-family:system-ui,sans-serif}
  .leaflet-popup-content-wrapper{border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.18)}
  .pop-title{font-weight:800;font-size:14px;color:#14351f;margin:0 0 2px}
  .pop-meta{font-size:12px;color:#5b675f;margin:0 0 8px}
  .pop-btn{display:inline-block;padding:6px 12px;border-radius:8px;background:#1f4d2e;color:#fff;font-size:12px;font-weight:700;border:0}
</style>
</head>
<body>
<div id="map"></div>
<script>
  const stores = ${markersJson};
  const map = L.map('map', { zoomControl: true }).setView([${TRENTO_CENTER.lat}, ${TRENTO_CENTER.lng}], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const markers = {};
  stores.forEach(s => {
    const m = L.circleMarker([s.lat, s.lng], {
      radius: 9, color: '#14351f', weight: 2.5,
      fillColor: s.open ? '#e59834' : '#94a3b8', fillOpacity: 1
    }).addTo(map);
    const btnId = 'open-' + s.id;
    m.bindPopup('<p class="pop-title">' + s.name.replace(/</g,'&lt;') + '</p><p class="pop-meta">' + s.cat + ' • ' + s.brgy + '</p><button class="pop-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'openStore\\',trn:\\'' + s.trn + '\\'}))">View store</button>');
    m.on('click', () => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: s.id })));
    markers[s.id] = m;
  });
  let meMarker = null;
  window.focusStore = (id, lat, lng) => {
    map.flyTo([lat, lng], 16, { duration: 0.6 });
    if (markers[id]) markers[id].openPopup();
  };
  window.showMe = (lat, lng) => {
    if (meMarker) meMarker.remove();
    meMarker = L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindPopup('You are here').openPopup();
    map.flyTo([lat, lng], 15, { duration: 0.6 });
  };
</script>
</body>
</html>`;
  }, [stores]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      webRef.current?.injectJavaScript(
        `window.showMe && window.showMe(${pos.coords.latitude}, ${pos.coords.longitude}); true;`
      );
    } finally {
      setLocating(false);
    }
  };

  const focusStore = (s: Store) => {
    setSelectedId(s.id);
    setSheetOpen(false);
    webRef.current?.injectJavaScript(
      `window.focusStore && window.focusStore(${JSON.stringify(s.id)}, ${s.lat}, ${s.lng}); true;`
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topTitle}>Trento Store Map</Text>
        <Text style={styles.topCount}>{stores.length} pins</Text>
      </View>

      <View style={styles.mapWrap}>
        {!mapActivated || loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <NativeWebView
            ref={webRef}
            source={{ html: mapHtml }}
            originWhitelist={['*']}
            style={styles.webview}
            onMessage={(e: WebViewMessageEvent) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'openStore' && msg.trn) {
                  router.push({ pathname: '/store/[trn]', params: { trn: msg.trn } });
                } else if (msg.type === 'select') {
                  setSelectedId(msg.id);
                }
              } catch {}
            }}
          />
        )}

        {/* Floating GPS button (glides smoothly with bottom sheet) */}
        <Animated.View
          style={[
            styles.gpsBtnWrap,
            { transform: [{ translateY: gpsTranslateY }] },
          ]}
        >
          <Pressable
            onPress={locateMe}
            style={({ pressed }) => [styles.gpsBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] }]}
            accessibilityLabel="Show my location"
          >
            {locating ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="locate" size={22} color={COLORS.primary} />
            )}
          </Pressable>
        </Animated.View>

        {/* Smooth Animated Bottom Store Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { height: SHEET_OPEN_HEIGHT, transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <Pressable onPress={() => setSheetOpen((v) => !v)} style={styles.sheetHeader}>
            <View style={styles.grabber} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Stores on the map ({stores.length})</Text>
              <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
              </Animated.View>
            </View>
          </Pressable>

          <FlatList
            data={stores}
            keyExtractor={(s) => s.id}
            {...LIST_PERF_PROPS}
            contentContainerStyle={styles.sheetList}
            renderItem={({ item }) => {
              const active = selectedId === item.id;
              const open = isStoreOpen(item);
              return (
                <Pressable
                  onPress={() => focusStore(item)}
                  style={[styles.sheetRow, active && styles.sheetRowActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>
                      {item.business_name}
                    </Text>
                    <Text style={styles.sheetRowMeta} numberOfLines={1}>
                      {CATS[item.trade_category] || item.trade_category} • {item.barangay} •{' '}
                      <Text style={{ color: open ? COLORS.ok : COLORS.muted, fontWeight: '700' }}>
                        {open ? 'Open' : 'Closed'}
                      </Text>
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/store/[trn]', params: { trn: item.trn_code } })
                    }
                    style={styles.goBtn}
                  >
                    <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                  </Pressable>
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  topCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.amberLight,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  mapWrap: { flex: 1, position: 'relative' },
  webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gpsBtnWrap: {
    position: 'absolute',
    right: 14,
    bottom: 236,
  },
  gpsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.floating,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...SHADOW.floating,
  },
  sheetHeader: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    marginBottom: 8,
  },
  sheetTitleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  sheetList: { padding: 10, gap: 6 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    gap: 8,
  },
  sheetRowActive: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  sheetRowName: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  sheetRowMeta: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  goBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
