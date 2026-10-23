import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import Plan from './src/screens/Plan'
import LockScreen from './src/components/LockScreen'
import Paywall from './src/screens/Paywall'
import Onboarding from './src/screens/Onboarding'
import ErrorBoundary from './src/components/ErrorBoundary'
import { AppContext } from './src/AppContext'
import { loadSettings, updateSettings, resetSettings } from './src/services/Settings'
import { getAccessState, ensureTrialStarted } from './src/services/BillingService'
// Importing BackgroundSync defines the background task at module scope, as the OS requires.
import { registerBackgroundSync } from './src/services/BackgroundSync'
import * as Notifications from 'expo-notifications'
import { refreshReminders, ensureNotificationSetup, handleNotificationResponse } from './src/services/NotificationService'
import { syncInbox } from './src/services/SmsIngest'
import { hasSmsPermission } from './src/services/Permissions'
import { isLockActive } from './src/services/AppLock'
import { shouldLockOnResume } from './src/services/LockLogic'
import { applyRegionSettings, guessRegionId } from './src/regions'
import { afterChange } from './src/services/PostChange'

const Tab = createBottomTabNavigator()

const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Ledger: ['list', 'list-outline'],
  Analytics: ['pie-chart', 'pie-chart-outline'],
  Plan: ['flag', 'flag-outline'],
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
  const [locked, setLocked] = useState(false)
  const [prefsVersion, setPrefsVersion] = useState(0)
  const [pendingSalary, setPendingSalary] = useState(null) // { merchant } when the "salary arrived?" notification was tapped
  const backgroundedAt = useRef(null)
  const [access, setAccess] = useState({ status: 'trial', trialDaysLeft: 30, hasAccess: true, enforced: false })

  const refreshAccess = useCallback(async () => setAccess(await getAccessState()), [])
  const bumpPrefs = useCallback(() => setPrefsVersion(v => v + 1), [])

  const restartOnboarding = useCallback(async () => {
    await resetSettings()
    setIsOnboarded(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const settings = await loadSettings()
      applyRegionSettings({ region: settings.region || guessRegionId(Intl.DateTimeFormat().resolvedOptions().locale), currency: settings.currency, numberStyle: settings.numberStyle })
      if (settings.isOnboarded) await ensureTrialStarted()
      const nextAccess = await getAccessState()
      const mustLock = settings.isOnboarded && (await isLockActive())
      if (cancelled) return
      setLocked(mustLock)
      setIsOnboarded(settings.isOnboarded)
      setAccess(nextAccess)
      setIsReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Everything that touches SMS only runs once the user has onboarded. Live messages arrive
  // through the SmsReceivedTask (index.js); here we only catch up on anything missed.
  useEffect(() => {
    if (!isReady || !isOnboarded) return
    ;(async () => {
      await registerBackgroundSync()
      await ensureNotificationSetup()
      if (await hasSmsPermission()) await syncInbox()
      await refreshReminders()
      await afterChange() // pair transfers, check budgets, refresh the widget
    })().catch(e => console.error('Startup tasks failed', e))
  }, [isReady, isOnboarded])

  // Replies typed into the "who was this to?" notification (live, or the one that launched the app).
  useEffect(() => {
    if (!isOnboarded) return undefined
    const process = async (response) => {
      try {
        if (await handleNotificationResponse(response)) {
          await Notifications.clearLastNotificationResponseAsync()
        } else if (response && response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          const data = response.notification.request.content.data
          if (data && data.salaryMissing) {
            setPendingSalary({ merchant: data.merchant || '' })
            await Notifications.clearLastNotificationResponseAsync()
          }
        }
      } catch (e) {
        console.error('Notification reply failed', e)
      }
    }
    Notifications.getLastNotificationResponseAsync().then(process)
    const sub = Notifications.addNotificationResponseReceivedListener(process)
    return () => sub.remove()
  }, [isOnboarded])

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

  // Lock again when the app returns after more than 30 seconds in the background.
  useEffect(() => {
    if (!isOnboarded) return undefined
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now()
        return
      }
      const since = backgroundedAt.current
      backgroundedAt.current = null
      if (state === 'active' && shouldLockOnResume({ enabled: await isLockActive(), backgroundedAt: since })) setLocked(true)
    })
    return () => sub.remove()
  }, [isOnboarded])

  const clearPendingSalary = useCallback(() => setPendingSalary(null), [])
  const ctx = useMemo(
    () => ({ access, refreshAccess, restartOnboarding, bumpPrefs, pendingSalary, clearPendingSalary }),
    [access, refreshAccess, restartOnboarding, bumpPrefs, pendingSalary, clearPendingSalary]
  )

  let content
  if (!isReady) {
    content = <Splash />
  } else if (locked) {
    content = <LockScreen onUnlock={() => setLocked(false)} />
  } else if (!isOnboarded) {
    content = <Onboarding onComplete={async () => { await updateSettings({ isOnboarded: true }); setIsOnboarded(true); refreshAccess() }} />
  } else if (access.enforced && !access.hasAccess) {
    content = <Paywall />
  } else {
    content = (
      <NavigationContainer theme={navTheme} key={prefsVersion}>
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
          <Tab.Screen name="Plan" component={Plan} />
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
