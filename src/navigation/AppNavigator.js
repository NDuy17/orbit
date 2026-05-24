import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import ChatScreen from '../screens/ChatScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FriendsScreen from '../screens/FriendsScreen';
import HomeMapScreen from '../screens/HomeMapScreen';
import LoginScreen from '../screens/LoginScreen';
import NearbyScreen from '../screens/NearbyScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { subscribeToFriendRequests, subscribeToFriends } from '../services/friendService';
import { subscribeToProfiles } from '../services/profileService.js';
import useUserStore from '../store/userStore';
import useThemeStore from '../store/themeStore';
import colors from '../theme/colors';
import { blurActiveWebElement } from '../utils/focus';

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
  Profile: ['person-circle-outline', 'person-circle'],
};

function TabIcon({ routeName, color, focused }) {
  const [inactiveIcon, activeIcon] = TAB_ICONS[routeName] || TAB_ICONS.HomeMap;
  return <Ionicons name={focused ? activeIcon : inactiveIcon} size={routeName === 'Profile' ? 24 : 23} color={color} />;
}

function MainTabs() {
  const themeName = useThemeStore((state) => state.themeName);

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
    setOnlineStatus,
    updateProfilePresence,
    session,
  } = useUserStore();
  const [ready, setReady] = useState(false);
  const [initialRouteName, setInitialRouteName] = useState('Onboarding');
  const presenceRef = useRef(null);
  const navigationRef = useRef(null);
  const didResetNavigationRef = useRef(false);

  function resetToInitialRoute(routeName) {
    if (!navigationRef.current || didResetNavigationRef.current || !routeName) {
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
        setInitialRouteName(currentSession ? 'MainTabs' : 'Onboarding');
        setReady(true);
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [loadCurrentProfile, loadSession, refreshFriendData]);

  useEffect(() => {
    if (!session) {
      presenceRef.current = null;
      return undefined;
    }

    function syncPresence(isOnline) {
      if (presenceRef.current === isOnline) {
        return;
      }

      presenceRef.current = isOnline;
      setOnlineStatus(isOnline);
    }

    syncPresence(true);

    const subscription = AppState.addEventListener('change', (nextState) => {
      syncPresence(nextState === 'active');
    });

    function handleBeforeUnload() {
      syncPresence(false);
    }

    if (Platform.OS === 'web') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      subscription.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [session, setOnlineStatus]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    return subscribeToProfiles((payload) => {
      if (payload?.new) {
        updateProfilePresence(payload.new);
      }
    });
  }, [session, updateProfilePresence]);

  useEffect(() => {
    if (!session) {
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
  }, [refreshFriendData, session]);

  useEffect(() => {
    if (ready) {
      resetToInitialRoute(initialRouteName);
    }
  }, [initialRouteName, ready]);

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
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Tin nhắn' }} />
        <Stack.Screen name="UserProfile" component={ProfileScreen} options={{ title: 'Hồ sơ' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Chỉnh sửa hồ sơ' }} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Riêng tư' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Cài đặt' }} />
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
