import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { formatDistance } from '../utils/distance';
import OrbitButton from './OrbitButton';
import StatusBadge from './StatusBadge';
import UserAvatar from './UserAvatar';

export default function UserListItem({ user, onChat, onAddFriend, showFriendButton = true }) {
  const canAddFriend = showFriendButton && !user.isFriend;

  return (
    <View style={styles.item}>
      <UserAvatar uri={user.avatar} size={54} style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.distance}>{formatDistance(user.distance)}</Text>
        </View>
        <Text style={styles.status} numberOfLines={1}>
          {user.status}
        </Text>
        <StatusBadge isOnline={user.isOnline} label={user.isOnline ? 'Đang online' : user.lastActive} />
      </View>
      <View style={styles.actions}>
        {canAddFriend ? (
          <OrbitButton title="Kết bạn" variant="ghost" onPress={onAddFriend} style={styles.smallButton} />
        ) : null}
        <OrbitButton title="Chat" onPress={onChat} style={styles.smallButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  avatar: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  distance: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  status: {
    color: colors.muted,
    fontSize: 13,
  },
  actions: {
    gap: spacing.sm,
    justifyContent: 'center',
  },
  smallButton: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
  },
});
