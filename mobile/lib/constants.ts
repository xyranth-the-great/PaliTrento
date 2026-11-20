export const CATS: Record<string, string> = {
  SARI_SARI: 'Sari-sari store',
  CARINDERIA: 'Carinderia',
  FRESH_PRODUCE: 'Fresh produce',
  PHARMACY: 'Pharmacy',
  CLOTHING: 'Clothing',
  SERVICES: 'Services',
  PRODUCT: 'Product',
  AGRI: 'Agri supply',
};

export const UNITS: Record<string, string> = {
  KG: 'kg',
  PC: 'pc',
  POUCH: 'pouch',
  BOTTLE: 'bottle',
  SACK_25KG: '25-kg sack',
  TIE: 'tie',
};

export const PAY: Record<string, string> = {
  CASH: 'Cash',
  GCASH: 'GCash',
};

// Product categories used by the website's seller product form
export const PRODUCT_CATEGORIES = [
  'Rice',
  'Meat',
  'Seafood',
  'Vegetables',
  'Fruits',
  'Canned',
  'Noodles',
  'Condiments',
  'Snacks',
  'Beverages',
  'Personal Care',
  'Household',
  'Medicine',
  'Clothing',
] as const;

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  Canned: 'Canned Goods',
};

export const ADVISORY_CATEGORIES: Record<string, string> = {
  PRICE_CAP: 'Price Cap',
  ANNOUNCEMENT: 'Announcement',
  EMERGENCY: 'Emergency',
  GENERAL: 'General',
};

export const ADVISORY_PRIORITIES: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

export const BARANGAYS = [
  'Basa',
  'Cebolin',
  'Cuevas',
  'Kapatungan',
  'Langasian',
  'Manat',
  'Pangyan',
  'Poblacion',
  'Pulang Lupa',
  'Salvacion',
  'San Ignacio',
  'San Isidro',
  'San Roque',
  'Santa Maria',
  'Sto. Niño',
  'Tudela',
] as const;

export const TRENTO_CENTER = { lat: 8.0469, lng: 126.0631 };

export const ONBOARDING_KEY = 'palitrento_onboarded_v1';

export function peso(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return '₱0';
  return (
    '₱' +
    num.toLocaleString('en-PH', {
      minimumFractionDigits: num % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function isStoreOpen(s?: { open_time?: string | null; close_time?: string | null } | null): boolean {
  if (!s?.open_time || !s?.close_time) return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMins(s.open_time) && mins < toMins(s.close_time);
}

export function formatClock(t?: string | null): string {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m || 0).padStart(2, '0')} ${ap}`;
}

export function formatHours(s?: { open_time?: string | null; close_time?: string | null } | null): string {
  if (!s?.open_time || !s?.close_time) return 'Hours not listed';
  return `${formatClock(s.open_time)} – ${formatClock(s.close_time)}`;
}

export function getSrpStatus(p: { current_price: number; lgu_srp_ceiling?: number | null }) {
  if (p.lgu_srp_ceiling == null) return null;
  if (p.current_price <= p.lgu_srp_ceiling) {
    return { ok: true, text: 'Within cap' };
  }
  return {
    ok: false,
    text: `Over by ${peso(p.current_price - p.lgu_srp_ceiling)}`,
  };
}

export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat?: number | null; lng?: number | null }
): number {
  if (b.lat == null || b.lng == null) return Infinity;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2 * sin2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
