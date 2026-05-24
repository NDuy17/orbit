import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { formatDistance } from '../utils/distance';
import { blurActiveWebElement } from '../utils/focus';
import { formatLastActive } from '../utils/formatTime';
import OrbitButton from './OrbitButton';
import StatusBadge from './StatusBadge';
import UserAvatar from './UserAvatar';

export default function UserListItem({
  user,
  onChat,
  onAddFriend,
  onAcceptFriend,
  onPress,
  showFriendButton = true,
  showChatButton = true,
  loading = false,
}) {
  const friendshipStatus = user.friendshipStatus || (user.isFriend ? 'friends' : 'none');
  const actionTitle = {
    friends: 'Chat',
    pending_sent: 'Đã gửi',
    pending_received: 'Chấp nhận',
    none: 'Kết bạn',
  }[friendshipStatus];

  function handleAction() {
    if (friendshipStatus === 'friends') {
      onChat?.();
      return;
    }

    if (friendshipStatus === 'pending_received') {
      onAcceptFriend?.();
      return;
    }

    if (friendshipStatus === 'none') {
      onAddFriend?.();
    }
  }

  function handlePress(event) {
    blurActiveWebElement();
    onPress?.(event);
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <UserAvatar uri={user.avatar} size={54} style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.distance}>{formatDistance(user.distance)}</Text>
        </View>
        <Text style={styles.status} numberOfLines={1}>
          {user.status}
        </Text>
        <StatusBadge isOnline={user.isOnline} label={formatLastActive(user)} />
      </View>
      <View style={styles.actions}>
        {showFriendButton ? (
          <OrbitButton
            title={loading ? '...' : actionTitle}
            variant={friendshipStatus === 'friends' ? 'primary' : 'ghost'}
            onPress={handleAction}
            disabled={loading || friendshipStatus === 'pending_sent'}
            style={styles.smallButton}
          />
        ) : null}
        {showChatButton && (friendshipStatus !== 'friends' || !showFriendButton) ? (
          <OrbitButton title="Chat" onPress={onChat} style={styles.smallButton} />
        ) : null}
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
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
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
  },
});
