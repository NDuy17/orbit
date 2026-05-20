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

function normalizeLocationUser(row, friendIds) {
  const profile = row.profile || {};
  const isFriend = friendIds.includes(row.user_id);
  const latitude = isFriend ? row.latitude : row.public_latitude || row.latitude;
  const longitude = isFriend ? row.longitude : row.public_longitude || row.longitude;

  return {
    id: row.user_id,
    name: profile.name || profile.full_name || 'NgÆ°á»i dÃ¹ng Orbit',
    avatar: profile.avatar_url || DEFAULT_AVATAR_URL,
    status: profile.status || 'Äang dÃ¹ng Orbit',
    bio: profile.bio || '',
    isOnline: Boolean(profile.is_online),
    lastActive: profile.is_online ? 'Đang online' : 'Offline',
    distance: row.distance || 0,
    isFriend,
    location: { latitude, longitude },
  };
}

export async function getDeviceLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    return currentLocation;
  }

  const location = await Location.getCurrentPositionAsync({});

  return mapLocationCoords(location);
}

export async function getFastDeviceLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    return currentLocation;
  }

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

export async function saveCurrentUserLocation({ userId, ghostMode, approximateLocation, coords }) {
  const client = requireSupabase();

  if (ghostMode) {
    await client
      .from('locations')
      .upsert(
        { user_id: userId, is_visible: false, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
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

  const { data, error } = await client
    .from('locations')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
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
      .select('id, name, full_name, avatar_url, bio, status, is_online, last_active')
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
