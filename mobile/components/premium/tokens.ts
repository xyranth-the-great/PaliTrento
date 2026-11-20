/**
 * Single source of truth for PaliTrento Premium Liquid Chrome tokens,
 * shader parameters, motion limits, geometry, and exact copy.
 *
 * Shader loop constants mirror `C:\Users\kente\Desktop\palitrento2\js\premium-shader-config.js`
 * and `js\liquid-chrome.js`. All prices use the peso sign ₱ (U+20B1).
 */

export const PREMIUM_PALETTE = {
  darkest: '#2c2216',
  mid: '#80684c',
  light: '#cba67a',
  highlight: '#ffe3a5',
  hotLine: '#fff6d8',
} as const;

export const PREMIUM_SHADER_COLORS = {
  deep: [0.1, 0.07, 0.03] as const,
  midBronze: [0.5, 0.39, 0.26] as const,
  lightBronze: [0.76, 0.57, 0.41] as const,
  warmGold: [0.91, 0.66, 0.44] as const,
  rim: [1.26, 1.02, 0.74] as const,
  specularOne: [0.93, 0.99, 0.94] as const,
  specularTwo: [1.09, 0.79, 0.54] as const,
} as const;

export const PREMIUM_TOKENS = {
  edge: '#f2c94c',
  glassBackground: 'rgba(45, 24, 0, 0.66)',
  glassBorder: 'rgba(255, 230, 160, 0.28)',
  glassBackdrop: 'rgba(20, 10, 0, 0.55)',
  glassBorderWidth: 1,
  glassRadius: 14,

  ringGlowColor: 'rgba(255, 190, 60, 0.5)',
  ringGlowShadowColor: '#ffbe3c',
  ringGlowRadius: 19,
  ringGlowOpacity: 0.5,
  ringGlowOffset: { width: 0, height: 0 },
  hoverGlowColor: 'rgba(255, 190, 60, 0.65)',
  hoverGlowRadius: 29,
  hoverGlowOpacity: 0.65,

  textOnChrome: '#ffffff',
  textMutedOnChrome: 'rgba(255, 255, 255, 0.86)',
  textShadowColor: 'rgba(30, 14, 0, 0.85)',
  actionBackground: 'rgba(255, 255, 255, 0.14)',
  actionBorder: 'rgba(255, 220, 140, 0.45)',
  activeDot: '#b7f7c5',
  pillBase: '#6b4408',
  pillTopSheenStart: 'rgba(255, 255, 255, 0.35)',
  pillTopSheenEnd: 'rgba(255, 255, 255, 0)',
  pillDarkScrim: 'rgba(40, 20, 0, 0.36)',
  cardSurface: '#ffffff',

  // Static fallback gradient: linear-gradient(135deg, #3a2000, #b8860b 45%, #ffd45c 75%, #8a5a0b)
  fallbackGradientColors: ['#3a2000', '#b8860b', '#ffd45c', '#8a5a0b'] as const,
  fallbackGradientLocations: [0, 0.45, 0.75, 1] as const,
  fallbackGradientStart: { x: 0, y: 0 } as const,
  fallbackGradientEnd: { x: 1, y: 1 } as const,

  // Layered animated fallback palette (champagne-bronze base + 3 soft diagonal highlights + bright rim)
  layeredBaseColors: ['#80684c', '#4a3824', '#2c2216'] as const,
  layeredBaseLocations: [0, 0.55, 1] as const,
  layeredHighlightOne: [
    'rgba(255, 227, 165, 0)',
    'rgba(255, 227, 165, 0.55)',
    'rgba(203, 166, 122, 0.42)',
    'rgba(255, 227, 165, 0)',
  ] as const,
  layeredHighlightTwo: [
    'rgba(203, 166, 122, 0)',
    'rgba(203, 166, 122, 0.48)',
    'rgba(255, 227, 165, 0.40)',
    'rgba(44, 34, 22, 0)',
  ] as const,
  layeredHighlightThree: [
    'rgba(255, 227, 165, 0)',
    'rgba(255, 227, 165, 0.38)',
    'rgba(203, 166, 122, 0.52)',
    'rgba(255, 227, 165, 0)',
  ] as const,
  layeredRimColors: [
    'rgba(255, 227, 165, 0)',
    'rgba(242, 201, 76, 0.65)',
    'rgba(255, 227, 165, 0.85)',
    'rgba(242, 201, 76, 0.45)',
    'rgba(255, 227, 165, 0)',
  ] as const,
  upgradeShineColors: [
    'rgba(255, 255, 255, 0)',
    'rgba(255, 255, 255, 0.55)',
    'rgba(255, 255, 255, 0)',
  ] as const,
} as const;

/** High-contrast liquid chrome band recipe (dark bronze / cream-gold / hot line). */
export const PREMIUM_LIQUID = {
  bandColors: [
    '#80684c',
    '#2c2216',
    '#cba67a',
    '#ffe3a5',
    '#fff6d8',
    '#ffe3a5',
    '#cba67a',
    '#2c2216',
    '#5a4630',
    '#80684c',
  ] as const,
  bandLocations: [0, 0.12, 0.26, 0.38, 0.42, 0.46, 0.6, 0.74, 0.88, 1] as const,
  layerWidthFactor: 2,
  layerHeightFactor: 3,
  tileHeightFactor: 1.5,
  layerOneRotate: '25deg',
  layerTwoRotate: '-35deg',
  layerTwoOpacity: 0.35,
  layerTwoDurationFactor: 1.3,
  stillOffsetFactor: 0.3,
  defaultLoopSeconds: 30,
  ringLoopSeconds: 55,
  maxAnimatedInstances: 12,
  rimColor: 'rgba(255,246,216,0.55)',
  rimWidth: 1,
  cardRadius: 20,
  cardInset: 4,
  cardInnerRadius: 16,
  cardShadowColor: '#ffbe3c',
  cardShadowOpacity: 0.5,
  cardShadowRadius: 19,
  cardElevation: 8,
} as const;

export const PREMIUM_GEOMETRY = {
  ringWidth: 4,
  premiumCardRadius: 20,
  freeCardRadius: 12,
  freeCardBorderWidth: 1,
  proSheetRadius: 20,
  bannerRadius: 20,
  pillRadius: 999,
} as const;

export const PREMIUM_MOTION = {
  bannerLoopSeconds: 30.0,
  ringLoopSeconds: 55.0,
  stillTimeSeconds: 1.5,
  chipAngleRad: (0.5 / 30.0) * Math.PI * 2,
  defaultZoom: 3.4,
  ringZoom: 1.0,
  chipZoom: 0.7,
  maxFps: 30,
  frameIntervalMs: 1000 / 30,
  maxAnimatedRings: 12,
  successSplashDurationMs: 2200,
  upgradePulseMs: 3200,
  upgradeShineMs: 5000,
  ringIndexPhaseStep: 0.17,
} as const;

export const PREMIUM_LIMITS = {
  freeListingQuota: 15,
  nearLimitRatio: 0.8,
  monthlyPricePesos: 49,
  featuredWeeklyPricePesos: 10,
  extraListingPricePesos: 1,
} as const;

export const PREMIUM_COPY = {
  cardChip: '✦ Premium',
  headerProPill: 'PRO',
  memberStatusActive: 'Premium Member · Active',
  memberSubtitle: 'Your membership, renewal, and perks at a glance.',
  nextRenewalPrefix: 'Next renewal · ',
  nextRenewalUnavailable: 'Next renewal · not available',
  manageMembership: 'Manage Membership',
  proSheetTitle: 'PaliTrento Premium',
  proSheetBenefitsHeading: 'Your Premium perks',
  freePill: 'Free',
  freePlanTitle: 'Free Plan',
  freeSubtitle: '15 free listings, then ₱1 per additional listing.',
  upgradeCta: 'Upgrade to Premium · ₱49/month',
  upgradeNowCta: 'Upgrade now · ₱49/month',
  renewCta: 'Renew Premium · ₱49/month',
  notNow: 'Not now',
  priceLabel: '₱49',
  pricePeriod: '/ month',
  featureStoreTitle: 'Featured Store Promotions',
  featureStoreCta: 'Feature Store · ₱10/week',
  featureStoreCaption: 'Get your store featured for a week.',
  includedWithPremium: '✦ Included with Premium',
  benefits: [
    'Unlimited product listings',
    'Highlighted product & store cards',
    'Priority placement in search',
    'Your store, automatically featured',
  ] as const,
  upgradeExtraBenefit: 'No additional product listing fees',
  comparisonHeading: 'Free vs Premium',
  comparisonRows: [
    { feature: 'Product listings', free: '15 free, then ₱1 each', premium: 'Unlimited' },
    { feature: 'Additional listing fees', free: '₱1 per extra item', premium: '₱0 (none)' },
    { feature: 'Store & product cards', free: 'Standard', premium: 'Liquid chrome ring' },
    { feature: 'Search placement', free: 'Standard', premium: 'Priority placement' },
    { feature: 'Featured Store', free: '₱10 / week', premium: 'Included automatically' },
  ] as const,
} as const;
