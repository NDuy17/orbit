import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  fetchIncomingMessages,
  fetchRecentConversations,
} from '../services/messageService';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

const LAST_SEEN_STORAGE_KEY_PREFIX = 'orbit.messages.lastSeenByUser';

let loadRequestId = 0;

function getTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getMessageTimestamp(message) {
  return getTimestamp(message?.created_at || message?.createdAt);
}

function getConversationTimestamp(conversation) {
  return getTimestamp(conversation?.lastMessageAt);
}

function countUnreadByUser(messages, lastSeenByUser) {
  return messages.reduce((counts, message) => {
    const senderId = message?.sender_id;
    if (!senderId) {
      return counts;
    }

    const messageTimestamp = getMessageTimestamp(message);
    const seenTimestamp = getTimestamp(lastSeenByUser[senderId]);
    if (messageTimestamp > seenTimestamp) {
      counts[senderId] = (counts[senderId] || 0) + 1;
    }

    return counts;
  }, {});
}

function countUnreadSenders(counts) {
  return Object.values(counts).filter((count) => count > 0).length;
}

function applyUnreadCounts(conversations, unreadByUser) {
  return conversations.map((conversation) => ({
    ...conversation,
    unreadCount: unreadByUser[conversation.id] || 0,
  }));
}

function parseLastSeenMap(value) {
  if (!value) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(value);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch {
    return {};
  }
}

const initialState = {
  conversations: [],
  loading: false,
  refreshing: false,
  error: null,
  unreadByUser: {},
  unreadCount: 0,
  lastSeenByUser: {},
  currentUserId: null,
  seenHydrated: false,
};

function getLastSeenStorageKey(currentUserId) {
  return `${LAST_SEEN_STORAGE_KEY_PREFIX}:${currentUserId || 'anonymous'}`;
}

const useMessageStore = create((set, get) => ({
  ...initialState,

  hydrateLastSeenByUser: async (currentUserId) => {
    if (get().seenHydrated && get().currentUserId === currentUserId) {
      return get().lastSeenByUser;
    }

    const storedValue = await AsyncStorage.getItem(
      getLastSeenStorageKey(currentUserId)
    ).catch(() => null);
    const lastSeenByUser = parseLastSeenMap(storedValue);
    set({ lastSeenByUser, currentUserId, seenHydrated: true });
    return lastSeenByUser;
  },

  loadConversations: async ({ silent = false, currentUserId } = {}) => {
    const requestId = ++loadRequestId;
    if (!silent) {
      set({ loading: true });
    }

    set({ error: null });
    try {
      const lastSeenByUser = await get().hydrateLastSeenByUser(currentUserId);
      const [conversations, incomingMessages] = await Promise.all([
        fetchRecentConversations(100),
        fetchIncomingMessages(500),
      ]);
      const unreadByUser = countUnreadByUser(
        incomingMessages,
        lastSeenByUser
      );

      if (requestId === loadRequestId) {
        set({
          conversations: applyUnreadCounts(conversations, unreadByUser),
          unreadByUser,
          unreadCount: countUnreadSenders(unreadByUser),
          loading: false,
          refreshing: false,
        });
      }

      return conversations;
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

  refreshConversations: async () => {
    set({ refreshing: true });
    return get().loadConversations({ silent: true });
  },

  markConversationSeen: async (userId, seenAt, currentUserId) => {
    if (!userId) {
      return;
    }

    await get().hydrateLastSeenByUser(currentUserId);
    const conversation = get().conversations.find((item) => item.id === userId);
    const nextSeenAt =
      seenAt ||
      conversation?.lastMessageAt ||
      new Date().toISOString();
    const nextSeenTimestamp = getTimestamp(nextSeenAt);
    const previousSeenTimestamp = getTimestamp(get().lastSeenByUser[userId]);

    if (nextSeenTimestamp <= previousSeenTimestamp) {
      return;
    }

    const lastSeenByUser = {
      ...get().lastSeenByUser,
      [userId]: new Date(nextSeenTimestamp).toISOString(),
    };
    const unreadByUser = { ...get().unreadByUser };
    delete unreadByUser[userId];

    set({
      lastSeenByUser,
      currentUserId,
      seenHydrated: true,
      unreadByUser,
      unreadCount: countUnreadSenders(unreadByUser),
      conversations: applyUnreadCounts(get().conversations, unreadByUser).sort(
        (first, second) =>
          getConversationTimestamp(second) - getConversationTimestamp(first)
      ),
    });

    await AsyncStorage.setItem(
      getLastSeenStorageKey(currentUserId),
      JSON.stringify(lastSeenByUser)
    ).catch(() => {});
  },

  resetMessages: () => {
    loadRequestId += 1;
    set({ ...initialState });
  },
}));

export default useMessageStore;
