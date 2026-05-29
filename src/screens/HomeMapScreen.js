import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AutoHideNotice from '../components/AutoHideNotice';
import GlassCard from '../components/GlassCard';
import LeafletMap from '../components/LeafletMap';
import MapUserGroupSheet from '../components/MapUserGroupSheet';
import RoutePlannerSheet from '../components/RoutePlannerSheet';
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
import {
  fetchRouteOptions,
  formatRouteDistance,
  formatRouteDuration,
  getAutoRerouteConfig,
  getRouteProgress,
  getRouteVehicle,
} from '../services/routeService';
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
  const autoRerouteRef = useRef({ coords: null, targetCoords: null, requestedAt: 0 });
  const autoRerouteInFlightRef = useRef(false);
  const navigationProgressRef = useRef({ routeId: null, coords: null, alongDistance: null });
  const [locationReady, setLocationReady] = useState(false);
  const [directionsTarget, setDirectionsTarget] = useState(null);
  const [routeStartLocation, setRouteStartLocation] = useState(null);
  const [routeVehicleId, setRouteVehicleId] = useState('motorbike');
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [routeWarning, setRouteWarning] = useState(null);
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [isMapAwayFromUser, setIsMapAwayFromUser] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [mapUsers, setMapUsers] = useState([]);
  const [selectedMapGroupUsers, setSelectedMapGroupUsers] = useState([]);
  const onlineFriendCount = friends.filter((friend) => friend.isOnline).length;
  const suggestionCount = users.filter(
    (user) => user.friendshipStatus !== 'friends' && !user.isFriend
  ).length;
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
  const selectedRoute = useMemo(
    () => routeOptions.find((route) => route.id === selectedRouteId) || routeOptions[0] || null,
    [routeOptions, selectedRouteId]
  );
  const selectedVehicle = useMemo(() => getRouteVehicle(routeVehicleId), [routeVehicleId]);
  const routePlan = useMemo(
    () =>
      directionsTarget
        ? {
            target: directionsTarget,
            routes: routeOptions,
            selectedRouteId: selectedRoute?.id || null,
            vehicleId: routeVehicleId,
            vehicleLabel: selectedVehicle.shortLabel,
            loading: routeLoading,
            error: routeError,
            navigationActive,
          }
        : null,
    [
      directionsTarget,
      navigationActive,
      routeError,
      routeLoading,
      routeOptions,
      routeVehicleId,
      selectedRoute,
      selectedVehicle.shortLabel,
    ]
  );

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
    if (!directionsTarget) {
      return;
    }

    const updatedTarget = users.find((user) => user.id === directionsTarget.id);
    const targetChanged =
      updatedTarget &&
      (updatedTarget.avatar !== directionsTarget.avatar ||
        updatedTarget.name !== directionsTarget.name ||
        updatedTarget.location?.latitude !== directionsTarget.location?.latitude ||
        updatedTarget.location?.longitude !== directionsTarget.location?.longitude);

    if (targetChanged) {
      setDirectionsTarget(updatedTarget);
    }
  }, [directionsTarget, users]);

  useEffect(() => {
    if (!directionsTarget || navigationActive) {
      return undefined;
    }

    let active = true;
    const startLocation = routeStartLocation || latestLocation.current || currentLocation;

    async function loadRoutes() {
      setRouteLoading(true);
      setRouteError(null);
      setRouteWarning(null);
      setRouteOptions([]);

      try {
        const result = await fetchRouteOptions({
          startLocation,
          targetLocation: directionsTarget.location,
          vehicleId: routeVehicleId,
        });

        if (!active) {
          return;
        }

        setRouteOptions(result.routes);
        setRouteWarning(result.warning);
        setSelectedRouteId(result.routes[0]?.id || null);
      } catch (err) {
        if (active) {
          const message = err.message || '';
          setRouteError(message.toLowerCase().includes('network') ? getVietnameseErrorMessage(message) : message);
          setSelectedRouteId(null);
        }
      } finally {
        if (active) {
          setRouteLoading(false);
        }
      }
    }

    loadRoutes();

    return () => {
      active = false;
    };
  }, [
    directionsTarget,
    navigationActive,
    routeStartLocation,
    routeVehicleId,
  ]);

  useEffect(() => {
    if (
      !navigationActive ||
      !directionsTarget ||
      !directionsTarget.location ||
      !selectedRoute ||
      !currentLocation
    ) {
      return undefined;
    }

    const config = getAutoRerouteConfig(routeVehicleId);
    const progress = getRouteProgress(currentLocation, selectedRoute);
    const lastProgress = navigationProgressRef.current;
    const hasProgressSample = lastProgress.routeId === selectedRoute.id && lastProgress.coords;
    const movedSinceProgress = hasProgressSample
      ? calculateCoordinateDistance(lastProgress.coords, currentLocation)
      : Infinity;
    const wentBackwards =
      hasProgressSample &&
      movedSinceProgress >= config.minMoveMeters &&
      Number.isFinite(progress.alongDistance) &&
      progress.alongDistance < lastProgress.alongDistance - config.backwardsMeters;

    if (!hasProgressSample || movedSinceProgress >= config.minMoveMeters) {
      navigationProgressRef.current = {
        routeId: selectedRoute.id,
        coords: currentLocation,
        alongDistance: progress.alongDistance,
      };
    }

    const lastReroute = autoRerouteRef.current;
    const now = Date.now();
    const movedSinceRequest = lastReroute.coords
      ? calculateCoordinateDistance(lastReroute.coords, currentLocation)
      : Infinity;
    const targetMoved = lastReroute.targetCoords
      ? calculateCoordinateDistance(lastReroute.targetCoords, directionsTarget.location)
      : Infinity;
    const offRoute = progress.distanceFromRoute > config.offRouteMeters;
    const targetRelocated = targetMoved > config.offRouteMeters;
    const shouldReroute = offRoute || wentBackwards || targetRelocated;
    const intervalReady = now - lastReroute.requestedAt >= config.minIntervalMs;
    const movementReady = movedSinceRequest >= config.minMoveMeters || targetRelocated;

    if (
      !shouldReroute ||
      !intervalReady ||
      !movementReady ||
      autoRerouteInFlightRef.current
    ) {
      return undefined;
    }

    let active = true;
    autoRerouteInFlightRef.current = true;
    autoRerouteRef.current = {
      coords: currentLocation,
      targetCoords: directionsTarget.location,
      requestedAt: now,
    };

    async function rerouteFromCurrentLocation() {
      setRouteLoading(true);
      setRouteError(null);
      setRouteWarning(
        wentBackwards
          ? 'Bạn đang đi sai hướng, Orbit đang tính lại tuyến.'
          : offRoute
            ? 'Bạn đã lệch khỏi tuyến, Orbit đang tính lại đường.'
            : 'Điểm đến đã đổi vị trí, Orbit đang cập nhật tuyến.'
      );

      try {
        const result = await fetchRouteOptions({
          startLocation: currentLocation,
          targetLocation: directionsTarget.location,
          vehicleId: routeVehicleId,
        });

        if (!active) {
          return;
        }

        const nextRoute = result.routes[0] || null;
        setRouteOptions(result.routes);
        setSelectedRouteId(nextRoute?.id || null);
        setRouteStartLocation(currentLocation);
        setRouteWarning(result.warning || 'Đã cập nhật tuyến theo vị trí hiện tại.');
        navigationProgressRef.current = {
          routeId: nextRoute?.id || null,
          coords: currentLocation,
          alongDistance: 0,
        };
      } catch (err) {
        if (active) {
          setRouteWarning('Chưa tính lại được tuyến mới, đang giữ tuyến hiện tại.');
        }
      } finally {
        setRouteLoading(false);
        autoRerouteInFlightRef.current = false;
      }
    }

    rerouteFromCurrentLocation();

    return () => {
      active = false;
    };
  }, [
    currentLocation,
    directionsTarget,
    navigationActive,
    routeVehicleId,
    selectedRoute,
  ]);

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

  const resetDirections = useCallback(() => {
    setDirectionsTarget(null);
    setRouteStartLocation(null);
    setRouteOptions([]);
    setSelectedRouteId(null);
    setRouteLoading(false);
    setRouteError(null);
    setRouteWarning(null);
    setRoutePlannerOpen(false);
    setNavigationActive(false);
    autoRerouteRef.current = { coords: null, targetCoords: null, requestedAt: 0 };
    autoRerouteInFlightRef.current = false;
    navigationProgressRef.current = { routeId: null, coords: null, alongDistance: null };
  }, []);

  const openDirectionsForUser = useCallback(
    (user) => {
      if (!user) {
        return;
      }

      const startLocation = latestLocation.current || currentLocation;
      setDirectionsTarget(user);
      setRouteStartLocation(startLocation);
      setRouteOptions([]);
      setSelectedRouteId(null);
      setRouteError(startLocation ? null : 'Chưa có vị trí hiện tại để dẫn đường.');
      setRouteWarning(null);
      setRoutePlannerOpen(true);
      setNavigationActive(false);
      autoRerouteRef.current = { coords: startLocation, targetCoords: user.location, requestedAt: Date.now() };
      autoRerouteInFlightRef.current = false;
      navigationProgressRef.current = { routeId: null, coords: null, alongDistance: null };
      setSelectedMapGroupUsers([]);
      clearSelectedUser();
    },
    [clearSelectedUser, currentLocation]
  );

  const handleSelectRoute = useCallback((routeId) => {
    if (routeId) {
      setSelectedRouteId(routeId);
    }
  }, []);

  const handleSelectVehicle = useCallback((vehicleId) => {
    setRouteVehicleId(vehicleId);
    setRouteStartLocation(latestLocation.current || currentLocation);
    setNavigationActive(false);
    setRoutePlannerOpen(true);
  }, [currentLocation]);

  const handleStartNavigation = useCallback(() => {
    if (!selectedRoute) {
      return;
    }

    setNavigationActive(true);
    setRoutePlannerOpen(false);
    setIsMapAwayFromUser(false);
    autoRerouteRef.current = {
      coords: latestLocation.current || currentLocation,
      targetCoords: directionsTarget?.location || null,
      requestedAt: Date.now(),
    };
    navigationProgressRef.current = {
      routeId: selectedRoute.id,
      coords: latestLocation.current || currentLocation,
      alongDistance: 0,
    };
    setRecenterKey((value) => value + 1);
  }, [currentLocation, directionsTarget, selectedRoute]);

  const handleRecenterOnUser = useCallback(() => {
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
        routePlan={routePlan}
        recenterKey={recenterKey}
        locationReady={mapLocationReady}
        onAwayFromUserChange={setIsMapAwayFromUser}
        onSelectUser={handleSelectUserFromMap}
        onSelectUserGroup={handleSelectUserGroupFromMap}
        onSelectRoute={handleSelectRoute}
      />

      <SafeAreaView style={styles.floating}>
        <AutoHideNotice>
          <GlassCard style={styles.topCard}>
            <Text style={styles.cardTitle}>Radar quanh bạn</Text>
            <View style={styles.metricsRow}>
              <Text style={styles.metricText}>{users.length} trên bản đồ</Text>
              <Text style={styles.metricText}>{suggestionCount} gợi ý tối đa 5km</Text>
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

      {directionsTarget && !routePlannerOpen ? (
        <SafeAreaView pointerEvents="box-none" style={styles.navigationFloating}>
          <GlassCard style={styles.navigationCard}>
            <View style={styles.navigationInfo}>
              <View style={styles.navigationTitleRow}>
                <Ionicons
                  name={navigationActive ? selectedVehicle.icon : 'navigate-outline'}
                  size={18}
                  color={colors.accent}
                />
                <Text style={styles.navigationEyebrow}>
                  {navigationActive ? selectedVehicle.shortLabel : 'Chọn tuyến'}
                </Text>
              </View>
              <Text style={styles.navigationTitle} numberOfLines={1}>
                {directionsTarget.name || 'Điểm đến'}
              </Text>
              <Text style={styles.navigationMeta} numberOfLines={1}>
                {selectedRoute
                  ? `${formatRouteDistance(selectedRoute.distance)} · ${formatRouteDuration(selectedRoute.duration)}`
                  : routeLoading
                    ? 'Đang tìm tuyến đường'
                    : routeError || 'Chưa có tuyến đường'}
              </Text>
            </View>
            <View style={styles.navigationActions}>
              <Pressable style={styles.navigationActionButton} onPress={() => setRoutePlannerOpen(true)}>
                <Ionicons name="map-outline" size={17} color={colors.accent} />
                <Text style={styles.navigationActionText}>{navigationActive ? 'Tuyến' : 'Mở'}</Text>
              </Pressable>
              <Pressable style={[styles.navigationActionButton, styles.navigationExitButton]} onPress={resetDirections}>
                <Ionicons name="close-circle-outline" size={17} color={colors.danger} />
                <Text style={[styles.navigationActionText, styles.navigationExitText]}>Thoát</Text>
              </Pressable>
            </View>
          </GlassCard>
        </SafeAreaView>
      ) : null}

      <MapUserGroupSheet
        users={selectedMapGroupUsers}
        onClose={() => setSelectedMapGroupUsers([])}
        onSelectUser={handleSelectUserFromGroup}
      />

      <RoutePlannerSheet
        visible={routePlannerOpen && Boolean(directionsTarget)}
        target={directionsTarget}
        vehicleId={routeVehicleId}
        routes={routeOptions}
        selectedRouteId={selectedRoute?.id || null}
        loading={routeLoading}
        error={routeError}
        warning={routeWarning}
        onClose={() => setRoutePlannerOpen(false)}
        onExit={resetDirections}
        onSelectVehicle={handleSelectVehicle}
        onSelectRoute={handleSelectRoute}
        onStart={handleStartNavigation}
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
        onDirections={() => selectedUser && openDirectionsForUser(selectedUser)}
        isDirectionsActive={directionsTarget?.id === selectedUser?.id}
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
  navigationFloating: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: Platform.OS === 'android' ? 86 : 78,
    pointerEvents: 'box-none',
  },
  navigationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  navigationInfo: {
    flex: 1,
    minWidth: 0,
  },
  navigationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navigationEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  navigationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },
  navigationMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  navigationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navigationActionButton: {
    minWidth: 68,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  navigationExitButton: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  navigationActionText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  navigationExitText: {
    color: colors.danger,
  },
});
