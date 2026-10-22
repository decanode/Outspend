import * as LocalAuthentication from 'expo-local-authentication'
import { getSettings, updateSettings } from './Settings'
import { isUnenforceable } from './LockLogic'

// The app has no PIN of its own. It asks Android to verify the user with the phone's screen
// lock: fingerprint/face, or the phone's PIN, pattern or password. Nothing new to remember,
// and Android handles retries and lockouts.

/** Does this phone have a screen lock (or biometrics) set up? */
export const deviceLockAvailable = async () =>
  (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE

/**
 * Show the system prompt. @returns {Promise<{ ok: boolean, unenforceable?: boolean, error?: string }>}
 */
export const authenticate = async (message = 'Unlock Outspend') => {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: message,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false, // allow the phone's PIN/pattern/password, not just biometrics
  })
  if (r.success) return { ok: true }
  return { ok: false, error: r.error, unenforceable: isUnenforceable(r.error) }
}

/** Lock only applies while the switch is on AND the phone still has a screen lock. */
export const isLockActive = async () => {
  const s = await getSettings()
  return !!s.lockEnabled && (await deviceLockAvailable())
}

/** @returns {Promise<'on'|'no_device_lock'|'cancelled'>} */
export const enableLock = async () => {
  if (!(await deviceLockAvailable())) return 'no_device_lock'
  const r = await authenticate('Confirm to turn on app lock')
  if (!r.ok) return 'cancelled'
  await updateSettings({ lockEnabled: true })
  return 'on'
}

/** Turning it off needs the phone's lock too, so a borrowed unlocked phone cannot disable it. */
export const disableLock = async () => {
  const r = await authenticate('Confirm to turn off app lock')
  if (!r.ok && !r.unenforceable) return false
  await updateSettings({ lockEnabled: false })
  return true
}
