import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

export default function HomeMapScreen({ navigation }) {
  const {
    currentUser,
    users,
    friends,
    selectedUser,
    setUsers,
    setSelectedUser,
    clearSelectedUser,
    requestFriend,
    loadFriends,
    isBackendReady,
    error,
  } = useUserStore();
  const {
    currentLocation,
    radius,
    ghostMode,
    approximateLocation,
    locationError,
    setCurrentLocation,
    setLocationError,
  } = useLocationStore();
  const refreshTimer = useRef(null);
  const latestLocation = useRef(currentLocation);
  const [locationReady, setLocationReady] = useState(false);
  const [routeTarget, setRouteTarget] = useState(null);
  const mapUsersKey = users
    .map(
      (user) =>
        `${user.id}:${user.name}:${user.avatar}:${user.location?.latitude}:${user.location?.longitude}`
    )
    .join('|');
  const mapUsers = useMemo(() => users.map((user) => ({ ...user })), [mapUsersKey]);

  useEffect(() => {
    let active = true;

    async function centerMapOnUser() {
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
        setLocationError(getVietnameseErrorMessage(err.message));
      }
    }

    centerMapOnUser();

    return () => {
      active = false;
    };
  }, [setCurrentLocation, setLocationError]);

  useEffect(() => {
    if (isBackendReady) {
      loadFriends();
    }
  }, [isBackendReady, loadFriends]);

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
    const friendIds = friends.map((friend) => friend.id);

    async function refreshLocations({ shouldSaveLocation = false } = {}) {
      try {
        const deviceLocation = latestLocation.current;
        if (!active) {
          return;
        }

        if (shouldSaveLocation) {
          latestLocation.current = deviceLocation;
          setCurrentLocation(deviceLocation);
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

        if (!active) {
          return;
        }

        setUsers(nearbyUsers);
      } catch (err) {
        setUsers([]);
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
    friends,
    ghostMode,
    isBackendReady,
    locationReady,
    radius,
    setCurrentLocation,
    setLocationError,
    setUsers,
  ]);

  return (
    <View style={styles.container}>
      <LeafletMap
        users={mapUsers}
        currentLocation={currentLocation}
        trails={isBackendReady ? emptyTrails : userTrails}
        clusterLocation={isBackendReady ? null : clusterLocation}
        routeTarget={routeTarget}
        onSelectUser={setSelectedUser}
      />
      <SafeAreaView style={styles.floating}>
        <AutoHideNotice>
          <GlassCard style={styles.topCard}>
            <Text style={styles.cardTitle}>Radar quanh bạn</Text>
            <Text style={styles.cardText}>
              {isBackendReady ? `${users.length} người thật đang hiển thị` : 'Đang dùng dữ liệu mẫu'}
            </Text>
          </GlassCard>
        </AutoHideNotice>
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
          </GlassCard>
        ) : null}
      </SafeAreaView>
      <UserBottomSheet
        user={selectedUser}
        onClose={clearSelectedUser}
        onChat={() => navigation.navigate('Chat', { userId: selectedUser?.id })}
        onProfile={() => navigation.navigate('UserProfile', { userId: selectedUser?.id })}
        onAddFriend={() => selectedUser && requestFriend(selectedUser.id)}
        onDirections={() =>
          selectedUser &&
          setRouteTarget((currentTarget) =>
            currentTarget?.id === selectedUser.id ? null : selectedUser
          )
        }
        isDirectionsActive={routeTarget?.id === selectedUser?.id}
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
    marginTop: 4,
  },
  errorCard: {
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
});
