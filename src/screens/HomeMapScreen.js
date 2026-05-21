import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AutoHideNotice from '../components/AutoHideNotice';
import GlassCard from '../components/GlassCard';
import LeafletMap from '../components/LeafletMap';
import UserBottomSheet from '../components/UserBottomSheet';
import { clusterLocation, userTrails } from '../data/mockLocations';
import {
  fetchVisibleNearbyUsers,
  getDeviceLocation,
  getFastDeviceLocation,
  saveCurrentUserLocation,
  subscribeToLocations,
} from '../services/locationService';
import useLocationStore from '../store/locationStore';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

const emptyTrails = {};

function toMapUser(user) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    isOnline: user.isOnline,
    location: user.location,
  };
}

function areMapUsersEqual(nextUsers, currentUsers) {
  if (nextUsers.length !== currentUsers.length) {
    return false;
  }

  return nextUsers.every((user, index) => {
    const current = currentUsers[index];
    return (
      current &&
      user.id === current.id &&
      user.name === current.name &&
      user.avatar === current.avatar &&
      user.location?.latitude === current.location?.latitude &&
      user.location?.longitude === current.location?.longitude
    );
  });
}

export default function HomeMapScreen({ navigation }) {
  const {
    currentUser,
    users,
    friends,
    selectedUser,
    setUsers,
    setSelectedUser,
    clearSelectedUser,
    acceptRequestForUser,
    actionNotice,
    clearActionNotice,
    friendActionLoading,
    loadFriends,
    requestFriend,
    isBackendReady,
    error,
  } = useUserStore();
  const {
    currentLocation,
    radius,
    ghostMode,
    approximateLocation,
    locationLoading,
    locationError,
    setCurrentLocation,
    setLocationError,
    setLocationLoading,
  } = useLocationStore();
  const refreshTimer = useRef(null);
  const latestLocation = useRef(currentLocation);
  const [locationReady, setLocationReady] = useState(false);
  const [routeTarget, setRouteTarget] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [mapUsers, setMapUsers] = useState([]);
  const onlineFriendCount = friends.filter((friend) => friend.isOnline).length;
  const privacyLabel = ghostMode ? 'Ẩn vị trí' : approximateLocation ? 'Vị trí gần đúng' : 'Vị trí chính xác';
  const friendIdsKey = useMemo(
    () => friends.map((friend) => friend.id).filter(Boolean).sort().join('|'),
    [friends]
  );
  const friendIds = useMemo(() => (friendIdsKey ? friendIdsKey.split('|') : []), [friendIdsKey]);

  useEffect(() => {
    const nextMapUsers = users.map(toMapUser);
    setMapUsers((currentMapUsers) =>
      areMapUsersEqual(nextMapUsers, currentMapUsers) ? currentMapUsers : nextMapUsers
    );
  }, [users]);

  const handleSelectUserFromMap = useCallback(
    (mapUser) => {
      const fullUser = users.find((item) => item.id === mapUser?.id);
      setSelectedUser(fullUser || mapUser);
    },
    [setSelectedUser, users]
  );

  useEffect(() => {
    let active = true;

    async function centerMapOnUser() {
      setLocationLoading(true);
      setLocationError(null);
      try {
        const fastLocation = await getFastDeviceLocation();
        if (active) {
          latestLocation.current = fastLocation;
          setCurrentLocation(fastLocation);
          setLocationReady(true);
        }

        const accurateLocation = await getDeviceLocation();
        if (active) {
          latestLocation.current = accurateLocation;
          setCurrentLocation(accurateLocation);
        }
      } catch (err) {
        if (active) {
          setLocationReady(false);
          setLocationError(getVietnameseErrorMessage(err.message));
        }
      } finally {
        if (active) {
          setLocationLoading(false);
        }
      }
    }

    centerMapOnUser();

    return () => {
      active = false;
    };
  }, [retryKey, setCurrentLocation, setLocationError, setLocationLoading]);

  useEffect(() => {
    if (isBackendReady) {
      loadFriends();
    }
  }, [isBackendReady, loadFriends]);

  useEffect(() => {
    if (!actionNotice) {
      return undefined;
    }

    const timer = setTimeout(clearActionNotice, 2200);
    return () => clearTimeout(timer);
  }, [actionNotice, clearActionNotice]);

  useEffect(() => {
    if (!routeTarget) {
      return;
    }

    const updatedTarget = users.find((user) => user.id === routeTarget.id);
    const targetChanged =
      updatedTarget &&
      (updatedTarget.avatar !== routeTarget.avatar ||
        updatedTarget.name !== routeTarget.name ||
        updatedTarget.location?.latitude !== routeTarget.location?.latitude ||
        updatedTarget.location?.longitude !== routeTarget.location?.longitude);

    if (targetChanged) {
      setRouteTarget(updatedTarget);
    }
  }, [routeTarget, users]);

  useEffect(() => {
    if (!isBackendReady || !currentUser?.id || !locationReady) {
      return undefined;
    }

    let active = true;

    async function refreshLocations({ shouldSaveLocation = false } = {}) {
      try {
        const deviceLocation = latestLocation.current;
        if (!active) {
          return;
        }

        if (shouldSaveLocation) {
          await saveCurrentUserLocation({
            userId: currentUser.id,
            ghostMode,
            approximateLocation,
            coords: deviceLocation,
          });
        }

        const nearbyUsers = await fetchVisibleNearbyUsers({
          currentUserId: currentUser.id,
          currentCoords: deviceLocation,
          radius,
          friendIds,
        });

        if (active) {
          setUsers(nearbyUsers);
        }
      } catch (err) {
        setLocationError(getVietnameseErrorMessage(err.message));
      }
    }

    refreshLocations({ shouldSaveLocation: true });
    const unsubscribe = subscribeToLocations((payload) => {
      const changedUserId = payload?.new?.user_id || payload?.old?.user_id;
      if (changedUserId === currentUser.id) {
        return;
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        refreshLocations({ shouldSaveLocation: false });
      }, 800);
    });

    return () => {
      active = false;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      unsubscribe();
    };
  }, [
    approximateLocation,
    currentUser?.id,
    friendIds,
    friendIdsKey,
    ghostMode,
    isBackendReady,
    locationReady,
    radius,
    setLocationError,
    setUsers,
  ]);

  function handleFriendAction() {
    if (!selectedUser) {
      return;
    }

    if (selectedUser.friendshipStatus === 'friends') {
      navigation.navigate('Chat', { userId: selectedUser.id });
      return;
    }

    if (selectedUser.friendshipStatus === 'pending_received') {
      acceptRequestForUser(selectedUser.id);
      return;
    }

    if (!selectedUser.friendshipStatus || selectedUser.friendshipStatus === 'none') {
      requestFriend(selectedUser.id);
    }
  }

  return (
    <View style={styles.container}>
      <LeafletMap
        users={mapUsers}
        currentLocation={currentLocation}
        trails={isBackendReady ? emptyTrails : userTrails}
        clusterLocation={isBackendReady ? null : clusterLocation}
        routeTarget={routeTarget}
        onSelectUser={handleSelectUserFromMap}
      />

      <SafeAreaView style={styles.floating}>
        <GlassCard style={styles.topCard}>
          <Text style={styles.cardTitle}>Radar quanh bạn</Text>
          <View style={styles.metricsRow}>
            <Text style={styles.metricText}>{users.length} gần bạn</Text>
            <Text style={styles.metricText}>{onlineFriendCount} bạn online</Text>
            <Text style={styles.metricText}>{privacyLabel}</Text>
          </View>
          <Text style={styles.cardText}>
            {locationLoading ? 'Đang lấy vị trí của bạn...' : 'Đang quét quanh bạn...'}
          </Text>
        </GlassCard>

        {!isBackendReady ? (
          <AutoHideNotice delay={5600} style={styles.clusterNotice}>
            <GlassCard style={styles.clusterCard}>
              <Text style={styles.cardTitle}>{clusterLocation.title}</Text>
              <Text style={styles.cardText}>Một nhóm nhỏ đang hoạt động trong bán kính 500m.</Text>
            </GlassCard>
          </AutoHideNotice>
        ) : null}

        {locationError || error ? (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorText}>{locationError || error}</Text>
            {locationError ? (
              <Pressable style={styles.retryButton} onPress={() => setRetryKey((value) => value + 1)}>
                <Text style={styles.retryText}>Thử lại vị trí</Text>
              </Pressable>
            ) : null}
          </GlassCard>
        ) : null}
      </SafeAreaView>

      <UserBottomSheet
        user={selectedUser}
        onClose={clearSelectedUser}
        onProfile={() => navigation.navigate('UserProfile', { userId: selectedUser?.id })}
        onFriendAction={handleFriendAction}
        onDirections={() =>
          selectedUser &&
          setRouteTarget((currentTarget) => (currentTarget?.id === selectedUser.id ? null : selectedUser))
        }
        isDirectionsActive={routeTarget?.id === selectedUser?.id}
        isFriendActionLoading={Boolean(friendActionLoading[selectedUser?.id])}
        actionNotice={actionNotice}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  floating: {
    position: 'absolute',
    top: Platform.OS === 'android' ? spacing.md : 0,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.md,
    pointerEvents: 'box-none',
  },
  topCard: {
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metricText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  clusterCard: {
    alignSelf: 'flex-start',
    maxWidth: 260,
    paddingVertical: spacing.md,
  },
  clusterNotice: {
    alignSelf: 'flex-start',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
  errorCard: {
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  retryText: {
    color: colors.accent,
    fontWeight: '800',
  },
});
