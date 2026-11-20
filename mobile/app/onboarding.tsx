import React, { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LogoMark } from '../components/LogoMark';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

const SLIDES = [
  {
    key: 'stores',
    eyebrow: 'DISCOVER LOCAL',
    icon: 'compass' as const,
    grad: ['#153823', '#245B39'] as [string, string],
    halo: 'rgba(27,67,41,0.08)',
    title: 'Find every store\naround Trento',
    text: 'Sari-sari stores, eateries, pharmacies, and agri shops — verified and mapped in one modern app.',
  },
  {
    key: 'prices',
    eyebrow: 'BANTAY PRESYO',
    icon: 'pricetag' as const,
    grad: ['#C97B14', '#F0A030'] as [string, string],
    halo: 'rgba(240,160,48,0.12)',
    title: "Check today's\nfair prices first",
    text: 'Compare real store prices against official municipal LGU caps before you head out.',
  },
  {
    key: 'chat',
    eyebrow: 'FAST PICKUP',
    icon: 'bag-check' as const,
    grad: ['#153823', '#245B39'] as [string, string],
    halo: 'rgba(27,67,41,0.08)',
    title: 'Reserve & chat\nwith local sellers',
    text: 'Hold products for pickup and message Trento store owners directly in real time.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < SLIDES.length) {
      setIndex(next);
    }
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      setIndex(next);
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    } else {
      router.push('/permissions');
    }
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logoChip}>
            <LogoMark size={18} />
          </View>
          <Text style={styles.brandText}>
            Pali<Text style={{ color: COLORS.amber }}>Trento</Text>
          </Text>
        </View>
        {!isLast ? (
          <Pressable onPress={() => router.push('/permissions')} style={styles.skipPill}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.haloOuter, { backgroundColor: item.halo }]}>
              <View style={[styles.haloInner, { backgroundColor: item.halo }]}>
                <LinearGradient
                  colors={item.grad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconBox}
                >
                  <Ionicons name={item.icon} size={38} color={COLORS.white} />
                </LinearGradient>
              </View>
            </View>
            <Text style={styles.eyebrow}>{item.eyebrow}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.primaryBtnText}>{isLast ? 'Get started' : 'Continue'}</Text>
          <View style={styles.btnIcon}>
            <Ionicons
              name={isLast ? 'arrow-forward' : 'chevron-forward'}
              size={16}
              color={COLORS.primary}
            />
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoChip: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 16,
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryDark,
    letterSpacing: -0.3,
  },
  skipPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.mutedBg,
  },
  skip: { fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.inkSecondary },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  haloOuter: {
    width: 178,
    height: 178,
    borderRadius: 89,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  haloInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 86,
    height: 86,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
    ...SHADOW.floating,
  },
  eyebrow: {
    fontSize: 10.5,
    fontFamily: FONTS.extrabold,
    letterSpacing: 1.5,
    color: COLORS.amberDark,
    marginBottom: 8,
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    textAlign: 'center',
    maxWidth: 290,
  },
  footer: { paddingHorizontal: 22, paddingBottom: 22, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.line },
  dotActive: { width: 26, backgroundColor: COLORS.primary },
  primaryBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
    ...SHADOW.floating,
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontFamily: FONTS.bold },
  btnIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FBC14E',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
