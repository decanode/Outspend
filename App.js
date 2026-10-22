import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, ActivityIndicator, AppState } from 'react-native'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from './src/theme/designSystem'

import Dashboard from './src/screens/Dashboard'
import Ledger from './src/screens/Ledger'
import Analytics from './src/screens/Analytics'
import Accounts from './src/screens/Accounts'
import Settings from './src/screens/Settings'
import Paywall from './src/screens/Paywall'
import Onboarding from './src/screens/Onboarding'
import ErrorBoundary from './src/components/ErrorBoundary'
import { AppContext } from './src/AppContext'
import { loadSettings, updateSettings, resetSettings } from './src/services/Settings'
import { getAccessState, ensureTrialStarted } from './src/services/BillingService'
// Importing BackgroundSync defines the background task at module scope, as the OS requires.
import { registerBackgroundSync } from './src/services/BackgroundSync'
import { refreshReminders } from './src/services/NotificationService'
import { startLiveSmsListener, syncInbox } from './src/services/SmsIngest'
import { hasSmsPermission } from './src/services/Permissions'

const Tab = createBottomTabNavigator()

const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Ledger: ['list', 'list-outline'],
  Analytics: ['pie-chart', 'pie-chart-outline'],
  Accounts: ['wallet', 'wallet-outline'],
  Settings: ['settings', 'settings-outline'],
}

const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: COLORS.background, card: COLORS.background, border: COLORS.cardBorder } }

const Splash = () => (
  <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color={COLORS.emerald} />
  </View>
)

export default function App() {
  const [isReady, setIsReady] = useState(false)
  const [isOnboarded, setIsOnboarded] = useState(false)
  const [access, setAccess] = useState({ status: 'trial', trialDaysLeft: 30, hasAccess: true, enforced: false })

  const refreshAccess = useCallback(async () => setAccess(await getAccessState()), [])

  const restartOnboarding = useCallback(async () => {
    await resetSettings()
    setIsOnboarded(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const settings = await loadSettings()
      if (settings.isOnboarded) await ensureTrialStarted()
      const nextAccess = await getAccessState()
      if (cancelled) return
      setIsOnboarded(settings.isOnboarded)
      setAccess(nextAccess)
      setIsReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Everything that touches SMS only runs once the user has onboarded.
  useEffect(() => {
    if (!isReady || !isOnboarded) return undefined
    let stopListener = () => {}
    ;(async () => {
      await registerBackgroundSync()
      if (await hasSmsPermission()) {
        stopListener = startLiveSmsListener()
        await syncInbox() // catches anything that arrived while the app was closed
      }
      await refreshReminders()
    })().catch(e => console.error('Startup tasks failed', e))
    return () => stopListener()
  }, [isReady, isOnboarded])

  // Returning to the app: pick up missed SMS and re-check billing.
  useEffect(() => {
    if (!isOnboarded) return undefined
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return
      try {
        if (await hasSmsPermission()) await syncInbox()
        await refreshAccess()
      } catch (e) {
        console.error('Resume tasks failed', e)
      }
    })
    return () => sub.remove()
  }, [isOnboarded, refreshAccess])

  const ctx = useMemo(() => ({ access, refreshAccess, restartOnboarding }), [access, refreshAccess, restartOnboarding])

  let content
  if (!isReady) {
    content = <Splash />
  } else if (!isOnboarded) {
    content = <Onboarding onComplete={async () => { await updateSettings({ isOnboarded: true }); setIsOnboarded(true); refreshAccess() }} />
  } else if (access.enforced && !access.hasAccess) {
    content = <Paywall />
  } else {
    content = (
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: { backgroundColor: COLORS.background, borderTopColor: COLORS.cardBorder },
            tabBarActiveTintColor: COLORS.emerald,
            tabBarInactiveTintColor: COLORS.textSecondary,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Home" component={Dashboard} />
          <Tab.Screen name="Ledger" component={Ledger} />
          <Tab.Screen name="Analytics" component={Analytics} />
          <Tab.Screen name="Accounts" component={Accounts} />
          <Tab.Screen name="Settings" component={Settings} />
        </Tab.Navigator>
      </NavigationContainer>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ErrorBoundary>
        <AppContext.Provider value={ctx}>{content}</AppContext.Provider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
