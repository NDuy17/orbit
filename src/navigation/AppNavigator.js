import React, { useEffect, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from '../screens/ChatScreen';
import FriendsScreen from '../screens/FriendsScreen';
import HomeMapScreen from '../screens/HomeMapScreen';
import LoginScreen from '../screens/LoginScreen';
import NearbyScreen from '../screens/NearbyScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { subscribeToProfiles } from '../services/profileService';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';

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

function TabIcon({ icon, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cardStrong,
          borderTopColor: colors.line,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="HomeMap"
        component={HomeMapScreen}
        options={{ title: 'Bản đồ', tabBarIcon: ({ focused }) => <TabIcon icon="◎" focused={focused} /> }}
      />
      <Tab.Screen
        name="Nearby"
        component={NearbyScreen}
        options={{ title: 'Gần đây', tabBarIcon: ({ focused }) => <TabIcon icon="⌖" focused={focused} /> }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ title: 'Bạn bè', tabBarIcon: ({ focused }) => <TabIcon icon="◌" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Hồ sơ', tabBarIcon: ({ focused }) => <TabIcon icon="●" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { loadSession, loadCurrentProfile, setOnlineStatus, updateProfilePresence, session } = useUserStore();
  const [ready, setReady] = useState(false);
  const [initialRouteName, setInitialRouteName] = useState('Onboarding');

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = await loadSession();
      if (session) {
        await loadCurrentProfile();
      }

      if (active) {
        setInitialRouteName(session ? 'MainTabs' : 'Onboarding');
        setReady(true);
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [loadCurrentProfile, loadSession]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    setOnlineStatus(true);

    const subscription = AppState.addEventListener('change', (nextState) => {
      setOnlineStatus(nextState === 'active');
    });

    function handleBeforeUnload() {
      setOnlineStatus(false);
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

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        key={initialRouteName}
        initialRouteName={initialRouteName}
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
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Riêng tư' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
