import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function OnboardingScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.iconWrap}>
        <View style={styles.orbitRing} />
        <View style={styles.orbitRingSmall} />
        <View style={styles.planet} />
      </View>
      <Text style={styles.name}>Orbit</Text>
      <Text style={styles.tagline}>Bản đồ kết nối quanh bạn</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  orbitRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    transform: [{ rotate: '-18deg' }],
  },
  orbitRingSmall: {
    position: 'absolute',
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.75)',
    transform: [{ rotate: '22deg' }],
  },
  planet: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    ...Platform.select({
      web: {
        boxShadow: '0 0 34px rgba(34, 211, 238, 0.78)',
      },
      default: {
        shadowColor: colors.accent,
        shadowOpacity: 1,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 28,
      },
    }),
  },
  name: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  tagline: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
