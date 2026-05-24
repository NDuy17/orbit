import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { blurActiveWebElement } from '../utils/focus';

export default function OrbitButton({ title, onPress, variant = 'primary', style, disabled = false }) {
  const isGhost = variant === 'ghost';

  function handlePress(event) {
    blurActiveWebElement();
    onPress?.(event);
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        isGhost ? styles.ghostButton : styles.primaryButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, isGhost && styles.ghostText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 18px rgba(124, 58, 237, 0.28)',
      },
      default: {
        shadowColor: colors.primary,
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 5,
      },
    }),
  },
  ghostButton: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  ghostText: {
    color: colors.accent,
  },
});
