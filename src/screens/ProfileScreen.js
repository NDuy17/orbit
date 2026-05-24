import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import UserAvatar from '../components/UserAvatar';
import { fetchProfileById } from '../services/profileService.js';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { formatLastActive } from '../utils/formatTime';

export default function ProfileScreen({ navigation, route }) {
  const userId = route?.params?.userId;
  const {
    currentUser,
    users,
    friends,
    pendingRequests,
    sentRequests,
    backendLoading,
    friendActionLoading,
    error,
    loadCurrentProfile,
    refreshFriendData,
    logoutUser,
    requestFriend,
    acceptRequestForUser,
    removeFriendForUser,
  } = useUserStore();
  const [viewProfile, setViewProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const isOwnProfile = !userId || userId === currentUser.id;
  const localProfile = useMemo(
    () => [...users, ...friends].find((item) => item.id === userId),
    [friends, userId, users]
  );
  const profile = useMemo(
    () =>
      isOwnProfile
        ? { ...currentUser, friends: friends.length || currentUser.friends || 0 }
        : viewProfile || localProfile,
    [currentUser, friends.length, isOwnProfile, localProfile, viewProfile]
  );
  const friendshipStatus = useMemo(() => {
    if (isOwnProfile || !userId) {
      return 'self';
    }

    if (friends.some((friend) => friend.id === userId)) {
      return 'friends';
    }

    if (pendingRequests.some((request) => request.sender_id === userId)) {
      return 'pending_received';
    }

    if (sentRequests.some((request) => request.receiver_id === userId)) {
      return 'pending_sent';
    }

    return 'none';
  }, [friends, isOwnProfile, pendingRequests, sentRequests, userId]);
  const actionLoading = Boolean(friendActionLoading[userId]);
  const mutualFriendCount = useMemo(() => {
    if (isOwnProfile || !profile) {
      return 0;
    }

    const profileFriendIds = new Set((profile.friendIds || profile.friends_ids || []).filter(Boolean));
    return profileFriendIds.size ? friends.filter((friend) => profileFriendIds.has(friend.id)).length : 0;
  }, [friends, isOwnProfile, profile]);

  useEffect(() => {
    if (isOwnProfile) {
      loadCurrentProfile();
      refreshFriendData();
      return undefined;
    }

    let active = true;

    async function loadOtherProfile() {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const data = await fetchProfileById(userId);
        if (active) {
          setViewProfile(data);
        }
      } catch {
        if (active) {
          setProfileError('Không tải được hồ sơ này.');
        }
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    loadOtherProfile();

    return () => {
      active = false;
    };
  }, [isOwnProfile, loadCurrentProfile, refreshFriendData, userId]);

  async function handleLogout() {
    await logoutUser();
    navigation.replace('Login');
  }

  function handleEditProfile() {
    navigation.navigate('EditProfile');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hồ sơ</Text>
        {isOwnProfile ? (
          <Pressable onPress={() => navigation.navigate('Privacy')}>
            <Text style={styles.privacy}>Riêng tư</Text>
          </Pressable>
        ) : null}
      </View>
      {backendLoading || profileLoading ? <Text style={styles.notice}>Đang tải hồ sơ...</Text> : null}
      {error || profileError ? <Text style={styles.error}>{profileError || error}</Text> : null}
      <GlassCard style={styles.profile}>
        <UserAvatar uri={profile?.avatar} size={112} style={styles.avatar} />
        <Text style={styles.name}>{profile?.name || 'Người dùng Orbit'}</Text>
        <Text style={styles.bio}>{profile?.bio || profile?.status || 'Đang dùng Orbit'}</Text>
        <Text style={styles.status}>{formatLastActive(profile)}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile?.friends || 0}</Text>
            <Text style={styles.statLabel}>Bạn bè</Text>
          </View>
          {!isOwnProfile ? (
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{mutualFriendCount}</Text>
              <Text style={styles.statLabel}>Bạn chung</Text>
            </View>
          ) : null}
        </View>
        {isOwnProfile ? (
          <View style={styles.actionRow}>
            <OrbitButton title="Chỉnh sửa hồ sơ" variant="ghost" onPress={handleEditProfile} style={styles.actionButton} />
            <OrbitButton title="Cài đặt" variant="ghost" onPress={() => navigation.navigate('Settings')} style={styles.actionButton} />
            <OrbitButton title="Đăng xuất" variant="ghost" onPress={handleLogout} style={styles.actionButton} />
          </View>
        ) : (
          <View style={styles.actionRow}>
            <OrbitButton title="Nhắn tin" onPress={() => navigation.navigate('Chat', { userId })} style={styles.actionButton} />
            {friendshipStatus === 'friends' ? (
              <OrbitButton
                title={actionLoading ? 'Đang xóa...' : 'Xóa bạn bè'}
                variant="ghost"
                disabled={actionLoading}
                onPress={() => removeFriendForUser(userId)}
                style={styles.actionButton}
              />
            ) : null}
            {friendshipStatus === 'pending_received' ? (
              <OrbitButton
                title={actionLoading ? 'Đang xử lý...' : 'Chấp nhận kết bạn'}
                disabled={actionLoading}
                onPress={() => acceptRequestForUser(userId)}
                style={styles.actionButton}
              />
            ) : null}
            {friendshipStatus === 'none' ? (
              <OrbitButton
                title={actionLoading ? 'Đang gửi...' : 'Kết bạn'}
                variant="ghost"
                disabled={actionLoading}
                onPress={() => requestFriend(userId)}
                style={styles.actionButton}
              />
            ) : null}
            {friendshipStatus === 'pending_sent' ? (
              <Text style={styles.pendingText}>Đã gửi lời mời kết bạn</Text>
            ) : null}
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  privacy: {
    color: colors.accent,
    fontWeight: '800',
  },
  notice: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  profile: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    borderWidth: 3,
    borderColor: colors.accent,
  },
  name: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  bio: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  status: {
    color: colors.accent,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.backgroundSoft,
  },
  statNumber: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    minWidth: 132,
  },
  pendingText: {
    color: colors.accent,
    fontWeight: '800',
    textAlign: 'center',
  },
});
