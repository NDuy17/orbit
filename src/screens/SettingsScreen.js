import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors, { themePalettes } from '../theme/colors';
import useThemeStore from '../store/themeStore';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

const themeOptions = [
  { key: 'dark', title: 'Nền tối', description: 'Tông tối tập trung, hợp dùng ban đêm.' },
  { key: 'light', title: 'Nền sáng', description: 'Màu sáng vui mắt, dễ nhìn ngoài trời.' },
];

export default function SettingsScreen() {
  const { themeName, setThemeName } = useThemeStore();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Cài đặt</Text>
      <Text style={styles.sectionTitle}>Giao diện</Text>
      <View style={styles.options}>
        {themeOptions.map((item) => {
          const palette = themePalettes[item.key];
          const active = themeName === item.key;

          return (
            <Pressable
              key={item.key}
              onPress={() => setThemeName(item.key)}
              style={({ pressed }) => [
                styles.option,
                active && styles.activeOption,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.swatches}>
                <View style={[styles.swatch, { backgroundColor: palette.background }]} />
                <View style={[styles.swatch, { backgroundColor: palette.primary }]} />
                <View style={[styles.swatch, { backgroundColor: palette.accent }]} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{item.title}</Text>
                <Text style={styles.optionText}>{item.description}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]} />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activeOption: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  swatches: {
    flexDirection: 'row',
  },
  swatch: {
    width: 24,
    height: 42,
    borderRadius: 12,
    marginLeft: -6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  optionText: {
    color: colors.muted,
    marginTop: 4,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  radioActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
