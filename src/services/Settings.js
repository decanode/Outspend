import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'outspend:settings:v1'
export const DEFAULT_IMPORT_DAYS = 90
export const TRIAL_DAYS = 30

export const DEFAULT_SETTINGS = {
  isOnboarded: false,
  onboardingStartDate: null, // ms epoch: how far back the SMS import reaches
  trialStartedAt: null,
  lastEntitledAt: null, // last time Play confirmed an active subscription
  lastImportedTimestamp: null, // newest SMS timestamp processed
  lastAuditAt: null, // last time the daily audit ran
  smsPermission: false,
  dismissedSubscriptions: [], // keys of suggestions the user dismissed
  cardAlerts: {}, // cardId -> { cycle, level } already notified
  hasSeenSmsPrompt: false,
  lockEnabled: false, // app lock on (uses the phone's own screen lock)
  region: null, // country preset id (null = guess from the phone until chosen)
  currency: null, // only used for the "Other country" preset
  numberStyle: 'AUTO', // AUTO = follow the country; IN = 12,34,567; INTL = 1,234,567
  salarySource: null, // { key, merchant } once the user confirms who pays their salary: cycles start at those credits
  salaryDismissed: [], // merchant keys the user said are NOT salary
  salaryNudgedMonth: null, // 'YYYY-MM' of the last "has your salary arrived?" nudge
  alertsAnomaly: true, // unusual-spend and duplicate-charge alerts
  alertsBudget: true, // budget threshold alerts
  budgetAlerts: {}, // `${periodStart}:${budgetId}` -> level already notified
}

let cache = null

export const loadSettings = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    cache = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export const getSettings = async () => cache || loadSettings()

/** Synchronous read of the already-loaded settings (defaults before startup finishes). */
export const peekSettings = () => cache || DEFAULT_SETTINGS

export const updateSettings = async (patch) => {
  const current = await getSettings()
  cache = { ...current, ...patch }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache))
  } catch (e) {
    console.error('Failed to persist settings', e)
  }
  return cache
}

export const resetSettings = async () => {
  cache = { ...DEFAULT_SETTINGS }
  try {
    await AsyncStorage.removeItem(KEY)
  } catch { /* ignore */ }
  return cache
}
