export const COLORS = {
  // Brand Core (PaliTrento Forest Green + Warm Amber Gold)
  primary: '#1B4329',
  primaryMid: '#235636',
  primaryDark: '#112B1A',
  primarySoft: '#EAF3ED',
  amber: '#F0A030',
  amberDark: '#C87D18',
  amberLight: '#FFF5E5',

  // Modern 2026 Neutral Surfaces
  bg: '#F7F6F2',
  card: '#FFFFFF',
  mutedBg: '#EFECE5',
  line: '#E8E4DC',
  lineSubtle: '#F0EDE6',
  ink: '#141D17',
  inkSecondary: '#3E4B42',
  muted: '#6E7A72',

  // Semantic Status
  ok: '#15803D',
  okBg: '#E7F8EE',
  warn: '#B45309',
  warnBg: '#FEF3C7',
  bad: '#DC2626',
  badBg: '#FEE2E2',
  info: '#0284C7',
  infoBg: '#E0F2FE',
  white: '#FFFFFF',
} as const;

export const FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

// Subtle modern shadows (paired with 1px hairline border instead of heavy 2016 elevation)
export const SHADOW = {
  card: {
    shadowColor: '#112B1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  floating: {
    shadowColor: '#112B1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
} as const;

export const CATEGORY_VISUALS: Record<
  string,
  { icon: string; bg: string; color: string; shortLabel: string }
> = {
  SARI_SARI: { icon: 'storefront', bg: '#E8F5EE', color: '#1B4329', shortLabel: 'Sari-sari' },
  CARINDERIA: { icon: 'restaurant', bg: '#FFF2E0', color: '#D97706', shortLabel: 'Eateries' },
  FRESH_PRODUCE: { icon: 'leaf', bg: '#ECFCCB', color: '#4D7C0F', shortLabel: 'Fresh' },
  PHARMACY: { icon: 'medkit', bg: '#FFE8EC', color: '#E11D48', shortLabel: 'Pharmacy' },
  CLOTHING: { icon: 'shirt', bg: '#E0E7FF', color: '#4338CA', shortLabel: 'Clothing' },
  SERVICES: { icon: 'construct', bg: '#E0F2FE', color: '#0284C7', shortLabel: 'Services' },
  PRODUCT: { icon: 'bag-handle', bg: '#F3E8FF', color: '#7C3AED', shortLabel: 'Goods' },
  AGRI: { icon: 'nutrition', bg: '#FEF3C7', color: '#B45309', shortLabel: 'Agri' },
};
