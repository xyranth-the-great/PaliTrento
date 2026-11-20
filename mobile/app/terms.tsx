import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ScreenHeader } from '../components/ui';
import { COLORS, FONTS, RADIUS } from '../lib/theme';

const terms: { intro: string; sections: { title: string; body: string }[] } = require('../assets/terms.json');

export default function TermsScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader title="Terms and Agreement" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}>
        <Text style={styles.intro}>{terms.intro}</Text>
        {terms.sections.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  intro: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.ink, backgroundColor: COLORS.amberLight, padding: 12, borderRadius: RADIUS.md, lineHeight: 19 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 14, gap: 6 },
  title: { fontSize: 14.5, fontFamily: FONTS.extrabold, color: COLORS.ink },
  body: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.inkSecondary, lineHeight: 20 },
});
