import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import mockMessages from '../data/mockMessages';
import { fetchRecentConversations, subscribeToAllMessages } from '../services/messageService';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

export default function NearbyScreen({ navigation }) {
  const { currentUser, friends, isBackendReady } = useUserStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mockConversations = useMemo(
    () =>
      friends.map((friend, index) => {
        const message = mockMessages[mockMessages.length - 1 - (index % mockMessages.length)];
        return {
          ...friend,
          lastMessage: message?.text || 'Bắt đầu trò chuyện',
          lastMessageTime: message?.time || '',
          isMine: message?.senderId === 'me',
        };
      }),
    [friends]
  );

  const items = isBackendReady ? conversations : mockConversations;

  const loadConversations = useCallback(async () => {
    if (!isBackendReady) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await fetchRecentConversations();
      setConversations(rows);
    } catch (err) {
      setError(getVietnameseErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  }, [isBackendReady]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();

      if (!isBackendReady || !currentUser?.id) {
        return undefined;
      }

      const unsubscribe = subscribeToAllMessages(currentUser.id, loadConversations);
      return () => unsubscribe();
    }, [currentUser?.id, isBackendReady, loadConversations])
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Tin nhắn</Text>
      {loading ? <Text style={styles.notice}>Đang tải hội thoại...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id || `conversation-${index}`)}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
            <Text style={styles.emptyText}>Khi bạn nhắn với ai đó, hội thoại sẽ nằm ở đây.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.conversation, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Chat', { userId: item.id })}
          >
            <UserAvatar uri={item.avatar} size={56} style={styles.avatar} />
            <View style={styles.content}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.time}>{item.lastMessageTime}</Text>
              </View>
              <Text style={styles.message} numberOfLines={1}>
                {item.isMine ? 'Bạn: ' : ''}{item.lastMessage}
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
  time: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    color: colors.muted,
    fontSize: 13,
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
