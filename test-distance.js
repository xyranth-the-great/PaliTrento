// Test script for distance utilities
import { TRENTO_MARKET_CENTER, NEAR_CENTER_RADIUS_METERS, NEAR_CENTER_RADIUS_LABEL } from './js/config.js';

// Haversine distance in meters (copied from ui.js)
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Safe coordinate parsing
function parseCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Filter stores within NEAR_CENTER_RADIUS_METERS of TRENTO_MARKET_CENTER
function nearCenterStores(stores) {
  return stores
    .map(store => {
      const lat = parseCoord(store.lat);
      const lng = parseCoord(store.lng);
      if (lat === null || lng === null) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      if (lat === 0 && lng === 0) return null;
      const d = distanceMeters(TRENTO_MARKET_CENTER.lat, TRENTO_MARKET_CENTER.lng, lat, lng);
      if (d > NEAR_CENTER_RADIUS_METERS) return null;
      return { store, distance: d };
    })
    .filter(item => item !== null)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return (a.store.business_name || '').localeCompare(b.store.business_name || '');
    })
    .map(item => item.store);
}

console.log('=== Test Constants ===');
console.log('TRENTO_MARKET_CENTER:', TRENTO_MARKET_CENTER);
console.log('NEAR_CENTER_RADIUS_METERS:', NEAR_CENTER_RADIUS_METERS);
console.log('NEAR_CENTER_RADIUS_LABEL:', NEAR_CENTER_RADIUS_LABEL);
console.log('');

// Test cases
const centerLat = TRENTO_MARKET_CENTER.lat;
const centerLng = TRENTO_MARKET_CENTER.lng;

// T1. Exactly at the center
const T1 = { id: 't1', business_name: 'T1 Center Store', lat: centerLat, lng: centerLng };

// T2. Center latitude + 0.0280 degrees, same longitude (~3.11 km)
const T2 = { id: 't2', business_name: 'T2 Inside Store', lat: centerLat + 0.0280, lng: centerLng };

// T3. Center latitude + 0.0300 degrees, same longitude (~3.34 km)
const T3 = { id: 't3', business_name: 'T3 Outside Store', lat: centerLat + 0.0300, lng: centerLng };

// T4. Center latitude - 0.0300 degrees, same longitude
const T4 = { id: 't4', business_name: 'T4 Outside Store South', lat: centerLat - 0.0300, lng: centerLng };

// T5. latitude null, longitude 126.06
const T5 = { id: 't5', business_name: 'T5 Null Lat', lat: null, lng: 126.06 };

// T6. latitude "" (empty string), longitude ""
const T6 = { id: 't6', business_name: 'T6 Empty String', lat: '', lng: '' };

// T7. latitude 0, longitude 0
const T7 = { id: 't7', business_name: 'T7 Zero Zero', lat: 0, lng: 0 };

// T8. latitude "abc", longitude "xyz"
const T8 = { id: 't8', business_name: 'T8 Invalid', lat: 'abc', lng: 'xyz' };

// T9. Two included stores where the second is closer
const T9a = { id: 't9a', business_name: 'T9A Farther', lat: centerLat + 0.0200, lng: centerLng };
const T9b = { id: 't9b', business_name: 'T9B Closer', lat: centerLat + 0.0100, lng: centerLng };

console.log('=== Individual Distance Checks ===');
const testStores = [T1, T2, T3, T4, T5, T6, T7, T8, T9a, T9b];
testStores.forEach(s => {
  const lat = parseCoord(s.lat);
  const lng = parseCoord(s.lng);
  if (lat !== null && lng !== null && !(lat === 0 && lng === 0) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    const d = distanceMeters(centerLat, centerLng, lat, lng);
    console.log(`${s.business_name}: ${d.toFixed(1)}m (${(d/1000).toFixed(3)}km) - ${d <= NEAR_CENTER_RADIUS_METERS ? 'INCLUDED' : 'EXCLUDED'}`);
  } else {
    console.log(`${s.business_name}: EXCLUDED (invalid coords: lat=${lat}, lng=${lng})`);
  }
});

console.log('');
console.log('=== Filter Function Results ===');

const allTestStores = [T1, T2, T3, T4, T5, T6, T7, T8, T9a, T9b];
const filtered = nearCenterStores(allTestStores);
console.log('Filtered stores (in order):');
filtered.forEach((s, i) => {
  const lat = parseCoord(s.lat);
  const lng = parseCoord(s.lng);
  const d = distanceMeters(centerLat, centerLng, lat, lng);
  console.log(`  ${i+1}. ${s.business_name} - ${d.toFixed(1)}m`);
});

console.log('');
console.log('=== Expected vs Actual ===');
console.log('T1 (at center): INCLUDED ->', filtered.some(s => s.id === 't1') ? 'PASS' : 'FAIL');
console.log('T2 (+0.0280° ~3.11km): INCLUDED ->', filtered.some(s => s.id === 't2') ? 'PASS' : 'FAIL');
console.log('T3 (+0.0300° ~3.34km): EXCLUDED ->', !filtered.some(s => s.id === 't3') ? 'PASS' : 'FAIL');
console.log('T4 (-0.0300° ~3.34km): EXCLUDED ->', !filtered.some(s => s.id === 't4') ? 'PASS' : 'FAIL');
console.log('T5 (null lat): EXCLUDED ->', !filtered.some(s => s.id === 't5') ? 'PASS' : 'FAIL');
console.log('T6 (empty string): EXCLUDED ->', !filtered.some(s => s.id === 't6') ? 'PASS' : 'FAIL');
console.log('T7 (0,0): EXCLUDED ->', !filtered.some(s => s.id === 't7') ? 'PASS' : 'FAIL');
console.log('T8 (invalid): EXCLUDED ->', !filtered.some(s => s.id === 't8') ? 'PASS' : 'FAIL');
console.log('T9 order (closer first): T9B then T9A ->', filtered.findIndex(s => s.id === 't9b') < filtered.findIndex(s => s.id === 't9a') ? 'PASS' : 'FAIL');