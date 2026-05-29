import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import { submitUserReport } from '../services/reportService';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

const reportReasons = [
  'Spam hoặc lừa đảo',
  'Quấy rối',
  'Nội dung không phù hợp',
  'Giả mạo',
  'Vấn đề an toàn vị trí',
  'Khác',
];

export default function ReportUserScreen({ navigation, route }) {
  const targetUserId = route?.params?.userId;
  const targetName = route?.params?.userName || 'người dùng này';
  const [reason, setReason] = useState(reportReasons[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');

    try {
      await submitUserReport({ targetUserId, reason, description });
      navigation.goBack();
    } catch (caughtError) {
      setError(getVietnameseErrorMessage(caughtError.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Báo cáo người dùng</Text>
        <Text style={styles.subtitle}>Báo cáo {targetName} để đội ngũ Orbit kiểm duyệt.</Text>

        <GlassCard style={styles.card}>
          <Text style={styles.label}>Lý do</Text>
          <View style={styles.reasons}>
            {reportReasons.map((item) => {
              const active = item === reason;
              return (
                <Pressable
                  key={item}
                  onPress={() => setReason(item)}
                  style={[styles.reasonItem, active && styles.activeReason]}
                >
                  <Text style={[styles.reasonText, active && styles.activeReasonText]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Mô tả thêm</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Thêm chi tiết nếu cần"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textarea]}
            multiline
            textAlignVertical="top"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <OrbitButton title="Hủy" variant="ghost" onPress={() => navigation.goBack()} style={styles.actionButton} />
            <OrbitButton
              title={loading ? 'Đang gửi...' : 'Gửi báo cáo'}
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
  reasons: {
    gap: spacing.sm,
  },
  reasonItem: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.backgroundSoft,
  },
  activeReason: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  reasonText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activeReasonText: {
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
