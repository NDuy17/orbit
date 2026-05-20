import React, { useEffect } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserListItem from '../components/UserListItem';
import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function FriendsScreen({ navigation }) {
  const {
    friends,
    pendingRequests,
    backendLoading,
    error,
    loadFriends,
    loadPendingRequests,
    acceptRequest,
    rejectRequest,
  } = useUserStore();

  useEffect(() => {
    loadFriends();
    loadPendingRequests();
  }, [loadFriends, loadPendingRequests]);

  function renderPendingRequest(request) {
    const sender = request.sender || {};

    return (
      <View style={styles.requestCard}>
        <Image
          source={{ uri: sender.avatar_url || DEFAULT_AVATAR_URL }}
          style={styles.avatar}
        />
        <View style={styles.requestContent}>
          <Text style={styles.requestName}>{sender.name || sender.full_name || 'Người dùng Orbit'}</Text>
          <Text style={styles.requestText}>Muốn kết bạn với bạn</Text>
          <View style={styles.requestActions}>
            <Pressable style={styles.acceptButton} onPress={() => acceptRequest(request.id)}>
              <Text style={styles.acceptText}>Chấp nhận</Text>
            </Pressable>
            <Pressable style={styles.rejectButton} onPress={() => rejectRequest(request.id)}>
              <Text style={styles.rejectText}>Từ chối</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Bạn bè</Text>
      {backendLoading ? <Text style={styles.notice}>Đang tải...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pendingRequests.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lời mời kết bạn</Text>
          {pendingRequests.map((request) => (
            <View key={request.id}>{renderPendingRequest(request)}</View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Danh sách bạn bè</Text>}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có bạn bè</Text>
            <Text style={styles.emptyText}>Vào tab Gần đây hoặc Bản đồ để gửi lời mời kết bạn.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <UserListItem
            user={item}
            showFriendButton={false}
            onChat={() => navigation.navigate('Chat', { userId: item.id })}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
    marginBottom: spacing.lg,
  },
  notice: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  requestCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  requestContent: {
    flex: 1,
  },
  requestName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  requestText: {
    color: colors.muted,
    marginTop: 3,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  acceptButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  rejectButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  acceptText: {
    color: colors.text,
    fontWeight: '800',
  },
  rejectText: {
    color: colors.muted,
    fontWeight: '800',
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  emptyBox: {
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
