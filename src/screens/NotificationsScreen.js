import React, { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import OrbitButton from '../components/OrbitButton';
import useNotificationStore from '../store/notificationStore';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Vừa xong';
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function isFriendRequestNotification(notification) {
  return notification?.kind === 'friend_request';
}

export default function NotificationsScreen({ navigation }) {
  const currentUserId = useUserStore((state) => state.currentUser?.id);
  const notifications = useNotificationStore((state) => state.notifications);
  const loading = useNotificationStore((state) => state.loading);
  const refreshing = useNotificationStore((state) => state.refreshing);
  const error = useNotificationStore((state) => state.error);
  const loadNotifications = useNotificationStore(
    (state) => state.loadNotifications
  );
  const markNotificationsSeen = useNotificationStore(
    (state) => state.markNotificationsSeen
  );
  const refreshNotifications = useNotificationStore(
    (state) => state.refreshNotifications
  );
  const didLoadOnMountRef = useRef(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (didLoadOnMountRef.current) {
      return;
    }

    didLoadOnMountRef.current = true;
    loadNotifications({ silent: notifications.length > 0, userId: currentUserId });
  }, [currentUserId, loadNotifications, notifications.length]);

  useEffect(() => {
    if (isFocused) {
      markNotificationsSeen(currentUserId);
    }
  }, [currentUserId, isFocused, markNotificationsSeen, notifications]);

  function handleRefresh() {
    refreshNotifications();
  }

  function handleOpenNotification(notification) {
    if (!isFriendRequestNotification(notification)) {
      return;
    }

    navigation.navigate('Friends', {
      showRequests: true,
      requestFocusNonce: Date.now(),
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
        <OrbitButton
          title="Làm mới"
          variant="ghost"
          onPress={handleRefresh}
          style={styles.refreshButton}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {loading ? (
          <Text style={styles.notice}>Đang tải thông báo...</Text>
        ) : null}

        {!loading && !notifications.length ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
            <Text style={styles.emptyText}>
              Thông báo từ Orbit sẽ xuất hiện tại đây.
            </Text>
          </GlassCard>
        ) : null}

        {notifications.map((item) => {
          const canOpen = isFriendRequestNotification(item);
          return (
            <Pressable
              key={item.id}
              disabled={!canOpen}
              accessibilityRole={canOpen ? 'button' : undefined}
              onPress={() => handleOpenNotification(item)}
            >
              {({ pressed }) => (
                <GlassCard
                  style={[
                    styles.notificationCard,
                    canOpen && styles.actionableCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.time}>
                      {formatNotificationTime(
                        item.updated_at || item.sent_at || item.created_at
                      )}
                    </Text>
                  </View>
                  <Text style={styles.body}>{item.body}</Text>
                </GlassCard>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
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
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  refreshButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  notice: {
    color: colors.muted,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  notificationCard: {
    gap: spacing.sm,
  },
  actionableCard: {
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.995 }],
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  notificationTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  time: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    color: colors.text,
    lineHeight: 21,
  },
});
