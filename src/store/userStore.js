import { create } from 'zustand';
import mockUsers, { currentUser } from '../data/mockUsers';
import { getCurrentSession, loginWithEmail, logout, registerWithEmail } from '../services/authService';
import {
  acceptFriendRequest,
  fetchFriends,
  fetchPendingRequests,
  rejectFriendRequest,
  sendFriendRequest,
} from '../services/friendService';
import { fetchCurrentUserProfile, mapProfileRow, updateOnlineStatus } from '../services/profileService';
import { hasSupabaseConfig } from '../services/supabase';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

const mockFriends = mockUsers.filter((user) => user.isFriend);

function mapFriendProfile(row) {
  return {
    ...mapProfileRow(row),
    distance: 0,
    isFriend: true,
    location: currentUser.location,
  };
}

const useUserStore = create((set) => ({
  currentUser,
  users: hasSupabaseConfig ? [] : mockUsers,
  friends: hasSupabaseConfig ? [] : mockFriends,
  pendingRequests: [],
  selectedUser: null,
  session: null,
  authLoading: false,
  backendLoading: false,
  error: null,
  isBackendReady: hasSupabaseConfig,
  setSelectedUser: (user) => set({ selectedUser: user }),
  clearSelectedUser: () => set({ selectedUser: null }),
  setUsers: (users) => set({ users }),
  updateProfilePresence: (profileRow) =>
    set((state) => {
      const mappedProfile = mapProfileRow(profileRow);
      if (!mappedProfile) {
        return {};
      }

      const applyStatus = (item) =>
        item.id === mappedProfile.id
          ? { ...item, isOnline: mappedProfile.isOnline, lastActive: mappedProfile.lastActive }
          : item;

      return {
        users: state.users.map(applyStatus),
        friends: state.friends.map(applyStatus),
        selectedUser:
          state.selectedUser?.id === mappedProfile.id
            ? applyStatus(state.selectedUser)
            : state.selectedUser,
      };
    }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  loadSession: async () => {
    if (!hasSupabaseConfig) {
      return null;
    }

    set({ authLoading: true, error: null });
    try {
      const session = await getCurrentSession();
      if (session) {
        await updateOnlineStatus(true);
      }
      set({ session, authLoading: false });
      return session;
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message), authLoading: false });
      return null;
    }
  },
  login: async (email, password) => {
    if (!hasSupabaseConfig) {
      set({ session: { user: { id: 'me' } }, error: null });
      return true;
    }

    set({ authLoading: true, error: null });
    try {
      const data = await loginWithEmail(email, password);
      await updateOnlineStatus(true);
      const profile = await fetchCurrentUserProfile();
      set({
        session: data.session,
        currentUser: profile || { ...currentUser, id: data.session?.user?.id || currentUser.id },
        authLoading: false,
      });
      return true;
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message), authLoading: false });
      return false;
    }
  },
  register: async (email, password, profile) => {
    if (!hasSupabaseConfig) {
      set({
        session: { user: { id: 'me' } },
        currentUser: { ...currentUser, name: profile.name || currentUser.name },
        error: null,
      });
      return true;
    }

    set({ authLoading: true, error: null });
    try {
      const data = await registerWithEmail(email, password, profile);
      if (data.session) {
        await updateOnlineStatus(true);
      }
      set({
        session: data.session,
        currentUser: {
          ...currentUser,
          id: data.user?.id || currentUser.id,
          name: profile.name || currentUser.name,
        },
        error: data.session ? null : 'TÃ i khoáº£n Ä‘Ã£ táº¡o. HÃ£y kiá»ƒm tra email Ä‘á»ƒ xÃ¡c nháº­n rá»“i Ä‘Äƒng nháº­p.',
        authLoading: false,
      });
      return true;
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message), authLoading: false });
      return false;
    }
  },
  logoutUser: async () => {
    if (!hasSupabaseConfig) {
      set({ session: null, currentUser, users: mockUsers, friends: mockFriends, pendingRequests: [] });
      return;
    }

    try {
      await updateOnlineStatus(false).catch(() => {});
      await logout();
      set({ session: null, currentUser, users: [], friends: [], pendingRequests: [] });
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message) });
    }
  },
  loadCurrentProfile: async () => {
    if (!hasSupabaseConfig) {
      return currentUser;
    }

    set({ backendLoading: true, error: null });
    try {
      const profile = await fetchCurrentUserProfile();
      if (profile) {
        set({ currentUser: profile, backendLoading: false });
      } else {
        set({ backendLoading: false });
      }
      return profile;
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message), backendLoading: false });
      return null;
    }
  },
  setOnlineStatus: async (isOnline) => {
    if (!hasSupabaseConfig) {
      return;
    }

    try {
      const profile = await updateOnlineStatus(isOnline);
      if (profile) {
        set({ currentUser: profile, error: null });
      }
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message) });
    }
  },
  loadFriends: async () => {
    if (!hasSupabaseConfig) {
      set({ friends: mockFriends });
      return;
    }

    set({ backendLoading: true, error: null });
    try {
      const rows = await fetchFriends();
      set({ friends: rows.map(mapFriendProfile), backendLoading: false });
    } catch (error) {
      set({ friends: [], error: getVietnameseErrorMessage(error.message), backendLoading: false });
    }
  },
  loadPendingRequests: async () => {
    if (!hasSupabaseConfig) {
      set({ pendingRequests: [] });
      return;
    }

    set({ backendLoading: true, error: null });
    try {
      const pendingRequests = await fetchPendingRequests();
      set({ pendingRequests, backendLoading: false });
    } catch (error) {
      set({ pendingRequests: [], error: getVietnameseErrorMessage(error.message), backendLoading: false });
    }
  },
  requestFriend: async (receiverId) => {
    if (!hasSupabaseConfig) {
      return true;
    }

    try {
      await sendFriendRequest(receiverId);
      set({ error: null });
      return true;
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message) });
      return false;
    }
  },
  acceptRequest: async (requestId) => {
    if (!hasSupabaseConfig) {
      return;
    }

    set({ backendLoading: true, error: null });
    try {
      await acceptFriendRequest(requestId);
      const rows = await fetchFriends();
      const pendingRequests = await fetchPendingRequests();
      set({ friends: rows.map(mapFriendProfile), pendingRequests, backendLoading: false });
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message), backendLoading: false });
    }
  },
  rejectRequest: async (requestId) => {
    if (!hasSupabaseConfig) {
      return;
    }

    set({ backendLoading: true, error: null });
    try {
      await rejectFriendRequest(requestId);
      const pendingRequests = await fetchPendingRequests();
      set({ pendingRequests, backendLoading: false });
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message), backendLoading: false });
    }
  },
}));

export default useUserStore;
