import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { hasSupabaseConfig, supabase } from './supabase';

const PUSH_TOKEN_STORAGE_KEY = 'orbit.expoPushToken';
const DEFAULT_CHANNEL_ID = 'orbit-default';
const isExpoGoAndroid =
  Platform.OS === 'android' && Constants?.appOwnership === 'expo';
const supportsNativePush =
  (Platform.OS === 'android' || Platform.OS === 'ios') && !isExpoGoAndroid;
const envProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

let notificationsModulePromise = null;
let didSetNotificationHandler = false;

async function getNotificationsModule() {
  if (!supportsNativePush) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications');
  }

  const Notifications = await notificationsModulePromise;
  if (!didSetNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    didSetNotificationHandler = true;
  }

  return Notifications;
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

async function ensureAndroidChannel(Notifications) {
  if (Platform.OS !== 'android' || !Notifications) {
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

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  await ensureAndroidChannel(Notifications);

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

  let subscription = null;
  let cancelled = false;

  getNotificationsModule()
    .then((Notifications) => {
      if (!Notifications || cancelled) {
        return;
      }

      subscription =
        Notifications.addNotificationResponseReceivedListener(onResponse);
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    subscription?.remove();
  };
}

export function subscribeToPushNotificationsReceived(onNotification) {
  if (!supportsNativePush) {
    return () => {};
  }

  let subscription = null;
  let cancelled = false;

  getNotificationsModule()
    .then((Notifications) => {
      if (!Notifications || cancelled) {
        return;
      }

      subscription =
        Notifications.addNotificationReceivedListener(onNotification);
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    subscription?.remove();
  };
}
