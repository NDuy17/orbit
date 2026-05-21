import * as Location from 'expo-location';
import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';
import { currentLocation } from '../data/mockLocations';
import { calculateCoordinateDistance } from '../utils/distance';
import { requireSupabase, supabase } from './supabase';

function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
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

function isMissingConflictTargetError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('no unique') ||
    message.includes('exclusion constraint') ||
    message.includes('on conflict')
  );
}

function getBaseLocationPayload(payload) {
  const { public_latitude, public_longitude, is_approximate, ...basePayload } = payload;

  if (is_approximate && public_latitude !== undefined && public_longitude !== undefined) {
    basePayload.latitude = public_latitude;
    basePayload.longitude = public_longitude;
  }

  return basePayload;
}

async function updateOrInsertLocation(client, payload) {
  const { data: existingRows, error: selectError } = await client
    .from('locations')
    .select('id')
    .eq('user_id', payload.user_id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (selectError) {
    throw selectError;
  }

  const existing = existingRows?.[0];

  if (existing?.id) {
    const { data, error } = await client
      .from('locations')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await client.from('locations').insert(payload).select().single();

  if (error) {
    throw error;
  }

  return data;
}

async function saveLocationPayload(client, payload) {
  let nextPayload = payload;
  let { data, error } = await client
    .from('locations')
    .upsert(nextPayload, { onConflict: 'user_id' })
    .select()
    .single();

  if (!error) {
    return data;
  }

  if (isMissingColumnError(error)) {
    nextPayload = getBaseLocationPayload(payload);
    const retry = await client
      .from('locations')
      .upsert(nextPayload, { onConflict: 'user_id' })
      .select()
      .single();

    data = retry.data;
    error = retry.error;

    if (!error) {
      return data;
    }
  }

  if (isMissingConflictTargetError(error)) {
    return updateOrInsertLocation(client, nextPayload);
  }

  throw error;
}

function normalizeLocationUser(row, friendIds) {
  const profile = row.profile || {};
  const isFriend = friendIds.includes(row.user_id);
  const latitude = isFriend ? row.latitude : row.public_latitude || row.latitude;
  const longitude = isFriend ? row.longitude : row.public_longitude || row.longitude;

  return {
    id: row.user_id,
    name: profile.full_name || profile.username || profile.name || 'Người dùng Orbit',
    avatar: profile.avatar_url || DEFAULT_AVATAR_URL,
    status: profile.status || 'Đang dùng Orbit',
    bio: profile.bio || '',
    isOnline: Boolean(profile.is_online),
    lastActive: profile.is_online ? 'Đang online' : 'Offline',
    distance: row.distance || 0,
    isFriend,
    location: { latitude, longitude },
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

export async function saveCurrentUserLocation({ userId, ghostMode, approximateLocation, coords }) {
  const client = requireSupabase();

  if (ghostMode) {
    await saveLocationPayload(client, {
      user_id: userId,
      is_visible: false,
      updated_at: new Date().toISOString(),
    });
    return null;
  }

  const location = coords || (await getDeviceLocation());
  const publicLatitude = approximateLocation ? roundCoordinate(location.latitude) : location.latitude;
  const publicLongitude = approximateLocation ? roundCoordinate(location.longitude) : location.longitude;

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

export async function fetchVisibleNearbyUsers({ currentUserId, currentCoords, radius, friendIds = [] }) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('locations')
    .select('*')
    .neq('user_id', currentUserId)
    .eq('is_visible', true);

  if (error) {
    throw error;
  }

  const profileIds = (data || []).map((row) => row.user_id).filter(Boolean);
  let profileMap = {};

  if (profileIds.length) {
    const { data: profiles, error: profileError } = await client
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio, status, is_online, last_active')
      .in('id', profileIds);

    if (profileError) {
      throw profileError;
    }

    profileMap = (profiles || []).reduce((items, profile) => {
      items[profile.id] = profile;
      return items;
    }, {});
  }

  return (data || [])
    .filter((row) => row.latitude && row.longitude)
    .map((row) => {
      const isFriend = friendIds.includes(row.user_id);
      const publicCoords = {
        latitude: row.public_latitude || row.latitude,
        longitude: row.public_longitude || row.longitude,
      };
      const displayCoords = isFriend
        ? { latitude: row.latitude, longitude: row.longitude }
        : publicCoords;
      const distance = calculateCoordinateDistance(currentCoords, displayCoords);

      return {
        ...normalizeLocationUser({ ...row, profile: profileMap[row.user_id] }, friendIds),
        distance: Math.round(distance),
        location: displayCoords,
      };
    })
    .filter((user) => user.distance <= radius);
}

export function subscribeToLocations(onChange) {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('locations:visible')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function createEncounterIfClose(userAId, userBId, coordsA, coordsB) {
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
