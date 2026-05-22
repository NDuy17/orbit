import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import UserListItem from '../components/UserListItem';
import useLocationStore from '../store/locationStore';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { isWithinRadius } from '../utils/distance';

const tabs = [
  { key: 'friends', label: 'Bạn bè' },
  { key: 'recent', label: 'Gần đây' },
];

const radiusOptions = [100, 500, 1000, 5000];
const searchPageSize = 8;

function formatRadiusLabel(value) {
  return value >= 1000 ? `${value / 1000}km` : `${value}m`;
}

export default function FriendsScreen({ navigation }) {
  const {
    users,
    friends,
    pendingRequests,
    sentRequests,
    backendLoading,
    friendActionLoading,
    error,
    isBackendReady,
    refreshFriendData,
    requestFriend,
    acceptRequest,
    acceptRequestForUser,
    rejectRequest,
    searchUsersByName,
  } = useUserStore();
  const { radius, setRadius } = useLocationStore();
  const [activeTab, setActiveTab] = useState('friends');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const lastFetchRef = useRef(0);
  const searchTimerRef = useRef(null);

  const friendIds = useMemo(() => friends.map((friend) => friend.id), [friends]);
  const recentSuggestions = useMemo(
    () =>
      users
        .filter(
          (user) =>
            isWithinRadius(user, radius) &&
            user.friendshipStatus !== 'friends' &&
            !friendIds.includes(user.id)
        )
        .slice(0, 20),
    [friendIds, radius, users]
  );
  const isSearchMode = searchOpen && Boolean(query.trim());
  const activeData = isSearchMode ? searchResults : activeTab === 'friends' ? friends : recentSuggestions;

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

  function handleSearchText(nextQuery) {
    setQuery(nextQuery);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const cleanQuery = nextQuery.trim();
    if (!cleanQuery) {
      setSearchResults([]);
      setSearching(false);
      setSearchOffset(0);
      setHasMoreSearchResults(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchUsersByName(cleanQuery, { limit: searchPageSize, offset: 0 });
      setSearchResults(results);
      setSearchOffset(results.length);
      setHasMoreSearchResults(results.length === searchPageSize);
      setSearching(false);
    }, 350);
  }

  async function loadMoreSearchResults() {
    const cleanQuery = query.trim();
    if (!isSearchMode || searching || !hasMoreSearchResults || !cleanQuery) {
      return;
    }

    setSearching(true);
    const results = await searchUsersByName(cleanQuery, {
      limit: searchPageSize,
      offset: searchOffset,
    });
    setSearchResults((items) => {
      const existingIds = new Set(items.map((item) => item.id));
      return [...items, ...results.filter((item) => !existingIds.has(item.id))];
    });
    setSearchOffset((value) => value + results.length);
    setHasMoreSearchResults(results.length === searchPageSize);
    setSearching(false);
  }

  function toggleSearch() {
    setSearchOpen((value) => {
      const nextValue = !value;
      if (!nextValue) {
        setQuery('');
        setSearchResults([]);
        setSearching(false);
        setSearchOffset(0);
        setHasMoreSearchResults(false);
      }
      return nextValue;
    });
  }

  function openProfile(userId) {
    navigation.navigate('UserProfile', { userId });
  }

  function decorateUser(item) {
    if (friends.some((friend) => friend.id === item.id)) {
      return { ...item, friendshipStatus: 'friends', isFriend: true };
    }

    if (pendingRequests.some((request) => request.sender_id === item.id)) {
      return { ...item, friendshipStatus: 'pending_received', isFriend: false };
    }

    if (sentRequests.some((request) => request.receiver_id === item.id)) {
      return { ...item, friendshipStatus: 'pending_sent', isFriend: false };
    }

    return { ...item, friendshipStatus: item.friendshipStatus || 'none', isFriend: false };
  }

  function renderUser(item) {
    const user = decorateUser(item);

    return (
      <UserListItem
        user={user}
        onPress={() => openProfile(user.id)}
        onAddFriend={() => requestFriend(user.id)}
        onAcceptFriend={() => acceptRequestForUser(user.id)}
        onChat={() => navigation.navigate('Chat', { userId: user.id })}
        loading={Boolean(friendActionLoading[user.id])}
      />
    );
  }

  function renderPendingRequest(request) {
    const sender = request.sender || {};
    const loading = Boolean(friendActionLoading[request.sender_id]);

    return (
      <Pressable
        style={({ pressed }) => [styles.requestCard, pressed && styles.pressed]}
        onPress={() => request.sender_id && openProfile(request.sender_id)}
      >
        <UserAvatar uri={sender.avatar_url || sender.avatar} size={52} style={styles.avatar} />
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
      </Pressable>
    );
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Bạn bè</Text>
          <Pressable
            accessibilityLabel="Thêm bạn bè"
            style={({ pressed }) => [
              styles.addButton,
              searchOpen && styles.addButtonActive,
              pressed && styles.pressed,
            ]}
            onPress={toggleSearch}
          >
            <Ionicons name={searchOpen ? 'close' : 'person-add'} size={22} color={colors.text} />
          </Pressable>
        </View>

        {backendLoading ? <Text style={styles.notice}>Đang đồng bộ bạn bè...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {searchOpen ? (
          <View style={styles.searchPanel}>
            <TextInput
              style={styles.searchInput}
              placeholder="Nhập tên người bạn muốn tìm"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={handleSearchText}
              autoCapitalize="none"
              autoFocus
            />
            {query.trim() ? (
              <View style={styles.searchResults}>
                <Text style={styles.sectionTitle}>{searching ? 'Đang tìm...' : 'Kết quả tìm kiếm'}</Text>
                {!searchResults.length && !searching ? (
                  <Text style={styles.emptyInline}>Không tìm thấy người phù hợp.</Text>
                ) : null}
                {hasMoreSearchResults ? (
                  <Text style={styles.emptyInline}>Kéo xuống để tải thêm người trùng tên.</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {pendingRequests.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lời mời kết bạn</Text>
            {pendingRequests.map((request, index) => (
              <View key={String(request.id || `request-${request.sender_id || index}`)}>
                {renderPendingRequest(request)}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'recent' ? (
          <View style={styles.radiusPanel}>
            <Text style={styles.hint}>Gợi ý trong bán kính quanh bạn.</Text>
            <View style={styles.radiusRow}>
              {radiusOptions.map((item) => (
                <Pressable
                  key={`friend-radius-${item}`}
                  onPress={() => setRadius(item)}
                  style={[styles.radiusChip, radius === item && styles.activeRadiusChip]}
                >
                  <Text style={[styles.radiusText, radius === item && styles.activeRadiusText]}>
                    {formatRadiusLabel(item)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={activeData}
        keyExtractor={(item, index) => String(item.id || `${isSearchMode ? 'search' : activeTab}-${index}`)}
        ListHeaderComponent={renderHeader}
        onEndReached={loadMoreSearchResults}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {isSearchMode
                ? searching
                  ? 'Đang tìm người phù hợp'
                  : 'Không có kết quả'
                : activeTab === 'friends'
                  ? 'Chưa có bạn bè'
                  : 'Chưa có gợi ý gần đây'}
            </Text>
            <Text style={styles.emptyText}>
              {isSearchMode
                ? 'Thử nhập tên khác hoặc kéo xuống nếu còn kết quả.'
                : activeTab === 'friends'
                  ? 'Bấm biểu tượng thêm bạn để tìm người theo tên.'
                  : 'Khi có người trong bán kính hiện tại, họ sẽ xuất hiện ở đây.'}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          isSearchMode ? (
            renderUser(item)
          ) : activeTab === 'friends' ? (
            <UserListItem
              user={item}
              showFriendButton={false}
              onPress={() => openProfile(item.id)}
              onChat={() => navigation.navigate('Chat', { userId: item.id })}
            />
          ) : (
            renderUser(item)
          )
        }
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  addButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  notice: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  searchPanel: {
    marginBottom: spacing.lg,
  },
  searchInput: {
    minHeight: 50,
    color: colors.text,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    outlineStyle: 'none',
  },
  searchResults: {
    marginTop: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activeTabText: {
    color: colors.text,
  },
  hint: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  radiusPanel: {
    marginBottom: spacing.md,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  radiusChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activeRadiusChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radiusText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activeRadiusText: {
    color: colors.text,
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
  emptyInline: {
    color: colors.muted,
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
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
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
