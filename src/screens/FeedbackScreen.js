import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import { submitFeedback } from '../services/feedbackService';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

const feedbackTypes = [
  { value: 'general', label: 'Chung' },
  { value: 'bug', label: 'Báo lỗi' },
  { value: 'feature', label: 'Đề xuất' },
  { value: 'safety', label: 'An toàn' },
];

export default function FeedbackScreen({ navigation }) {
  const [type, setType] = useState('general');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      await submitFeedback({ type, title, message });
      setTitle('');
      setMessage('');
      setNotice('Đã gửi góp ý. Cảm ơn bạn đã giúp Orbit tốt hơn.');
    } catch (caughtError) {
      setError(getVietnameseErrorMessage(caughtError.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Gửi góp ý</Text>
        <Text style={styles.subtitle}>Báo lỗi, đề xuất tính năng hoặc gửi phản hồi về trải nghiệm dùng Orbit.</Text>

        <GlassCard style={styles.card}>
          <Text style={styles.label}>Loại góp ý</Text>
          <View style={styles.chips}>
            {feedbackTypes.map((item) => {
              const active = item.value === type;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setType(item.value)}
                  style={[styles.chip, active && styles.activeChip]}
                >
                  <Text style={[styles.chipText, active && styles.activeChipText]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Tiêu đề</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Không nhận được tin nhắn"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Nội dung</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Mô tả chi tiết để team xử lý nhanh hơn"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textarea]}
            multiline
            textAlignVertical="top"
          />

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <OrbitButton title="Quay lại" variant="ghost" onPress={() => navigation.goBack()} style={styles.actionButton} />
            <OrbitButton
              title={loading ? 'Đang gửi...' : 'Gửi góp ý'}
              onPress={handleSubmit}
              disabled={loading}
              style={styles.actionButton}
            />
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  label: {
    color: colors.text,
    fontWeight: '900',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.backgroundSoft,
  },
  activeChip: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activeChipText: {
    color: colors.accent,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.backgroundSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  textarea: {
    minHeight: 150,
  },
  notice: {
    color: colors.accent,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexGrow: 1,
  },
});
