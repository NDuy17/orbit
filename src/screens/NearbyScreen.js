import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserListItem from '../components/UserListItem';
import useLocationStore from '../store/locationStore';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { isWithinRadius } from '../utils/distance';

const radiusOptions = [100, 500, 1000];

export default function NearbyScreen({ navigation }) {
  const { users, friends, requestFriend, loadFriends, isBackendReady, error } = useUserStore();
  const { radius, setRadius } = useLocationStore();
  const friendIds = useMemo(() => friends.map((friend) => friend.id), [friends]);
  useFocusEffect(
    useCallback(() => {
      if (isBackendReady) {
        loadFriends();
      }
    }, [isBackendReady, loadFriends])
  );

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) => isWithinRadius(user, radius) && !user.isFriend && !friendIds.includes(user.id)
      ),
    [friendIds, users, radius]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Người gần đây</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.filters}>
        {radiusOptions.map((item) => (
          <Pressable
            key={item}
            onPress={() => setRadius(item)}
            style={[styles.chip, radius === item && styles.activeChip]}
          >
            <Text style={[styles.chipText, radius === item && styles.activeChipText]}>
              {item === 1000 ? '1km' : `${item}m`}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có ai gần đây</Text>
            <Text style={styles.emptyText}>Khi người dùng khác đăng nhập và chia sẻ vị trí, họ sẽ hiện ở đây.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <UserListItem
            user={item}
            onAddFriend={() => requestFriend(item.id)}
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
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.muted,
    fontWeight: '700',
  },
  activeChipText: {
    color: colors.text,
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
