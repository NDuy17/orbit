import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OrbitButton from '../components/OrbitButton';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

const valueCards = [
  {
    id: 'map',
    title: 'Bản đồ sống',
    text: 'Nhìn thấy bạn bè và người gần bạn theo thời gian thực.',
  },
  {
    id: 'safe',
    title: 'Kết nối an toàn',
    text: 'Gửi lời mời, trò chuyện và gặp nhau khi cả hai cùng muốn.',
  },
  {
    id: 'privacy',
    title: 'Riêng tư chủ động',
    text: 'Ẩn vị trí, làm mờ tọa độ hoặc giới hạn bán kính hiển thị.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => navigation.replace('Login'), 5000);

    return () => clearTimeout(timerRef.current);
  }, [navigation]);

  function clearAutoRedirect() {
    clearTimeout(timerRef.current);
  }

  function handleStart() {
    clearAutoRedirect();
    navigation.replace('Login');
  }

  function handleRegister() {
    clearAutoRedirect();
    navigation.navigate('Register');
  }

  function handleLogin() {
    clearAutoRedirect();
    navigation.replace('Login');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <View style={styles.orbitRing} />
          <View style={styles.orbitRingSmall} />
          <View style={styles.planet} />
        </View>
        <Text style={styles.name}>Orbit</Text>
        <Text style={styles.headline}>Những người gần bạn, hiện lên như một quỹ đạo.</Text>
        <Text style={styles.tagline}>Mở bản đồ, khám phá ai đang ở gần và kết nối khi đúng khoảnh khắc.</Text>
        <OrbitButton title="Bắt đầu →" onPress={handleStart} style={styles.heroButton} />
      </View>

      <View style={styles.cards}>
        {valueCards.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={handleRegister}>
          <Text style={styles.primaryText}>Bắt đầu</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleLogin}>
          <Text style={styles.secondaryText}>Đăng nhập</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  iconWrap: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  orbitRing: {
    position: 'absolute',
    width: 158,
    height: 158,
    borderRadius: 79,
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    transform: [{ rotate: '-18deg' }],
  },
  orbitRingSmall: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
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
  headline: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 31,
    marginTop: spacing.lg,
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.md,
  },
  heroButton: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardText: {
    color: colors.muted,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  primaryText: {
    color: colors.text,
    fontWeight: '900',
  },
  secondaryText: {
    color: colors.accent,
    fontWeight: '900',
  },
});
