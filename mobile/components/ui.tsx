import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

// ---------------------------------------------------------------------------
// Screen header (light, modern, with back button)
// ---------------------------------------------------------------------------
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[ui.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')))}
        style={({ pressed }) => [ui.backBtn, pressed && { opacity: 0.7 }]}
        hitSlop={8}
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={ui.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={ui.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Opaque strip behind the status bar so scrolling content never collides with it
// ---------------------------------------------------------------------------
export function StatusBarCover() {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: COLORS.bg, zIndex: 10 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Card + section label
// ---------------------------------------------------------------------------
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={ui.sectionLabel}>{children.toUpperCase()}</Text>;
}

// ---------------------------------------------------------------------------
// Form field
// ---------------------------------------------------------------------------
export function Field({
  label,
  hint,
  required,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string; required?: boolean }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={ui.label}>
        {label}
        {required ? <Text style={{ color: COLORS.bad }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={COLORS.muted}
        {...input}
        style={[ui.input, input.multiline && ui.inputMulti, style]}
      />
      {hint ? <Text style={ui.hint}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------
export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable onPress={onPress} style={[ui.chip, active && ui.chipActive]}>
      {icon ? <Ionicons name={icon} size={13} color={active ? COLORS.white : COLORS.primary} /> : null}
      <Text style={[ui.chipText, active && ui.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={ui.chipGroup}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'amber' | 'soft' | 'danger' | 'outline';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const v = BUTTON_VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        ui.btn,
        small && ui.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.88 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 14 : 16} color={v.fg} /> : null}
          <Text style={[ui.btnText, small && ui.btnTextSmall, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const BUTTON_VARIANTS = {
  primary: { bg: COLORS.primary, fg: COLORS.white, border: COLORS.primary },
  amber: { bg: '#FBC14E', fg: COLORS.primaryDark, border: '#FBC14E' },
  soft: { bg: COLORS.primarySoft, fg: COLORS.primary, border: COLORS.primarySoft },
  danger: { bg: COLORS.badBg, fg: COLORS.bad, border: COLORS.badBg },
  outline: { bg: COLORS.card, fg: COLORS.ink, border: COLORS.line },
} as const;

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------
const TONES = {
  ok: { bg: COLORS.okBg, fg: COLORS.ok },
  warn: { bg: COLORS.warnBg, fg: COLORS.warn },
  bad: { bg: COLORS.badBg, fg: COLORS.bad },
  info: { bg: COLORS.infoBg, fg: COLORS.info },
  muted: { bg: COLORS.mutedBg, fg: COLORS.muted },
} as const;

export type Tone = keyof typeof TONES;

export function StatusPill({ label, tone = 'muted' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[ui.pill, { backgroundColor: t.bg }]}>
      <View style={[ui.pillDot, { backgroundColor: t.fg }]} />
      <Text style={[ui.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={ui.empty}>
      <View style={ui.emptyIcon}>
        <Ionicons name={icon} size={28} color={COLORS.primary} />
      </View>
      <Text style={ui.emptyTitle}>{title}</Text>
      {text ? <Text style={ui.emptyText}>{text}</Text> : null}
      {action}
    </View>
  );
}

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  READY_FOR_PICKUP: { label: 'Ready for pickup', tone: 'ok' },
  COMPLETED: { label: 'Completed', tone: 'ok' },
  CANCELLED: { label: 'Cancelled', tone: 'bad' },
  EXPIRED: { label: 'Expired', tone: 'bad' },
};

export const ui = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSubtle,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.ink, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 1 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    ...SHADOW.card,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.9,
    color: COLORS.muted,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  label: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.ink, marginBottom: 6 },
  input: {
    minHeight: 46,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.ink,
  },
  inputMulti: { minHeight: 84, textAlignVertical: 'top' },
  hint: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 5 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  chipTextActive: { color: COLORS.white },
  btn: {
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
  },
  btnSmall: { height: 38, borderRadius: RADIUS.sm, paddingHorizontal: 12 },
  btnText: { fontSize: 14.5, fontFamily: FONTS.bold },
  btnTextSmall: { fontSize: 12.5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10.5, fontFamily: FONTS.bold },
  empty: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 22,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.line,
    gap: 7,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 15.5, fontFamily: FONTS.extrabold, color: COLORS.ink, textAlign: 'center' },
  emptyText: {
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
