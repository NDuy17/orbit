import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AccountRestrictedScreen from '../screens/AccountRestrictedScreen';
import ChatScreen from '../screens/ChatScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import FriendsScreen from '../screens/FriendsScreen';
import HomeMapScreen from '../screens/HomeMapScreen';
import LoginScreen from '../screens/LoginScreen';
import NearbyScreen from '../screens/NearbyScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ReportUserScreen from '../screens/ReportUserScreen';
import SettingsScreen from '../screens/SettingsScreen';
import {
  subscribeToFriendRequests,
  subscribeToFriends,
} from '../services/friendService';
import { subscribeToAllMessages } from '../services/messageService';
import { subscribeToNotifications } from '../services/notificationService';
import { subscribeToProfiles } from '../services/profileService.js';
import {
  registerForPushNotifications,
  subscribeToPushNotificationsReceived,
  subscribeToPushNotificationResponses,
} from '../services/pushNotificationService';
import useMessageStore from '../store/messageStore';
import useNotificationStore from '../store/notificationStore';
import useUserStore from '../store/userStore';
import useThemeStore from '../store/themeStore';
import colors from '../theme/colors';
import { blurActiveWebElement } from '../utils/focus';
import { PRESENCE_HEARTBEAT_MS } from '../utils/presence';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.line,
    primary: colors.accent,
  },
};

function OrbitLoading() {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingOrbit}>
        <View style={styles.loadingRing} />
        <View style={styles.loadingPlanet} />
      </View>
      <Text style={styles.loadingTitle}>Orbit</Text>
      <Text style={styles.loadingText}>Đang đồng bộ quỹ đạo của bạn...</Text>
    </View>
  );
}

const TAB_ICONS = {
  HomeMap: ['map-outline', 'map'],
  Nearby: ['chatbubble-ellipses-outline', 'chatbubble-ellipses'],
  Friends: ['people-outline', 'people'],
  Notifications: ['notifications-outline', 'notifications'],
  Profile: ['person-circle-outline', 'person-circle'],
};

function TabIcon({ routeName, color, focused }) {
  const [inactiveIcon, activeIcon] = TAB_ICONS[routeName] || TAB_ICONS.HomeMap;
  return (
    <Ionicons
      name={focused ? activeIcon : inactiveIcon}
      size={routeName === 'Profile' ? 24 : 23}
      color={color}
    />
  );
}

function MainTabs() {
  const themeName = useThemeStore((state) => state.themeName);
  const messageUnreadCount = useMessageStore((state) => state.unreadCount);
  const notificationCount = useNotificationStore(
    (state) => state.unreadCount
  );
  const messageBadge =
    messageUnreadCount > 99 ? '99+' : messageUnreadCount || undefined;
  const notificationBadge =
    notificationCount > 99 ? '99+' : notificationCount || undefined;

  return (
    <Tab.Navigator
      key={`tabs-${themeName}`}
      screenListeners={{
        tabPress: blurActiveWebElement,
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
      }}
    >
      <Tab.Screen
        name="HomeMap"
        component={HomeMapScreen}
        options={{
          title: 'Bản đồ',
          tabBarIcon: (props) => <TabIcon routeName="HomeMap" {...props} />,
        }}
      />
      <Tab.Screen
        name="Nearby"
        component={NearbyScreen}
        options={{
          title: 'Tin nhắn',
          tabBarBadge: messageBadge,
          tabBarBadgeStyle: styles.tabBadge,
          tabBarIcon: (props) => <TabIcon routeName="Nearby" {...props} />,
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          title: 'Bạn bè',
          tabBarIcon: (props) => <TabIcon routeName="Friends" {...props} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Thông báo',
          tabBarBadge: notificationBadge,
          tabBarBadgeStyle: styles.tabBadge,
          tabBarIcon: (props) => (
            <TabIcon routeName="Notifications" {...props} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Hồ sơ',
          tabBarIcon: (props) => <TabIcon routeName="Profile" {...props} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const themeName = useThemeStore((state) => state.themeName);
  const {
    loadSession,
    loadCurrentProfile,
    refreshFriendData,
    refreshPresenceStatus,
    setOnlineStatus,
    updateProfilePresence,
    session,
    accountRestriction,
  } = useUserStore();
  const [ready, setReady] = useState(false);
  const [initialRouteName, setInitialRouteName] = useState('Onboarding');
  const presenceRef = useRef(null);
  const navigationRef = useRef(null);
  const didResetNavigationRef = useRef(false);
  const loadMessageConversations = useMessageStore(
    (state) => state.loadConversations
  );
  const resetMessages = useMessageStore((state) => state.resetMessages);
  const loadNotifications = useNotificationStore(
    (state) => state.loadNotifications
  );
  const resetNotifications = useNotificationStore(
    (state) => state.resetNotifications
  );

  function resetToInitialRoute(routeName, force = false) {
    if (
      !navigationRef.current ||
      (!force && didResetNavigationRef.current) ||
      !routeName
    ) {
      return;
    }

    didResetNavigationRef.current = true;
    blurActiveWebElement();
    navigationRef.current.reset({
      index: 0,
      routes: [{ name: routeName }],
    });
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const currentSession = await loadSession();
      if (currentSession) {
        await loadCurrentProfile();
        await refreshFriendData();
      }

      if (active) {
        const restriction = useUserStore.getState().accountRestriction;
        setInitialRouteName(
          restriction
            ? 'AccountRestricted'
            : currentSession
              ? 'MainTabs'
              : 'Onboarding'
        );
        setReady(true);
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [loadCurrentProfile, loadSession, refreshFriendData]);

  useEffect(() => {
    if (!session || accountRestriction) {
      presenceRef.current = null;
      return undefined;
    }

    let heartbeatId = null;

    function stopHeartbeat() {
      if (heartbeatId) {
        globalThis.clearInterval(heartbeatId);
        heartbeatId = null;
      }
    }

    function startHeartbeat() {
      if (heartbeatId) {
        return;
      }

      heartbeatId = globalThis.setInterval(() => {
        setOnlineStatus(true);
        refreshPresenceStatus();
      }, PRESENCE_HEARTBEAT_MS);
    }

    function syncPresence(isOnline, force = false) {
      if (presenceRef.current === isOnline && !force) {
        if (isOnline) {
          startHeartbeat();
        }
        return;
      }

      presenceRef.current = isOnline;
      setOnlineStatus(isOnline);

      if (isOnline) {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    }

    syncPresence(true);

    const subscription = AppState.addEventListener('change', (nextState) => {
      syncPresence(nextState === 'active');
    });

    function handleBeforeUnload() {
      syncPresence(false, true);
    }

    function handleVisibilityChange() {
      syncPresence(!document.hidden);
    }

    if (Platform.OS === 'web') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stopHeartbeat();
      subscription.remove();
      if (presenceRef.current) {
        setOnlineStatus(false);
        presenceRef.current = false;
      }
      if (Platform.OS === 'web') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange
        );
      }
    };
  }, [accountRestriction, refreshPresenceStatus, session, setOnlineStatus]);

  useEffect(() => {
    if (!session || accountRestriction) {
      return undefined;
    }

    registerForPushNotifications().catch(() => {});

    return subscribeToProfiles((payload) => {
      if (payload?.new) {
        updateProfilePresence(payload.new);
      }
    });
  }, [accountRestriction, session, updateProfilePresence]);

  useEffect(() => {
    if (!session || accountRestriction) {
      return undefined;
    }

    const reloadFriends = () => {
      refreshFriendData();
    };
    const unsubscribeRequests = subscribeToFriendRequests(reloadFriends);
    const unsubscribeFriends = subscribeToFriends(reloadFriends);

    return () => {
      unsubscribeRequests();
      unsubscribeFriends();
    };
  }, [accountRestriction, refreshFriendData, session]);

  useEffect(() => {
    if (!session || accountRestriction) {
      resetMessages();
      return undefined;
    }

    let refreshTimer = null;

    function refreshMessagesSoon() {
      if (refreshTimer) {
        globalThis.clearTimeout(refreshTimer);
      }

      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;
        loadMessageConversations({
          silent: true,
          currentUserId: session.user?.id,
        });
      }, 250);
    }

    loadMessageConversations({ currentUserId: session.user?.id });

    const unsubscribeMessages = subscribeToAllMessages(
      session.user?.id,
      refreshMessagesSoon
    );
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active') {
          refreshMessagesSoon();
        }
      }
    );

    return () => {
      if (refreshTimer) {
        globalThis.clearTimeout(refreshTimer);
      }
      unsubscribeMessages();
      appStateSubscription.remove();
    };
  }, [
    accountRestriction,
    loadMessageConversations,
    resetMessages,
    session,
  ]);

  useEffect(() => {
    if (!session || accountRestriction) {
      resetNotifications();
      return undefined;
    }

    let refreshTimer = null;

    function refreshNotificationsSoon() {
      if (refreshTimer) {
        globalThis.clearTimeout(refreshTimer);
      }

      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;
        loadNotifications({ silent: true, userId: session.user?.id });
      }, 250);
    }

    loadNotifications({ userId: session.user?.id });

    const unsubscribeRealtime = subscribeToNotifications(
      refreshNotificationsSoon,
      session.user?.id
    );
    const unsubscribeFriendRequests = subscribeToFriendRequests(
      refreshNotificationsSoon
    );
    const unsubscribePushReceived = subscribeToPushNotificationsReceived(
      refreshNotificationsSoon
    );
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active') {
          refreshNotificationsSoon();
        }
      }
    );

    return () => {
      if (refreshTimer) {
        globalThis.clearTimeout(refreshTimer);
      }
      unsubscribeRealtime();
      unsubscribeFriendRequests();
      unsubscribePushReceived();
      appStateSubscription.remove();
    };
  }, [accountRestriction, loadNotifications, resetNotifications, session]);

  useEffect(() => {
    if (!session || accountRestriction) {
      return undefined;
    }

    return subscribeToPushNotificationResponses((response) => {
      loadNotifications({ silent: true, userId: session.user?.id });
      const targetScreen =
        response?.notification?.request?.content?.data?.screen;
      if (targetScreen === 'Friends' || targetScreen === 'FriendRequests') {
        navigationRef.current?.navigate('MainTabs', {
          screen: 'Friends',
          params: {
            showRequests: true,
            requestFocusNonce: Date.now(),
          },
        });
        return;
      }

      if (targetScreen === 'Notifications') {
        navigationRef.current?.navigate('MainTabs', {
          screen: 'Notifications',
        });
      }
    });
  }, [accountRestriction, loadNotifications, session]);

  useEffect(() => {
    if (ready) {
      resetToInitialRoute(initialRouteName);
    }
  }, [initialRouteName, ready]);

  useEffect(() => {
    if (ready && accountRestriction) {
      resetToInitialRoute('AccountRestricted', true);
    }
  }, [accountRestriction, ready]);

  if (!ready) {
    return <OrbitLoading />;
  }

  const themedNavigation = {
    ...navigationTheme,
    colors: {
      ...navigationTheme.colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.line,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer
      key={`nav-${themeName}`}
      ref={navigationRef}
      theme={themedNavigation}
      onReady={() => resetToInitialRoute(initialRouteName)}
      onStateChange={blurActiveWebElement}
    >
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenListeners={{
          transitionStart: blurActiveWebElement,
        }}
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AccountRestricted"
          component={AccountRestrictedScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: 'Tin nhắn' }}
        />
        <Stack.Screen
          name="UserProfile"
          component={ProfileScreen}
          options={{ title: 'Hồ sơ' }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: 'Chỉnh sửa hồ sơ' }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{ title: 'Riêng tư' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Cài đặt' }}
        />
        <Stack.Screen
          name="Feedback"
          component={FeedbackScreen}
          options={{ title: 'Gửi góp ý' }}
        />
        <Stack.Screen
          name="ReportUser"
          component={ReportUserScreen}
          options={{ title: 'Báo cáo người dùng' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.cardStrong,
    borderTopColor: colors.line,
    height: 60,
    paddingTop: 5,
    paddingBottom: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  tabIcon: {
    marginTop: 2,
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingOrbit: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  loadingPlanet: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  loadingText: {
    color: colors.muted,
    marginTop: 8,
    textAlign: 'center',
  },
});
