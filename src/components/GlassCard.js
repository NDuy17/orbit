import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import colors from '../theme/colors';
import spacing from '../theme/spacing';

export default function GlassCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 22,
    padding: spacing.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 28px rgba(34, 211, 238, 0.12)',
      },
      default: {
        shadowColor: colors.accent,
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
});
