import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import colors from '../theme/colors';

// Giữ component này để có thể dùng lại nếu sau này cần marker native riêng.
export default function AvatarMarker({ user }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.orbit, user.isOnline && styles.onlineOrbit]} />
      <Image source={{ uri: user.avatar }} style={styles.avatar} />
      <View style={[styles.dot, { backgroundColor: user.isOnline ? colors.online : colors.offline }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  onlineOrbit: {
    borderColor: colors.accent,
    ...Platform.select({
      web: {
        boxShadow: '0 0 18px rgba(34, 211, 238, 0.7)',
      },
      default: {
        shadowColor: colors.accent,
        shadowOpacity: 0.9,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 12,
      },
    }),
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: colors.text,
  },
  dot: {
    position: 'absolute',
    right: 6,
    bottom: 7,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
