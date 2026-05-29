import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AutoHideNotice from '../components/AutoHideNotice';
import GlassCard from '../components/GlassCard';
import LeafletMap from '../components/LeafletMap';
import MapUserGroupSheet from '../components/MapUserGroupSheet';
import UserBottomSheet from '../components/UserBottomSheet';
import { clusterLocation, userTrails } from '../data/mockLocations';
import {
  fetchVisibleNearbyUsers,
  getFastDeviceLocation,
  hideCurrentUserLocation,
  saveCurrentUserLocation,
  subscribeToLocations,
  watchDeviceLocation,
} from '../services/locationService';
import useLocationStore from '../store/locationStore';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { calculateCoordinateDistance } from '../utils/distance';
import { getVietnameseErrorMessage } from '../utils/errorMessages';

const emptyTrails = {};
const locationSaveDistanceMeters = 10;
const locationSaveIntervalMs = 15000;

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
    isAdminAccount,
    loadAdminStatus,
    error,
    session,
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
  const lastLocationSaveRef = useRef({ coords: null, modeKey: null, savedAt: 0 });
  const latestLocation = useRef(currentLocation);
  const [locationReady, setLocationReady] = useState(false);
  const [routeTarget, setRouteTarget] = useState(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [isMapAwayFromUser, setIsMapAwayFromUser] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [mapUsers, setMapUsers] = useState([]);
  const [selectedMapGroupUsers, setSelectedMapGroupUsers] = useState([]);
  const onlineFriendCount = friends.filter((friend) => friend.isOnline).length;
  const privacyLabel = isAdminAccount
    ? 'Chế độ admin'
    : ghostMode
      ? 'Ẩn vị trí'
      : approximateLocation
        ? 'Vị trí gần đúng'
        : 'Vị trí chính xác';
  const mapCurrentLocation = isAdminAccount ? null : currentLocation;
  const mapLocationReady = isAdminAccount ? false : locationReady;
  const backendUserId = isBackendReady ? session?.user?.id : null;
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
      setSelectedMapGroupUsers([]);
      setSelectedUser(fullUser || mapUser);
    },
    [setSelectedUser, users]
  );

  const handleSelectUserGroupFromMap = useCallback(
    (groupUsers) => {
      const fullGroupUsers = groupUsers
        .map((mapUser) => users.find((item) => item.id === mapUser?.id) || mapUser)
        .filter(Boolean);

      if (fullGroupUsers.length === 1) {
        setSelectedMapGroupUsers([]);
        setSelectedUser(fullGroupUsers[0]);
        return;
      }

      clearSelectedUser();
      setSelectedMapGroupUsers(fullGroupUsers);
    },
    [clearSelectedUser, setSelectedUser, users]
  );

  const handleSelectUserFromGroup = useCallback(
    (user) => {
      setSelectedMapGroupUsers([]);
      setSelectedUser(user);
    },
    [setSelectedUser]
  );

  useEffect(() => {
    let active = true;
    let stopWatching = null;

    if (isAdminAccount) {
      latestLocation.current = null;
      setLocationReady(false);
      setLocationLoading(false);
      setLocationError(null);
      return undefined;
    }

    function applyDeviceLocation(location) {
      latestLocation.current = location;
      setCurrentLocation(location);
      setLocationReady(true);
    }

    async function centerMapOnUser() {
      setLocationLoading(true);
      setLocationError(null);
      try {
        const fastLocation = await getFastDeviceLocation();
        if (active) {
          applyDeviceLocation(fastLocation);
        }

        const unsubscribeDeviceLocation = await watchDeviceLocation(
          (nextLocation) => {
            if (active) {
              applyDeviceLocation(nextLocation);
            }
          },
          (reason) => {
            if (active) {
              setLocationError(getVietnameseErrorMessage(reason));
            }
          }
        );

        if (active) {
          stopWatching = unsubscribeDeviceLocation;
        } else {
          unsubscribeDeviceLocation();
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
      stopWatching?.();
    };
  }, [isAdminAccount, retryKey, setCurrentLocation, setLocationError, setLocationLoading]);

  useEffect(() => {
    if (backendUserId) {
      loadAdminStatus();
    }
  }, [backendUserId, loadAdminStatus]);

  useEffect(() => {
    if (backendUserId) {
      loadFriends();
    }
  }, [backendUserId, loadFriends]);

  useEffect(() => {
    if (!backendUserId || !isAdminAccount) {
      return;
    }

    setUsers([]);
    hideCurrentUserLocation(backendUserId).catch(() => {});
  }, [backendUserId, isAdminAccount, setUsers]);

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
    if (!backendUserId || !locationReady || isAdminAccount) {
      return undefined;
    }

    let active = true;

    async function refreshLocations() {
      try {
        const deviceLocation = latestLocation.current;
        if (!active) {
          return;
        }

        const now = Date.now();
        const modeKey = `${ghostMode}:${approximateLocation}`;
        const lastSave = lastLocationSaveRef.current;
        const movedDistance = lastSave.coords
          ? calculateCoordinateDistance(lastSave.coords, deviceLocation)
          : Infinity;
        const shouldSaveLocation =
          lastSave.modeKey !== modeKey ||
          now - lastSave.savedAt >= locationSaveIntervalMs ||
          movedDistance >= locationSaveDistanceMeters;

        if (shouldSaveLocation) {
          await saveCurrentUserLocation({
            userId: backendUserId,
            ghostMode,
            approximateLocation,
            coords: deviceLocation,
          });

          lastLocationSaveRef.current = {
            coords: deviceLocation,
            modeKey,
            savedAt: now,
          };
        }

        const nearbyUsers = await fetchVisibleNearbyUsers({
          currentUserId: backendUserId,
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

    refreshLocations();

    return () => {
      active = false;
    };
  }, [
    approximateLocation,
    backendUserId,
    currentLocation,
    friendIds,
    friendIdsKey,
    ghostMode,
    isAdminAccount,
    isBackendReady,
    locationReady,
    radius,
    setLocationError,
    setUsers,
  ]);

  useEffect(() => {
    if (!backendUserId || !locationReady || isAdminAccount) {
      return undefined;
    }

    let active = true;

    async function refreshNearbyUsers() {
      try {
        const nearbyUsers = await fetchVisibleNearbyUsers({
          currentUserId: backendUserId,
          currentCoords: latestLocation.current,
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

    const unsubscribe = subscribeToLocations((payload) => {
      const changedUserId = payload?.new?.user_id || payload?.old?.user_id;
      if (changedUserId === backendUserId) {
        return;
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(refreshNearbyUsers, 800);
    });

    return () => {
      active = false;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      unsubscribe();
    };
  }, [
    backendUserId,
    friendIds,
    friendIdsKey,
    isAdminAccount,
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

  const handleRecenterOnUser = useCallback(() => {
    setRouteTarget(null);
    setIsMapAwayFromUser(false);
    setRecenterKey((value) => value + 1);
  }, []);

  return (
    <View style={styles.container}>
      <LeafletMap
        users={mapUsers}
        currentLocation={mapCurrentLocation}
        trails={isBackendReady ? emptyTrails : userTrails}
        clusterLocation={isBackendReady ? null : clusterLocation}
        routeTarget={routeTarget}
        recenterKey={recenterKey}
        locationReady={mapLocationReady}
        onAwayFromUserChange={setIsMapAwayFromUser}
        onSelectUser={handleSelectUserFromMap}
        onSelectUserGroup={handleSelectUserGroupFromMap}
      />

      <SafeAreaView style={styles.floating}>
        <AutoHideNotice>
          <GlassCard style={styles.topCard}>
            <Text style={styles.cardTitle}>Radar quanh bạn</Text>
            <View style={styles.metricsRow}>
              <Text style={styles.metricText}>{users.length} gần bạn</Text>
              <Text style={styles.metricText}>{onlineFriendCount} bạn online</Text>
              <Text style={styles.metricText}>{privacyLabel}</Text>
            </View>
            <Text style={styles.cardText}>
              {locationLoading
                ? 'Đang lấy vị trí của bạn...'
                : isAdminAccount
                  ? 'Tài khoản admin không chia sẻ vị trí trên bản đồ người dùng.'
                  : locationReady
                  ? 'Bản đồ đã sẵn sàng'
                  : 'Đang chuẩn bị bản đồ...'}
            </Text>
          </GlassCard>
        </AutoHideNotice>

        {!isBackendReady ? (
          <AutoHideNotice style={styles.clusterNotice}>
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

      {isMapAwayFromUser && !isAdminAccount ? (
        <SafeAreaView pointerEvents="box-none" style={styles.recenterFloating}>
          <Pressable style={styles.recenterButton} onPress={handleRecenterOnUser}>
            <Text style={styles.recenterText}>Về vị trí của tôi</Text>
          </Pressable>
        </SafeAreaView>
      ) : null}

      <MapUserGroupSheet
        users={selectedMapGroupUsers}
        onClose={() => setSelectedMapGroupUsers([])}
        onSelectUser={handleSelectUserFromGroup}
      />

      <UserBottomSheet
        user={selectedUser}
        onClose={() => {
          setSelectedMapGroupUsers([]);
          clearSelectedUser();
        }}
        onProfile={() => navigation.navigate('UserProfile', { userId: selectedUser?.id })}
        onReport={() =>
          selectedUser &&
          navigation.navigate('ReportUser', {
            userId: selectedUser.id,
            userName: selectedUser.name,
          })
        }
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
  recenterFloating: {
    position: 'absolute',
    right: spacing.lg,
    bottom: Platform.OS === 'android' ? spacing.xl : spacing.lg,
    pointerEvents: 'box-none',
  },
  recenterButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  recenterText: {
    color: colors.background,
    fontWeight: '900',
  },
});
