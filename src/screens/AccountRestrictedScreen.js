import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function AccountRestrictedScreen({ navigation }) {
  const accountRestriction = useUserStore((state) => state.accountRestriction);
  const clearAccountRestriction = useUserStore(
    (state) => state.clearAccountRestriction
  );
  const logoutUser = useUserStore((state) => state.logoutUser);

  async function handleUseAnotherAccount() {
    await logoutUser();
    clearAccountRestriction();
    navigation.replace('Login');
  }

  return (
    <SafeAreaView style={styles.container}>
      <GlassCard style={styles.card}>
        <Text style={styles.title}>
          {accountRestriction?.title || 'Tài khoản bị giới hạn'}
        </Text>
        <Text style={styles.message}>
          {accountRestriction?.message ||
            'Tài khoản này chưa thể dùng Orbit lúc này.'}
        </Text>
        <OrbitButton
          title="Đăng nhập tài khoản khác"
          onPress={handleUseAnotherAccount}
        />
      </GlassCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    gap: spacing.lg,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  message: {
    color: colors.muted,
    lineHeight: 22,
  },
});
