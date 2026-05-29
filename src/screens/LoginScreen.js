import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function LoginScreen({ navigation, route }) {
  const { login, authLoading, error, clearError } = useUserStore();
  const [email, setEmail] = useState(route?.params?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [notice, setNotice] = useState(route?.params?.notice || '');

  function clearMessages() {
    setLocalError('');
    setNotice('');
    clearError();
  }

  async function handleLogin() {
    if (authLoading) {
      return;
    }

    clearMessages();

    if (!email.trim()) {
      setLocalError('Bạn cần nhập email.');
      return;
    }

    if (!password) {
      setLocalError('Bạn cần nhập mật khẩu.');
      return;
    }

    const success = await login(email.trim(), password);
    if (success) {
      navigation.replace('MainTabs');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Đăng nhập</Text>
      <Text style={styles.subtitle}>Vào Orbit để xem ai đang ở gần bạn.</Text>
      <GlassCard style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearMessages();
          }}
        />
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Mật khẩu"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearMessages();
            }}
          />
          <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.showButton}>
            <Text style={styles.showText}>{showPassword ? 'Ẩn' : 'Hiện'}</Text>
          </Pressable>
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}
        <OrbitButton
          title={authLoading ? 'Đang vào...' : 'Đăng nhập'}
          onPress={handleLogin}
          disabled={authLoading}
        />
        <OrbitButton
          title="Chưa có tài khoản? Đăng ký"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
        />
      </GlassCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  passwordRow: {
    minHeight: 52,
    borderRadius: 16,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  passwordInput: {
    flex: 1,
    minHeight: 52,
    color: colors.text,
  },
  showButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  showText: {
    color: colors.accent,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  notice: {
    color: colors.online,
    fontSize: 13,
    fontWeight: '700',
  },
});
