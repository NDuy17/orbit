import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function LoginScreen({ navigation }) {
  const { login, authLoading, error, clearError } = useUserStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  function clearMessages() {
    setLocalError('');
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
            placeholder="Mật khẩu của bạn"
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
    marginBottom: spacing.sm,
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
});
