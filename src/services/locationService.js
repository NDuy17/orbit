import * as Location from 'expo-location';
import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';
import { calculateCoordinateDistance } from '../utils/distance';
import { isRecentlyOnline } from '../utils/presence';
import { textOr } from '../utils/text';
import { requireSupabase, supabase } from './supabase';

const METERS_PER_DEGREE_LATITUDE = 111320;
const PUBLIC_LOCATION_PADDING_METERS = 150;
const MAX_SUGGESTION_RADIUS_METERS = 5000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

function hasCoordinatePair(value) {
  return value?.latitude != null && value?.longitude != null;
}

function uniqueUuidItems(items) {
  return [...new Set((items || []).filter((item) => isUuid(item)))];
}

function clampCoordinate(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCoordinateBounds(coords, radiusMeters) {
  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);
  const radius = Number(radiusMeters);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radius) ||
    radius <= 0
  ) {
    return null;
  }

  const paddedRadius = radius + PUBLIC_LOCATION_PADDING_METERS;
  const latitudeDelta = paddedRadius / METERS_PER_DEGREE_LATITUDE;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeScale = Math.max(Math.abs(Math.cos(latitudeRadians)), 0.01);
  const longitudeDelta =
    paddedRadius / (METERS_PER_DEGREE_LATITUDE * longitudeScale);

  return {
    minLatitude: clampCoordinate(latitude - latitudeDelta, -90, 90),
    maxLatitude: clampCoordinate(latitude + latitudeDelta, -90, 90),
    minLongitude: clampCoordinate(longitude - longitudeDelta, -180, 180),
    maxLongitude: clampCoordinate(longitude + longitudeDelta, -180, 180),
  };
}

function mapLocationCoords(location) {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };
}

async function ensureForegroundLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('LOCATION_PERMISSION_DENIED');
  }
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function getBaseLocationPayload(payload) {
  const { public_latitude, public_longitude, is_approximate, ...basePayload } =
    payload;

  if (
    is_approximate &&
    public_latitude !== undefined &&
    public_longitude !== undefined
  ) {
    basePayload.latitude = public_latitude;
    basePayload.longitude = public_longitude;
  }

  return basePayload;
}

async function updateOrInsertLocation(client, payload) {
  const { data: existingRows, error: selectError } = await client
    .from('locations')
    .select('user_id')
    .eq('user_id', payload.user_id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (selectError) {
    throw selectError;
  }

  if (existingRows?.length) {
    const { data, error } = await client
      .from('locations')
      .update(payload)
      .eq('user_id', payload.user_id)
      .select();

    if (error) {
      throw error;
    }

    return data?.[0] || null;
  }

  const { data, error } = await client
    .from('locations')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function saveLocationPayload(client, payload) {
  try {
    return await updateOrInsertLocation(client, payload);
  } catch (error) {
    if (isMissingColumnError(error)) {
      return updateOrInsertLocation(client, getBaseLocationPayload(payload));
    }

    throw error;
  }
}

function getLatestRowsByUserId(rows) {
  const getRowTime = (row) => {
    const time = new Date(row?.updated_at || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  };
  const latestRows = new Map();
  [...(rows || [])]
    .sort((first, second) => getRowTime(second) - getRowTime(first))
    .forEach((row) => {
      if (row?.user_id && !latestRows.has(row.user_id)) {
        latestRows.set(row.user_id, row);
      }
    });

  return Array.from(latestRows.values());
}

function normalizeLocationUser(row, friendIds) {
  const profile = row.profile || {};
  const isFriend = friendIds.includes(row.user_id);
  const exactLocation = row.location ||
    profile.location || {
      latitude: row.latitude,
      longitude: row.longitude,
    };
  const publicLocation = {
    latitude: row.public_latitude ?? exactLocation.latitude,
    longitude: row.public_longitude ?? exactLocation.longitude,
  };
  const displayLocation = isFriend ? exactLocation : publicLocation;
  const isOnline = isRecentlyOnline(profile.is_online, profile.last_active);

  return {
    id: row.user_id,
    name: textOr(
      profile.full_name || profile.username || profile.name,
      'Người dùng Orbit'
    ),
    avatar: profile.avatar_url || DEFAULT_AVATAR_URL,
    status: textOr(profile.status, 'Đang dùng Orbit'),
    bio: textOr(profile.bio, ''),
    isOnline,
    lastActiveAt: profile.last_active,
    lastActive: isOnline ? 'Đang online' : 'Offline',
    distance: row.distance || 0,
    isFriend,
    friends: row.friends_count || profile.friends_count || profile.friends || 0,
    met: row.encounters_count || profile.encounters_count || profile.met || 0,
    recent: row.recent_count || profile.recent_count || profile.recent || 0,
    location: displayLocation,
  };
}

export async function getDeviceLocation() {
  await ensureForegroundLocationPermission();

  const location = await Location.getCurrentPositionAsync({});

  return mapLocationCoords(location);
}

export async function getFastDeviceLocation() {
  await ensureForegroundLocationPermission();

  const lastKnownLocation = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 1500,
  });

  if (lastKnownLocation) {
    return mapLocationCoords(lastKnownLocation);
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return mapLocationCoords(location);
}

export async function watchDeviceLocation(onLocation, onError) {
  await ensureForegroundLocationPermission();

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      timeInterval: 3000,
    },
    (location) => {
      onLocation(mapLocationCoords(location));
    },
    onError
  );

  return () => subscription.remove();
}

export async function saveCurrentUserLocation({
  userId,
  ghostMode,
  approximateLocation,
  coords,
}) {
  const client = requireSupabase();

  if (!isUuid(userId)) {
    return null;
  }

  if (ghostMode) {
    await saveLocationPayload(client, {
      user_id: userId,
      is_visible: false,
      updated_at: new Date().toISOString(),
    });
    return null;
  }

  const location = coords || (await getDeviceLocation());
  const publicLatitude = approximateLocation
    ? roundCoordinate(location.latitude)
    : location.latitude;
  const publicLongitude = approximateLocation
    ? roundCoordinate(location.longitude)
    : location.longitude;

  // Location data is sensitive. Save exact coordinates only when RLS policies limit who can read them.
  const payload = {
    user_id: userId,
    latitude: location.latitude,
    longitude: location.longitude,
    public_latitude: publicLatitude,
    public_longitude: publicLongitude,
    is_visible: true,
    is_approximate: approximateLocation,
    updated_at: new Date().toISOString(),
  };

  return saveLocationPayload(client, payload);
}

export async function hideCurrentUserLocation(userId) {
  if (!isUuid(userId)) {
    return;
  }

  const client = requireSupabase();
  const { error } = await client
    .from('locations')
    .update({
      is_visible: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function fetchVisibleNearbyUsers({
  currentUserId,
  currentCoords,
  radius,
  friendIds = [],
}) {
  if (!isUuid(currentUserId)) {
    return [];
  }

  const client = requireSupabase();
  const suggestionRadius = Math.min(
    Number(radius) || MAX_SUGGESTION_RADIUS_METERS,
    MAX_SUGGESTION_RADIUS_METERS
  );
  const visibleFriendIds = uniqueUuidItems(friendIds).filter(
    (friendId) => friendId !== currentUserId
  );
  const bounds = getCoordinateBounds(currentCoords, suggestionRadius);
  let query = client
    .from('locations')
    .select('*')
    .neq('user_id', currentUserId)
    .eq('is_visible', true);

  if (bounds) {
    query = query
      .gte('public_latitude', bounds.minLatitude)
      .lte('public_latitude', bounds.maxLatitude)
      .gte('public_longitude', bounds.minLongitude)
      .lte('public_longitude', bounds.maxLongitude);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let friendLocations = [];
  if (visibleFriendIds.length) {
    const { data: friendData, error: friendError } = await client
      .from('locations')
      .select('*')
      .in('user_id', visibleFriendIds)
      .eq('is_visible', true);

    if (friendError) {
      throw friendError;
    }

    friendLocations = friendData || [];
  }

  const locationRows = getLatestRowsByUserId([
    ...(data || []),
    ...friendLocations,
  ]);
  const profileIds = locationRows.map((row) => row.user_id).filter(Boolean);
  let profileMap = {};

  if (profileIds.length) {
    const { data: profiles, error: profileError } = await client
      .from('profiles')
      .select('*')
      .in('id', profileIds);

    if (profileError) {
      throw profileError;
    }

    profileMap = (profiles || []).reduce((items, profile) => {
      items[profile.id] = profile;
      return items;
    }, {});
  }

  return locationRows
    .filter((row) => hasCoordinatePair(row))
    .map((row) => {
      const isFriend = friendIds.includes(row.user_id);
      const publicCoords = {
        latitude: row.public_latitude ?? row.latitude,
        longitude: row.public_longitude ?? row.longitude,
      };
      const displayCoords = isFriend
        ? { latitude: row.latitude, longitude: row.longitude }
        : publicCoords;
      const distance = calculateCoordinateDistance(
        currentCoords,
        displayCoords
      );

      return {
        ...normalizeLocationUser(
          { ...row, profile: profileMap[row.user_id] },
          friendIds
        ),
        distance: Math.round(distance),
        location: displayCoords,
      };
    })
    .filter((user) => user.isFriend || user.distance <= suggestionRadius);
}

export function subscribeToLocations(onChange) {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('locations:visible')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'locations' },
      onChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function createEncounterIfClose(
  userAId,
  userBId,
  coordsA,
  coordsB
) {
  const client = requireSupabase();
  const distance = calculateCoordinateDistance(coordsA, coordsB);

  if (distance > 50) {
    return null;
  }

  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const firstUserId = [userAId, userBId].sort()[0];
  const secondUserId = [userAId, userBId].sort()[1];

  const { data: recent, error: recentError } = await client
    .from('encounters')
    .select('id')
    .eq('user_a', firstUserId)
    .eq('user_b', secondUserId)
    .gte('happened_at', since)
    .maybeSingle();

  if (recentError) {
    throw recentError;
  }

  if (recent) {
    return recent;
  }

  const { data, error } = await client
    .from('encounters')
    .insert({
      user_a: firstUserId,
      user_b: secondUserId,
      distance_meters: Math.round(distance),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
