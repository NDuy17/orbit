import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import useLocationStore from '../store/locationStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

const radiusOptions = [100, 500, 1000];

export default function PrivacyScreen() {
  const {
    ghostMode,
    approximateLocation,
    radius,
    toggleGhostMode,
    toggleApproximateLocation,
    setRadius,
  } = useLocationStore();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Quyền riêng tư</Text>
      <Text style={styles.subtitle}>
        Bạn có thể kiểm soát mức độ hiển thị vị trí. Orbit nên giúp kết nối, không tạo cảm giác bị theo dõi.
      </Text>
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Chế độ ẩn danh</Text>
            <Text style={styles.hint}>Tạm thời không xuất hiện trên bản đồ.</Text>
          </View>
          <Switch value={ghostMode} onValueChange={toggleGhostMode} thumbColor={colors.text} />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Vị trí gần đúng</Text>
            <Text style={styles.hint}>Hiển thị trong một vùng thay vì điểm chính xác.</Text>
          </View>
          <Switch
            value={approximateLocation}
            onValueChange={toggleApproximateLocation}
            thumbColor={colors.text}
          />
        </View>
        <Text style={styles.sectionTitle}>Bán kính hiển thị</Text>
        <View style={styles.radiusRow}>
          {radiusOptions.map((item) => (
            <Pressable
              key={item}
              onPress={() => setRadius(item)}
              style={[styles.radiusChip, radius === item && styles.activeRadius]}
            >
              <Text style={[styles.radiusText, radius === item && styles.activeRadiusText]}>
                {item === 1000 ? '1km' : `${item}m`}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.xl,
  },
  card: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    color: colors.muted,
    marginTop: 4,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  radiusChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activeRadius: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  radiusText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activeRadiusText: {
    color: colors.text,
  },
});
