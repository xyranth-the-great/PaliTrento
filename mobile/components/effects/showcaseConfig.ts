export type ProductShowcaseTheme = 'fire' | 'pikachu' | null;

/**
 * Exact showcase product UUIDs mirrored from the PaliTrento website
 * (`js/ui.js` & `js/product-detail.js`).
 */
export const FIRE_PRODUCT_IDS = new Set<string>([
  '55b671e1-b9b5-4109-acc7-73f7b61b7d0f',
]);

export const PIKACHU_PRODUCT_IDS = new Set<string>([
  '2ca26369-62b9-4b6e-a814-b2f2659b6228',
]);

export function getProductShowcaseTheme(
  product?: { id?: string | null } | null
): ProductShowcaseTheme {
  const id = product?.id;
  if (!id) return null;
  if (FIRE_PRODUCT_IDS.has(id)) return 'fire';
  if (PIKACHU_PRODUCT_IDS.has(id)) return 'pikachu';
  return null;
}

/**
 * Shared Gold Liquid Chrome palette matching `css/styles.css` custom properties.
 */
export const GOLD_CHROME = {
  deepBronze: '#3A2000',
  pillBase: '#6B4408',
  antiqueGold: '#8A5A0B',
  metallicGold: '#B8860B',
  brightGold: '#E3A728',
  edgeGold: '#F2C94C',
  radiantGold: '#FFD45C',
  creamHighlight: '#FFF4DC',
  softCream: '#FFF8E6',
  glowSoft: 'rgba(255, 190, 60, 0.36)',
  glowStrong: 'rgba(255, 190, 60, 0.62)',
  textShadow: 'rgba(30, 14, 0, 0.82)',
  glass: 'rgba(42, 24, 2, 0.34)',
  glassBorder: 'rgba(255, 232, 165, 0.36)',
} as const;

/**
 * Exact 12 rising ember definitions from `js/ui.js` & `js/product-detail.js`.
 * [leftPct, sizePx, delayMs, durationMs, driftX]
 */
export const SHOWCASE_EMBERS: readonly [number, number, number, number, number][] = [
  [8, 6, 0, 2600, -10],
  [30, 5, 900, 3000, 12],
  [52, 7, 1700, 2800, -6],
  [74, 5, 400, 3200, 14],
  [90, 6, 1300, 2700, 8],
  [18, 4, 2100, 3400, -14],
  [63, 4, 2600, 2900, -12],
  [40, 5, 200, 3100, 10],
  [82, 4, 1900, 2500, -8],
  [12, 5, 1100, 3300, 9],
  [58, 6, 700, 2600, 13],
  [95, 4, 2300, 3000, -9],
];

/**
 * Exact Pikachu lightning bolt placements (% x, % y) from `js/ui.js` & `js/product-detail.js`.
 */
export const PIKACHU_CARD_BOLTS: readonly [number, number][] = [
  [-5, 10],
  [94, 6],
  [-6, 48],
  [95, 40],
  [-5, 80],
  [94, 74],
];

export const PIKACHU_DETAIL_BOLTS: readonly [number, number][] = [
  [-4, 10],
  [96, 6],
  [-5, 48],
  [97, 40],
  [-4, 82],
  [96, 76],
  [30, -5],
  [70, -6],
  [50, 96],
];

/**
 * Exact twinkling sparkle coordinates (% x, % y, sizePx, delayMs) from `css/styles.css` `.pk-glit`.
 */
export const PIKACHU_SPARKLES: readonly [number, number, number, number][] = [
  [18, 22, 5, 0],
  [72, 30, 6, 420],
  [40, 64, 5, 860],
  [84, 78, 6, 1280],
  [12, 84, 4, 1700],
  [60, 12, 5, 2050],
];
