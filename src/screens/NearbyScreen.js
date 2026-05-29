import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import mockMessages from '../data/mockMessages';
import useMessageStore from '../store/messageStore';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

function formatBadgeCount(count) {
  return count > 99 ? '99+' : String(count);
}

export default function NearbyScreen({ navigation }) {
  const { currentUser, friends, isBackendReady } = useUserStore();
  const conversations = useMessageStore((state) => state.conversations);
  const loading = useMessageStore((state) => state.loading);
  const error = useMessageStore((state) => state.error);
  const loadConversations = useMessageStore((state) => state.loadConversations);

  const mockConversations = useMemo(
    () =>
      friends.map((friend, index) => {
        const message =
          mockMessages[mockMessages.length - 1 - (index % mockMessages.length)];
        return {
          ...friend,
          lastMessage: message?.text || 'Bắt đầu trò chuyện',
          lastMessageTime: message?.time || '',
          isMine: message?.senderId === 'me',
          unreadCount: 0,
        };
      }),
    [friends]
  );

  const items = isBackendReady ? conversations : mockConversations;

  useFocusEffect(
    useCallback(() => {
      if (isBackendReady) {
        loadConversations({
          silent: conversations.length > 0,
          currentUserId: currentUser?.id,
        });
      }

      return undefined;
    }, [conversations.length, currentUser?.id, isBackendReady, loadConversations])
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Tin nhắn</Text>
      {loading ? <Text style={styles.notice}>Đang tải hội thoại...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          String(item.id || `conversation-${index}`)
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
            <Text style={styles.emptyText}>
              Khi bạn nhắn với ai đó, hội thoại sẽ nằm ở đây.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.conversation,
              item.unreadCount && styles.unreadConversation,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate('Chat', { userId: item.id })}
          >
            <UserAvatar uri={item.avatar} size={56} style={styles.avatar} />
            <View style={styles.content}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.trailing}>
                  {item.unreadCount ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {formatBadgeCount(item.unreadCount)}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.time}>{item.lastMessageTime}</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.message,
                  item.unreadCount && styles.unreadMessage,
                ]}
                numberOfLines={1}
              >
                {item.isMine ? 'Bạn: ' : ''}
                {item.lastMessage}
              </Text>
            </View>
          </Pressable>
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
  list: {
    paddingBottom: spacing.xxl,
  },
  conversation: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  unreadConversation: {
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  avatar: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  time: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    color: colors.muted,
    fontSize: 13,
  },
  unreadMessage: {
    color: colors.text,
    fontWeight: '800',
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
