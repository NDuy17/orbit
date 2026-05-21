import React, { useCallback, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import UserListItem from '../components/UserListItem';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function FriendsScreen({ navigation }) {
  const {
    friends,
    pendingRequests,
    backendLoading,
    friendActionLoading,
    error,
    isBackendReady,
    refreshFriendData,
    acceptRequest,
    rejectRequest,
  } = useUserStore();
  const lastFetchRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < 30000) {
        return undefined;
      }

      lastFetchRef.current = now;
      if (isBackendReady) {
        refreshFriendData();
      }

      return undefined;
    }, [isBackendReady, refreshFriendData])
  );

  function renderPendingRequest(request) {
    const sender = request.sender || {};
    const loading = Boolean(friendActionLoading[request.sender_id]);

    return (
      <View style={styles.requestCard}>
        <UserAvatar uri={sender.avatar_url} size={52} style={styles.avatar} />
        <View style={styles.requestContent}>
          <Text style={styles.requestName}>{sender.name || sender.full_name || 'Người dùng Orbit'}</Text>
          <Text style={styles.requestText}>Muốn kết bạn với bạn</Text>
          <View style={styles.requestActions}>
            <Pressable
              disabled={loading}
              style={[styles.acceptButton, loading && styles.disabledButton]}
              onPress={() => acceptRequest(request.id)}
            >
              <Text style={styles.acceptText}>{loading ? 'Đang xử lý...' : 'Chấp nhận'}</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              style={[styles.rejectButton, loading && styles.disabledButton]}
              onPress={() => rejectRequest(request.id)}
            >
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
      {backendLoading ? <Text style={styles.notice}>Đang đồng bộ bạn bè...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pendingRequests.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lời mời kết bạn</Text>
          {pendingRequests.map((request, index) => (
            <View key={String(request.id || `request-${request.sender_id || 'unknown'}-${request.created_at || index}`)}>
              {renderPendingRequest(request)}
            </View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={friends}
        keyExtractor={(item, index) => String(item.id || `friend-${item.updated_at || index}`)}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Danh sách bạn bè</Text>}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có bạn bè</Text>
            <Text style={styles.emptyText}>Gửi lời mời từ Bản đồ hoặc Người gần đây. Khi họ chấp nhận, họ sẽ xuất hiện ở đây.</Text>
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
    borderWidth: 1,
    borderColor: colors.line,
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
  disabledButton: {
    opacity: 0.55,
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
    padding: spacing.xl,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
