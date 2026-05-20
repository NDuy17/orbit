import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { formatDistance } from '../utils/distance';
import GlassCard from './GlassCard';
import OrbitButton from './OrbitButton';
import StatusBadge from './StatusBadge';

export default function UserBottomSheet({ user, onClose, onChat, onProfile, onAddFriend }) {
  if (!user) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <GlassCard style={styles.sheet}>
        <Pressable onPress={onClose} style={styles.handle} />
        <View style={styles.header}>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.status}>{user.status}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.distance}>{formatDistance(user.distance)}</Text>
              <StatusBadge isOnline={user.isOnline} label={user.isOnline ? 'Online' : 'Offline'} />
            </View>
          </View>
        </View>
        <Text style={styles.bio}>{user.bio}</Text>
        <View style={styles.actions}>
          <OrbitButton title="Nhắn tin" onPress={onChat} style={styles.actionButton} />
          <OrbitButton
            title={user.isFriend ? 'Đã là bạn' : 'Kết bạn'}
            variant="ghost"
            onPress={onAddFriend}
            disabled={user.isFriend}
            style={styles.actionButton}
          />
          <OrbitButton title="Xem hồ sơ" variant="ghost" onPress={onProfile} style={styles.actionButton} />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  sheet: {
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.line,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  status: {
    color: colors.muted,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  distance: {
    color: colors.accent,
    fontWeight: '800',
  },
  bio: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flexGrow: 1,
    minHeight: 42,
  },
});
