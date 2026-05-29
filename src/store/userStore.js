import { create } from 'zustand';
import mockUsers, { currentUser } from '../data/mockUsers';
import {
  getCurrentSession,
  loginWithEmail,
  logout,
  registerWithEmail,
} from '../services/authService';
import { fetchCurrentAdminMembership } from '../services/adminService';
import { removeRegisteredPushToken } from '../services/pushNotificationService';
import {
  acceptFriendRequest,
  fetchFriendshipSnapshot,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '../services/friendService';
import {
  createProfile,
  fetchCurrentUserProfile,
  mapProfileRow,
  searchProfilesByName,
  updateOnlineStatus,
  updateProfile,
} from '../services/profileService.js';
import { hasSupabaseConfig } from '../services/supabase';
import { getAccountRestriction } from '../utils/accountStatus';
import { getVietnameseErrorMessage } from '../utils/errorMessages';
import { isRecentlyOnline } from '../utils/presence';
import { textOr } from '../utils/text';

const mockFriends = mockUsers.filter((user) => user.isFriend);

function hasCoordinatePair(value) {
  return value?.latitude != null && value?.longitude != null;
}

function mapFriendProfile(row) {
  return {
    ...mapProfileRow(row),
    distance: 0,
    isFriend: true,
    friendshipStatus: 'friends',
    friends: row.friends_count || row.friends || 0,
    met: row.encounters_count || row.met || 0,
    recent: row.recent_count || row.recent || 0,
    location: row.location
      ? row.location
      : hasCoordinatePair(row)
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
  };
}

function getOwnFriendCount(state, fallback = 0) {
  return state.friends.length || fallback || 0;
}

function withOwnStats(profile, state) {
  if (!profile) {
    return profile;
  }

  return {
    ...profile,
    friends: getOwnFriendCount(state, profile.friends),
  };
}

function getFriendshipStatus(userId, state) {
  if (!userId) {
    return 'none';
  }

  if (state.friends.some((friend) => friend.id === userId)) {
    return 'friends';
  }

  if (state.pendingRequests.some((request) => request.sender_id === userId)) {
    return 'pending_received';
  }

  if (state.sentRequests.some((request) => request.receiver_id === userId)) {
    return 'pending_sent';
  }

  return 'none';
}

function withFriendshipStatus(user, state) {
  if (!user) {
    return user;
  }

  const friendshipStatus = getFriendshipStatus(user.id, state);

  return {
    ...user,
    friendshipStatus,
    isFriend: friendshipStatus === 'friends',
  };
}

function applyFriendshipToState(state) {
  return {
    users: state.users.map((user) => withFriendshipStatus(user, state)),
    friends: state.friends.map((friend) => withFriendshipStatus(friend, state)),
    selectedUser: withFriendshipStatus(state.selectedUser, state),
  };
}

function refreshPresenceItem(item) {
  if (!item?.lastActiveAt) {
    return item;
  }

  const isOnline = isRecentlyOnline(item.isOnline, item.lastActiveAt);
  return item.isOnline === isOnline ? item : { ...item, isOnline };
}

function mergeUniqueById(items) {
  const map = new Map();
  items.forEach((item) => {
    if (item?.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

function isMissingProfileError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('0 rows') ||
    message.includes('no rows') ||
    message.includes('pgrst116')
  );
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchesSearchPrefix(value, cleanQuery) {
  const normalizedValue = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(cleanQuery);

  if (!normalizedValue || !normalizedQuery) {
    return false;
  }

  return normalizedValue
    .split(/\s+/)
    .filter(Boolean)
    .some((word, index) => {
      if (word.startsWith(normalizedQuery)) {
        return true;
      }

      return index === 0 && normalizedValue.startsWith(normalizedQuery);
    });
}

function searchLocalProfiles(state, cleanQuery) {
  const currentUserId = state.currentUser?.id;

  return mergeUniqueById([...state.friends, ...state.users])
    .filter((user) => user?.id && user.id !== currentUserId)
    .filter((user) =>
      [user.name, user.full_name, user.username, user.status].some((value) =>
        matchesSearchPrefix(value, cleanQuery)
      )
    )
    .map((user) => withFriendshipStatus(user, state));
}

async function loadOrCreateProfileForSession(session, authUser = session?.user) {
  try {
    return await fetchCurrentUserProfile();
  } catch (profileError) {
    if (!isMissingProfileError(profileError) || !session?.user?.id) {
      throw profileError;
    }

    return createProfile(
      session.user.id,
      {
        name:
          authUser?.user_metadata?.name ||
          session.user.email ||
          'Người dùng Orbit',
      },
      {
        isOnline: true,
      }
    );
  }
}

const useUserStore = create((set, get) => ({
  currentUser,
  users: hasSupabaseConfig
    ? []
    : mockUsers.map((user) => ({
        ...user,
        friendshipStatus: user.isFriend ? 'friends' : 'none',
      })),
  friends: hasSupabaseConfig
    ? []
    : mockFriends.map((friend) => ({ ...friend, friendshipStatus: 'friends' })),
  pendingRequests: [],
  sentRequests: [],
  selectedUser: null,
  session: null,
  authLoading: false,
  backendLoading: false,
  friendActionLoading: {},
  actionNotice: null,
  error: null,
  accountRestriction: null,
  isBackendReady: hasSupabaseConfig,
  adminMembership: null,
  isAdminAccount: false,

  setSelectedUser: (user) =>
    set((state) => ({ selectedUser: withFriendshipStatus(user, state) })),

  clearSelectedUser: () => set({ selectedUser: null }),

  setUsers: (users) =>
    set((state) => {
      const nextState = { ...state, users };
      return {
        users: users.map((user) => withFriendshipStatus(user, nextState)),
      };
    }),

  setActionNotice: (actionNotice) => set({ actionNotice }),
  clearActionNotice: () => set({ actionNotice: null }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  clearAccountRestriction: () => set({ accountRestriction: null, error: null }),

  refreshPresenceStatus: () => {
    if (!hasSupabaseConfig) {
      return;
    }

    set((state) => ({
      currentUser: refreshPresenceItem(state.currentUser),
      users: state.users.map(refreshPresenceItem),
      friends: state.friends.map(refreshPresenceItem),
      selectedUser: refreshPresenceItem(state.selectedUser),
    }));
  },

  loadAdminStatus: async () => {
    if (!hasSupabaseConfig || !get().session) {
      set({ adminMembership: null, isAdminAccount: false });
      return null;
    }

    try {
      const adminMembership = await fetchCurrentAdminMembership();
      set({
        adminMembership,
        isAdminAccount: Boolean(adminMembership),
      });
      return adminMembership;
    } catch {
      set({ adminMembership: null, isAdminAccount: false });
      return null;
    }
  },

  updateProfilePresence: (profileRow) =>
    set((state) => {
      const mappedProfile = mapProfileRow(profileRow);
      if (!mappedProfile) {
        return {};
      }

      const applyProfile = (item) =>
        item?.id === mappedProfile.id
          ? {
              ...item,
              name: mappedProfile.name,
              avatar: mappedProfile.avatar,
              avatar_url: mappedProfile.avatar_url,
              bio: mappedProfile.bio,
              status: mappedProfile.status,
              isOnline: mappedProfile.isOnline,
              lastActiveAt: mappedProfile.lastActiveAt,
              lastActive: mappedProfile.lastActive,
              accountStatus: mappedProfile.accountStatus,
              disabledAt: mappedProfile.disabledAt,
              bannedAt: mappedProfile.bannedAt,
              deletedAt: mappedProfile.deletedAt,
              moderationReason: mappedProfile.moderationReason,
              banExpiresAt: mappedProfile.banExpiresAt,
            }
          : item;
      const accountRestriction =
        state.currentUser.id === mappedProfile.id && !state.isAdminAccount
          ? getAccountRestriction(mappedProfile)
          : state.accountRestriction;

      return {
        currentUser:
          state.currentUser.id === mappedProfile.id
            ? withOwnStats(applyProfile(state.currentUser), state)
            : state.currentUser,
        users: state.users.map(applyProfile),
        friends: state.friends.map(applyProfile),
        selectedUser:
          state.selectedUser?.id === mappedProfile.id
            ? applyProfile(state.selectedUser)
            : state.selectedUser,
        accountRestriction,
        error: accountRestriction
          ? accountRestriction.message
          : state.accountRestriction
            ? null
            : state.error,
      };
    }),

  loadSession: async () => {
    if (!hasSupabaseConfig) {
      return null;
    }

    set({ authLoading: true, error: null, accountRestriction: null });
    try {
      const session = await getCurrentSession();
      if (!session) {
        set({
          session: null,
          authLoading: false,
          adminMembership: null,
          isAdminAccount: false,
          accountRestriction: null,
        });
        return null;
      }

      const adminMembership = await fetchCurrentAdminMembership().catch(
        () => null
      );
      const profile = await loadOrCreateProfileForSession(session);
      const accountRestriction = adminMembership
        ? null
        : getAccountRestriction(profile);

      if (accountRestriction) {
        await removeRegisteredPushToken().catch(() => {});
        await logout().catch(() => {});
        set({
          session: null,
          currentUser: profile || currentUser,
          users: [],
          friends: [],
          pendingRequests: [],
          sentRequests: [],
          adminMembership: null,
          isAdminAccount: false,
          accountRestriction,
          error: accountRestriction.message,
          authLoading: false,
        });
        return null;
      }

      const onlineProfile = await updateOnlineStatus(true).catch(() => null);
      set((state) => ({
        session,
        currentUser: withOwnStats(
          onlineProfile ||
            profile || {
              ...currentUser,
              id: session.user?.id || currentUser.id,
            },
          state
        ),
        adminMembership,
        isAdminAccount: Boolean(adminMembership),
        authLoading: false,
        accountRestriction: null,
        error: null,
      }));
      return session;
    } catch (error) {
      set({
        error: getVietnameseErrorMessage(error.message),
        authLoading: false,
      });
      return null;
    }
  },

  login: async (email, password) => {
    if (!hasSupabaseConfig) {
      set({
        session: { user: { id: 'me' } },
        error: null,
        accountRestriction: null,
      });
      return true;
    }

    set({ authLoading: true, error: null, accountRestriction: null });
    try {
      const data = await loginWithEmail(email, password);
      const adminMembership = await fetchCurrentAdminMembership().catch(
        () => null
      );
      const profile = await loadOrCreateProfileForSession(
        data.session,
        data.user
      );
      const accountRestriction = adminMembership
        ? null
        : getAccountRestriction(profile);

      if (accountRestriction) {
        await removeRegisteredPushToken().catch(() => {});
        await logout().catch(() => {});
        set({
          session: null,
          currentUser: profile || currentUser,
          users: [],
          friends: [],
          pendingRequests: [],
          sentRequests: [],
          adminMembership: null,
          isAdminAccount: false,
          accountRestriction,
          error: accountRestriction.message,
          authLoading: false,
        });
        return false;
      }

      const onlineProfile = await updateOnlineStatus(true).catch(() => null);
      set((state) => ({
        session: data.session,
        currentUser: withOwnStats(
          onlineProfile ||
            profile || {
              ...currentUser,
              id: data.session?.user?.id || currentUser.id,
            },
          state
        ),
        adminMembership,
        isAdminAccount: Boolean(adminMembership),
        accountRestriction: null,
        error: null,
        authLoading: false,
      }));
      await get().refreshFriendData();
      return true;
    } catch (error) {
      set({
        error: getVietnameseErrorMessage(error.message),
        authLoading: false,
      });
      return false;
    }
  },

  register: async (email, password, profile) => {
    if (!hasSupabaseConfig) {
      set({
        session: { user: { id: 'me' } },
        currentUser: { ...currentUser, name: profile.name || currentUser.name },
        error: null,
        accountRestriction: null,
      });
      return true;
    }

    set({ authLoading: true, error: null, accountRestriction: null });
    try {
      const data = await registerWithEmail(email, password, profile);
      if (data.session) {
        await updateOnlineStatus(true).catch(() => {});
      }
      set({
        session: data.session,
        adminMembership: null,
        isAdminAccount: false,
        currentUser: {
          ...currentUser,
          id: data.user?.id || currentUser.id,
          name: profile.name || currentUser.name,
        },
        error: null,
        accountRestriction: null,
        authLoading: false,
      });
      if (data.session) {
        await get().refreshFriendData();
        return true;
      }
      return data.user ? 'needs_confirmation' : false;
    } catch (error) {
      set({
        error: getVietnameseErrorMessage(error.message),
        authLoading: false,
      });
      return false;
    }
  },

  logoutUser: async () => {
    const loggedOutState = {
      session: null,
      currentUser,
      users: hasSupabaseConfig
        ? []
        : mockUsers.map((user) => ({
            ...user,
            friendshipStatus: user.isFriend ? 'friends' : 'none',
          })),
      friends: hasSupabaseConfig
        ? []
        : mockFriends.map((friend) => ({
            ...friend,
            friendshipStatus: 'friends',
          })),
      pendingRequests: [],
      sentRequests: [],
      adminMembership: null,
      isAdminAccount: false,
      accountRestriction: null,
      error: null,
    };

    if (!hasSupabaseConfig) {
      set(loggedOutState);
      return;
    }

    let logoutError = null;
    try {
      await removeRegisteredPushToken().catch(() => {});
      await updateOnlineStatus(false).catch(() => {});
      await logout();
    } catch (error) {
      logoutError = getVietnameseErrorMessage(error.message);
    }

    set({
      ...loggedOutState,
      error: logoutError,
    });
  },

  loadCurrentProfile: async () => {
    if (!hasSupabaseConfig) {
      return currentUser;
    }

    set({ backendLoading: true, error: null });
    try {
      const profile = await fetchCurrentUserProfile();
      if (profile) {
        const accountRestriction = get().isAdminAccount
          ? null
          : getAccountRestriction(profile);
        set((state) => ({
          currentUser: withOwnStats(profile, state),
          backendLoading: false,
          accountRestriction,
          error: accountRestriction ? accountRestriction.message : null,
        }));
      } else {
        set({ backendLoading: false });
      }
      return profile;
    } catch (error) {
      if (isMissingProfileError(error) && get().session?.user?.id) {
        try {
          const profile = await createProfile(
            get().session.user.id,
            {
              name: get().session.user.email || 'Người dùng Orbit',
            },
            {
              isOnline: true,
            }
          );
          set((state) => ({
            currentUser: withOwnStats(profile, state),
            backendLoading: false,
            accountRestriction: null,
          }));
          return profile;
        } catch (createError) {
          set({
            error: getVietnameseErrorMessage(createError.message),
            backendLoading: false,
          });
          return null;
        }
      }

      set({
        error: getVietnameseErrorMessage(error.message),
        backendLoading: false,
      });
      return null;
    }
  },

  saveCurrentProfile: async (updates) => {
    const current = get().currentUser;
    const nextUpdates = {
      name: textOr(updates.name, current.name),
      avatar_url: updates.avatar_url || updates.avatar,
      bio: textOr(updates.bio, ''),
      status: textOr(updates.status, current.status || ''),
    };

    if (!hasSupabaseConfig) {
      const profile = {
        ...current,
        name: nextUpdates.name,
        avatar: nextUpdates.avatar_url || current.avatar,
        avatar_url: nextUpdates.avatar_url || current.avatar_url,
        bio: nextUpdates.bio,
        status: nextUpdates.status,
      };
      set({ currentUser: profile, error: null });
      return profile;
    }

    set({ backendLoading: true, error: null });
    try {
      const profile = await updateProfile(current.id, nextUpdates);
      set((state) => ({
        currentUser: withOwnStats(profile, state),
        users: state.users.map((user) =>
          user.id === profile.id ? { ...user, ...profile } : user
        ),
        friends: state.friends.map((friend) =>
          friend.id === profile.id ? { ...friend, ...profile } : friend
        ),
        selectedUser:
          state.selectedUser?.id === profile.id
            ? { ...state.selectedUser, ...profile }
            : state.selectedUser,
        backendLoading: false,
        error: null,
      }));
      return profile;
    } catch (error) {
      set({
        error: getVietnameseErrorMessage(error.message),
        backendLoading: false,
      });
      throw error;
    }
  },

  setOnlineStatus: async (isOnline) => {
    if (!hasSupabaseConfig) {
      return;
    }

    try {
      const profile = await updateOnlineStatus(isOnline);
      if (profile) {
        const accountRestriction = get().isAdminAccount
          ? null
          : getAccountRestriction(profile);
        set((state) => ({
          currentUser: withOwnStats(profile, state),
          accountRestriction,
          error: accountRestriction ? accountRestriction.message : null,
        }));
      }
    } catch (error) {
      // Presence updates are best-effort. Do not flash an app-wide error if the
      // browser loses connection while opening/closing the app.
    }
  },

  refreshFriendData: async () => {
    if (!hasSupabaseConfig) {
      set((state) => ({ ...applyFriendshipToState(state) }));
      return;
    }

    try {
      const snapshot = await fetchFriendshipSnapshot();
      set((state) => {
        const mappedFriends = snapshot.friends.map(mapFriendProfile);
        const nextState = {
          ...state,
          friends: mappedFriends,
          pendingRequests: snapshot.pendingRequests,
          sentRequests: snapshot.sentRequests,
          error: null,
          backendLoading: false,
        };

        return {
          currentUser: {
            ...nextState.currentUser,
            friends: mappedFriends.length,
          },
          friends: nextState.friends.map((friend) =>
            withFriendshipStatus(friend, nextState)
          ),
          pendingRequests: nextState.pendingRequests,
          sentRequests: nextState.sentRequests,
          users: nextState.users.map((user) =>
            withFriendshipStatus(user, nextState)
          ),
          selectedUser: withFriendshipStatus(nextState.selectedUser, nextState),
          error: null,
          backendLoading: false,
        };
      });
    } catch (error) {
      set({
        error: getVietnameseErrorMessage(error.message),
        backendLoading: false,
      });
    }
  },

  loadFriends: async () => get().refreshFriendData(),
  loadPendingRequests: async () => get().refreshFriendData(),

  requestFriend: async (receiverId) => {
    if (!hasSupabaseConfig) {
      return true;
    }

    const current = get();
    if (getFriendshipStatus(receiverId, current) !== 'none') {
      return true;
    }

    const tempRequest = {
      id: `local-${Date.now()}-${receiverId}`,
      sender_id: current.currentUser.id,
      receiver_id: receiverId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    set((state) => {
      const nextState = {
        ...state,
        sentRequests: [...state.sentRequests, tempRequest],
        friendActionLoading: {
          ...state.friendActionLoading,
          [receiverId]: true,
        },
        actionNotice: 'Đã gửi lời mời kết bạn.',
        error: null,
      };

      return {
        sentRequests: nextState.sentRequests,
        friendActionLoading: nextState.friendActionLoading,
        actionNotice: nextState.actionNotice,
        users: nextState.users.map((user) =>
          withFriendshipStatus(user, nextState)
        ),
        selectedUser: withFriendshipStatus(nextState.selectedUser, nextState),
        error: null,
      };
    });

    try {
      await sendFriendRequest(receiverId);
      await get().refreshFriendData();
      return true;
    } catch (error) {
      set((state) => {
        const nextState = {
          ...state,
          sentRequests: state.sentRequests.filter(
            (request) => request.id !== tempRequest.id
          ),
          friendActionLoading: {
            ...state.friendActionLoading,
            [receiverId]: false,
          },
          error: getVietnameseErrorMessage(error.message),
        };

        return {
          sentRequests: nextState.sentRequests,
          friendActionLoading: nextState.friendActionLoading,
          users: nextState.users.map((user) =>
            withFriendshipStatus(user, nextState)
          ),
          selectedUser: withFriendshipStatus(nextState.selectedUser, nextState),
          error: nextState.error,
        };
      });
      return false;
    } finally {
      set((state) => ({
        friendActionLoading: {
          ...state.friendActionLoading,
          [receiverId]: false,
        },
      }));
    }
  },

  acceptRequest: async (requestId) => {
    if (!hasSupabaseConfig) {
      return;
    }

    const request = get().pendingRequests.find(
      (item) => String(item.id) === String(requestId)
    );
    const senderProfile = request?.sender
      ? mapFriendProfile(request.sender)
      : null;
    const actionUserId = request?.sender_id || requestId;

    set((state) => {
      const nextFriends = senderProfile
        ? mergeUniqueById([...state.friends, senderProfile])
        : state.friends;
      const nextState = {
        ...state,
        friends: nextFriends,
        pendingRequests: state.pendingRequests.filter(
          (item) => String(item.id) !== String(requestId)
        ),
        sentRequests: state.sentRequests.filter(
          (item) => item.receiver_id !== actionUserId
        ),
        friendActionLoading: {
          ...state.friendActionLoading,
          [actionUserId]: true,
        },
        actionNotice: 'Hai bạn đã trở thành bạn bè.',
        error: null,
      };

      return {
        currentUser: {
          ...nextState.currentUser,
          friends: nextFriends.length,
        },
        friends: nextState.friends.map((friend) =>
          withFriendshipStatus(friend, nextState)
        ),
        pendingRequests: nextState.pendingRequests,
        sentRequests: nextState.sentRequests,
        friendActionLoading: nextState.friendActionLoading,
        actionNotice: nextState.actionNotice,
        users: nextState.users.map((user) =>
          withFriendshipStatus(user, nextState)
        ),
        selectedUser: withFriendshipStatus(nextState.selectedUser, nextState),
        error: null,
      };
    });

    try {
      await acceptFriendRequest(requestId);
      await get().refreshFriendData();
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message) });
      await get().refreshFriendData();
    } finally {
      set((state) => ({
        friendActionLoading: {
          ...state.friendActionLoading,
          [actionUserId]: false,
        },
      }));
    }
  },

  acceptRequestForUser: async (userId) => {
    const request = get().pendingRequests.find(
      (item) => item.sender_id === userId
    );
    if (request) {
      await get().acceptRequest(request.id);
    }
  },

  rejectRequest: async (requestId) => {
    if (!hasSupabaseConfig) {
      return;
    }

    const request = get().pendingRequests.find(
      (item) => String(item.id) === String(requestId)
    );
    const actionUserId = request?.sender_id || requestId;

    set((state) => {
      const nextState = {
        ...state,
        pendingRequests: state.pendingRequests.filter(
          (item) => String(item.id) !== String(requestId)
        ),
        friendActionLoading: {
          ...state.friendActionLoading,
          [actionUserId]: true,
        },
      };

      return {
        pendingRequests: nextState.pendingRequests,
        friendActionLoading: nextState.friendActionLoading,
        users: nextState.users.map((user) =>
          withFriendshipStatus(user, nextState)
        ),
        selectedUser: withFriendshipStatus(nextState.selectedUser, nextState),
      };
    });

    try {
      await rejectFriendRequest(requestId);
      await get().refreshFriendData();
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message) });
      await get().refreshFriendData();
    } finally {
      set((state) => ({
        friendActionLoading: {
          ...state.friendActionLoading,
          [actionUserId]: false,
        },
      }));
    }
  },

  removeFriendForUser: async (friendId) => {
    if (!friendId) {
      return false;
    }

    if (!hasSupabaseConfig) {
      set((state) => {
        const nextState = {
          ...state,
          friends: state.friends.filter((friend) => friend.id !== friendId),
          actionNotice: 'Đã xóa bạn bè.',
        };

        return {
          friends: nextState.friends.map((friend) =>
            withFriendshipStatus(friend, nextState)
          ),
          currentUser: {
            ...state.currentUser,
            friends: nextState.friends.length,
          },
          users: nextState.users.map((user) =>
            withFriendshipStatus(user, nextState)
          ),
          selectedUser: withFriendshipStatus(nextState.selectedUser, nextState),
          actionNotice: nextState.actionNotice,
        };
      });
      return true;
    }

    set((state) => ({
      friendActionLoading: { ...state.friendActionLoading, [friendId]: true },
      error: null,
    }));

    try {
      await removeFriend(friendId);
      set({ actionNotice: 'Đã xóa bạn bè.' });
      await get().refreshFriendData();
      return true;
    } catch (error) {
      set({ error: getVietnameseErrorMessage(error.message) });
      return false;
    } finally {
      set((state) => ({
        friendActionLoading: {
          ...state.friendActionLoading,
          [friendId]: false,
        },
      }));
    }
  },

  searchUsersByName: async (query, options = {}) => {
    const cleanQuery = String(query || '').trim();
    const limit = options.limit || 8;
    const offset = options.offset || 0;
    if (!cleanQuery) {
      return [];
    }

    const state = get();
    const localMatches = searchLocalProfiles(state, cleanQuery);

    if (!hasSupabaseConfig) {
      return localMatches.slice(offset, offset + limit);
    }

    const localSlice = localMatches.slice(offset, offset + limit);
    const remaining = limit - localSlice.length;
    if (remaining <= 0) {
      return localSlice;
    }

    set({ backendLoading: true, error: null });
    try {
      const localIds = new Set(localMatches.map((profile) => profile.id));
      const remoteOffset = Math.max(0, offset - localMatches.length);
      const profiles = await searchProfilesByName(cleanQuery, {
        limit: remaining + localMatches.length,
        offset: remoteOffset,
      });
      const latestState = get();
      const remoteResults = profiles
        .map((profile) => withFriendshipStatus(profile, latestState))
        .filter((profile) => profile?.id && !localIds.has(profile.id))
        .slice(0, remaining);
      const results = [...localSlice, ...remoteResults];
      set({ backendLoading: false, error: null });
      return results;
    } catch (error) {
      set({
        backendLoading: false,
        error: getVietnameseErrorMessage(error.message),
      });
      return [];
    }
  },
}));

export default useUserStore;
