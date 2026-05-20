import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';

export default function StatusBadge({ isOnline, label }) {
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: isOnline ? colors.online : colors.offline }]} />
      <Text style={styles.text}>{label || (isOnline ? 'Online' : 'Offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
