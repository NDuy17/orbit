import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import UserAvatar from '../components/UserAvatar';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function EditProfileScreen({ navigation }) {
  const { currentUser, backendLoading, error, saveCurrentProfile } = useUserStore();
  const [name, setName] = useState(currentUser?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || currentUser?.avatar || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [localError, setLocalError] = useState(null);

  async function handlePickAvatar() {
    setLocalError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLocalError('Bạn cần cho phép Orbit mở thư viện ảnh để chọn ảnh đại diện.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    setAvatarUrl(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
  }

  async function handleSave() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setLocalError('Tên hiển thị không được để trống.');
      return;
    }

    setLocalError(null);
    try {
      await saveCurrentProfile({
        name: trimmedName,
        avatar_url: avatarUrl.trim() || null,
        bio: bio.trim(),
        status: bio.trim() || currentUser?.status || '',
      });
      navigation.goBack();
    } catch {
      setLocalError('Không lưu được hồ sơ. Hãy thử lại.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Chỉnh sửa hồ sơ</Text>
          <GlassCard style={styles.card}>
            <UserAvatar uri={avatarUrl || currentUser?.avatar} size={104} style={styles.avatar} />
            <View style={styles.avatarActions}>
              <OrbitButton title="Chọn & chỉnh sửa ảnh" variant="ghost" onPress={handlePickAvatar} />
            </View>

            <Text style={styles.label}>Tên hiển thị</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Người dùng Orbit"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Text style={styles.label}>Giới thiệu</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Viết vài dòng về bạn"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.bioInput]}
            />

            {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}

            <OrbitButton title={backendLoading ? 'Đang lưu...' : 'Lưu'} onPress={handleSave} disabled={backendLoading} />
            <OrbitButton title="Hủy" variant="ghost" onPress={() => navigation.goBack()} disabled={backendLoading} />
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  avatar: {
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: colors.accent,
    marginBottom: spacing.sm,
  },
  avatarActions: {
    alignItems: 'center',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.backgroundSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  bioInput: {
    minHeight: 104,
  },
  error: {
    color: colors.danger,
    lineHeight: 20,
  },
});
