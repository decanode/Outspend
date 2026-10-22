import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './src/theme/designSystem';

import Dashboard from './src/screens/Dashboard';
import Ledger from './src/screens/Ledger';
import Analytics from './src/screens/Analytics';
import Accounts from './src/screens/Accounts';
import Settings from './src/screens/Settings';
import Paywall from './src/screens/Paywall';
import Onboarding from './src/screens/Onboarding';
import { checkEntitlement } from './src/services/BillingService';
import { registerBackgroundSync } from './src/services/BackgroundSync';
import { scheduleSubscriptionReminders } from './src/services/NotificationService';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false); // In reality, fetch from AsyncStorage
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function initApp() {
      // Register background jobs
      await registerBackgroundSync();
      await scheduleSubscriptionReminders();

      // Check billing entitlement
      const access = await checkEntitlement();
      setHasAccess(access); // For testing, you might want to hardcode to true
      setIsReady(true);
    }
    initApp();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.emerald} />
      </View>
    );
  }

  // If user hasn't completed onboarding, show it
  if (!isOnboarded) {
    return <Onboarding onComplete={() => setIsOnboarded(true)} />;
  }

  // If user has onboarded but trial expired (no access), show Paywall
  // Note: Un-comment this in production, for now, we'll let it pass if hasAccess is false for dev
  // if (!hasAccess) {
  //   return <Paywall />;
  // }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.background,
            borderTopColor: COLORS.cardBorder,
          },
          tabBarActiveTintColor: COLORS.emerald,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'Ledger') iconName = focused ? 'list' : 'list-outline';
            else if (route.name === 'Analytics') iconName = focused ? 'pie-chart' : 'pie-chart-outline';
            else if (route.name === 'Accounts') iconName = focused ? 'wallet' : 'wallet-outline';
            else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={Dashboard} />
        <Tab.Screen name="Ledger" component={Ledger} />
        <Tab.Screen name="Analytics" component={Analytics} />
        <Tab.Screen name="Accounts" component={Accounts} />
        <Tab.Screen name="Settings" component={Settings} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
