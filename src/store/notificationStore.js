import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchUserNotifications } from '../services/notificationService';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

let loadRequestId = 0;
const LAST_SEEN_STORAGE_KEY_PREFIX = 'orbit.notifications.lastSeenAt';

function getNotificationTimestamp(notification) {
  const value =
    notification?.updated_at || notification?.sent_at || notification?.created_at;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getSeenTimestamp(lastSeenAt) {
  const timestamp = new Date(lastSeenAt || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function countUnreadNotifications(notifications, lastSeenAt) {
  const seenTimestamp = getSeenTimestamp(lastSeenAt);
  return notifications.filter(
    (notification) => getNotificationTimestamp(notification) > seenTimestamp
  ).length;
}

function getLatestNotificationTimestamp(notifications) {
  return notifications.reduce(
    (latest, notification) =>
      Math.max(latest, getNotificationTimestamp(notification)),
    0
  );
}

const initialState = {
  notifications: [],
  loading: false,
  refreshing: false,
  unreadCount: 0,
  error: null,
  lastSyncedAt: null,
  lastSeenAt: null,
  userId: null,
  seenHydrated: false,
};

function getLastSeenStorageKey(userId) {
  return `${LAST_SEEN_STORAGE_KEY_PREFIX}:${userId || 'anonymous'}`;
}

const useNotificationStore = create((set, get) => ({
  ...initialState,

  hydrateLastSeenAt: async (userId) => {
    if (get().seenHydrated && get().userId === userId) {
      return get().lastSeenAt;
    }

    const lastSeenAt = await AsyncStorage.getItem(
      getLastSeenStorageKey(userId)
    ).catch(() => null);
    set({ lastSeenAt, seenHydrated: true, userId });
    return lastSeenAt;
  },

  loadNotifications: async ({ silent = false, userId } = {}) => {
    const requestId = ++loadRequestId;
    if (!silent) {
      set({ loading: true });
    }

    set({ error: null });
    try {
      const lastSeenAt = await get().hydrateLastSeenAt(userId);
      const notifications = await fetchUserNotifications();
      if (requestId === loadRequestId) {
        set({
          notifications,
          unreadCount: countUnreadNotifications(notifications, lastSeenAt),
          loading: false,
          refreshing: false,
          lastSyncedAt: new Date().toISOString(),
        });
      }
      return notifications;
    } catch (error) {
      if (requestId === loadRequestId) {
        set({
          error: getVietnameseErrorMessage(error.message),
          loading: false,
          refreshing: false,
        });
      }
      return [];
    }
  },

  refreshNotifications: async ({ userId } = {}) => {
    set({ refreshing: true });
    return get().loadNotifications({
      silent: true,
      userId: userId || get().userId,
    });
  },

  markNotificationsSeen: async (userId) => {
    const latestTimestamp = getLatestNotificationTimestamp(get().notifications);
    const currentSeenTimestamp = getSeenTimestamp(get().lastSeenAt);

    if (!latestTimestamp || latestTimestamp <= currentSeenTimestamp) {
      set({ unreadCount: 0 });
      return;
    }

    const lastSeenAt = new Date(latestTimestamp).toISOString();

    set({
      lastSeenAt,
      seenHydrated: true,
      userId,
      unreadCount: 0,
    });

    await AsyncStorage.setItem(
      getLastSeenStorageKey(userId),
      lastSeenAt
    ).catch(() => {});
  },

  resetNotifications: () => {
    loadRequestId += 1;
    set({ ...initialState });
  },
}));

export default useNotificationStore;
