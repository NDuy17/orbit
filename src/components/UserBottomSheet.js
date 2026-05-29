import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { formatDistance } from '../utils/distance';
import { formatLastActive } from '../utils/formatTime';
import GlassCard from './GlassCard';
import OrbitButton from './OrbitButton';
import StatusBadge from './StatusBadge';
import UserAvatar from './UserAvatar';

export default function UserBottomSheet({
  user,
  onClose,
  onProfile,
  onFriendAction,
  onDirections,
  onReport,
  isDirectionsActive = false,
  isFriendActionLoading = false,
  actionNotice,
}) {
  if (!user) {
    return null;
  }

  const friendshipStatus = user.friendshipStatus || (user.isFriend ? 'friends' : 'none');
  const friendActionTitle = {
    friends: 'Nhắn tin',
    pending_sent: 'Đã gửi lời mời',
    pending_received: 'Chấp nhận lời mời',
    none: 'Kết bạn',
  }[friendshipStatus];
  const friendActionDisabled = isFriendActionLoading || friendshipStatus === 'pending_sent';

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Pressable style={styles.sheetWrap} onPress={(event) => event.stopPropagation?.()}>
        <GlassCard style={styles.sheet}>
          <Pressable onPress={onClose} style={styles.handle} />
          <View style={styles.header}>
            <UserAvatar uri={user.avatar} size={70} style={styles.avatar} />
            <View style={styles.info}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.status}>{user.status}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.distance}>{formatDistance(user.distance)}</Text>
                <StatusBadge isOnline={user.isOnline} label={formatLastActive(user)} />
              </View>
            </View>
          </View>
          <Text style={styles.bio}>{user.bio}</Text>
          {actionNotice ? <Text style={styles.notice}>{actionNotice}</Text> : null}
          <View style={styles.actions}>
            <OrbitButton
              title={isFriendActionLoading ? 'Đang xử lý...' : friendActionTitle}
              onPress={onFriendAction}
              disabled={friendActionDisabled}
              style={styles.actionButton}
            />
            <OrbitButton
              title={isDirectionsActive ? 'Xem chỉ đường' : 'Dẫn đường'}
              variant="ghost"
              onPress={onDirections}
              style={styles.actionButton}
            />
            <OrbitButton title="Xem hồ sơ" variant="ghost" onPress={onProfile} style={styles.actionButton} />
            <OrbitButton title="Báo cáo" variant="ghost" onPress={onReport} style={styles.actionButton} />
          </View>
        </GlassCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    alignSelf: 'stretch',
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
  notice: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
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
