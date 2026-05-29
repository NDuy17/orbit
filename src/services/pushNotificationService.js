import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { hasSupabaseConfig, supabase } from './supabase';

const PUSH_TOKEN_STORAGE_KEY = 'orbit.expoPushToken';
const DEFAULT_CHANNEL_ID = 'orbit-default';
const supportsNativePush = Platform.OS === 'android' || Platform.OS === 'ios';
const envProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

if (supportsNativePush) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function getConfiguredProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.expoConfig?.extra?.easProjectId ||
    Constants?.easConfig?.projectId ||
    envProjectId ||
    null
  );
}

function isMissingRegisterPushTokenRpcError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('register_push_token') ||
    (message.includes('function') && message.includes('not found'))
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Orbit',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#22D3EE',
  });
}

async function getCurrentUserId() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  return data.user?.id || null;
}

export async function registerForPushNotifications() {
  if (!hasSupabaseConfig || !supportsNativePush || !supabase) {
    return null;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  await ensureAndroidChannel();

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;
  if (finalStatus !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = getConfiguredProjectId();
  if (!projectId) {
    console.warn(
      'Orbit push notifications need EXPO_PUBLIC_EAS_PROJECT_ID or eas.projectId in app config.'
    );
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

  const { error: rpcError } = await supabase.rpc('register_push_token', {
    p_expo_push_token: token,
    p_platform: Platform.OS,
  });

  if (rpcError) {
    if (!isMissingRegisterPushTokenRpcError(rpcError)) {
      throw rpcError;
    }

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: Platform.OS,
        is_active: true,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' }
    );

    if (error) {
      throw error;
    }
  }

  return token;
}

export async function removeRegisteredPushToken() {
  if (!supabase) {
    return;
  }

  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) {
    return;
  }

  await supabase.from('push_tokens').delete().eq('expo_push_token', token);
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export function subscribeToPushNotificationResponses(onResponse) {
  if (!supportsNativePush) {
    return () => {};
  }

  const subscription =
    Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => subscription.remove();
}

export function subscribeToPushNotificationsReceived(onNotification) {
  if (!supportsNativePush) {
    return () => {};
  }

  const subscription =
    Notifications.addNotificationReceivedListener(onNotification);
  return () => subscription.remove();
}
