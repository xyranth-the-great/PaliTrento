import React, { useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { TRENTO_CENTER } from '../lib/constants';
import { COLORS, FONTS, RADIUS } from '../lib/theme';

const NativeWebView = WebView as unknown as React.ComponentType<any>;

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

export function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  const webRef = useRef<any>(null);
  const [locating, setLocating] = React.useState(false);

  // Only build the HTML once; later pin moves are pushed with injectJavaScript
  const html = useMemo(() => {
    const startLat = lat ?? TRENTO_CENTER.lat;
    const startLng = lng ?? TRENTO_CENTER.lng;
    const hasPin = lat != null && lng != null;
    return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#e8efe9}</style>
</head><body><div id="map"></div><script>
var map = L.map('map',{zoomControl:true}).setView([${startLat},${startLng}], ${hasPin ? 17 : 14});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var pin = ${hasPin ? `L.circleMarker([${startLat},${startLng}],{radius:10,color:'#112B1A',weight:3,fillColor:'#F0A030',fillOpacity:1}).addTo(map)` : 'null'};
function setPin(la,ln,fly){
  if(pin){pin.setLatLng([la,ln]);}else{pin=L.circleMarker([la,ln],{radius:10,color:'#112B1A',weight:3,fillColor:'#F0A030',fillOpacity:1}).addTo(map);}
  if(fly){map.flyTo([la,ln],17,{duration:0.6});}
}
window.setPin = setPin;
map.on('click',function(e){
  setPin(e.latlng.lat,e.latlng.lng,false);
  window.ReactNativeWebView.postMessage(JSON.stringify({lat:e.latlng.lat,lng:e.latlng.lng}));
});
</script></body></html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      onChange(latitude, longitude);
      webRef.current?.injectJavaScript(`window.setPin && window.setPin(${latitude}, ${longitude}, true); true;`);
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <View style={styles.mapWrap}>
        <NativeWebView
          ref={webRef}
          source={{ html }}
          originWhitelist={['*']}
          style={{ flex: 1 }}
          nestedScrollEnabled
          onMessage={(e: WebViewMessageEvent) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (typeof msg.lat === 'number' && typeof msg.lng === 'number') onChange(msg.lat, msg.lng);
            } catch {}
          }}
        />
        <Pressable onPress={useMyLocation} style={styles.gpsBtn} accessibilityLabel="Use my location">
          {locating ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="locate" size={20} color={COLORS.primary} />}
        </Pressable>
      </View>
      <Text style={styles.coords}>
        {lat != null && lng != null ? `Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Tap the map to pin your store, or use your location.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: { height: 220, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line },
  gpsBtn: { position: 'absolute', right: 10, bottom: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  coords: { fontSize: 11.5, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 7 },
});
