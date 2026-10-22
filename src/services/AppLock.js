import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import { getRandomBytes } from 'expo-crypto'
import { toBase64 } from './BackupCrypto'
import { hashPin, safeEqual, isValidPin, lockoutMs } from './PinLogic'
import { getSettings, updateSettings } from './Settings'

const PIN_KEY = 'outspend_pin'
const TRIES_KEY = 'outspend_pin_tries'

const read = async (key) => {
  try { return JSON.parse(await SecureStore.getItemAsync(key)) } catch { return null }
}

export const isLockEnabled = async () => {
  const s = await getSettings()
  return !!s.lockEnabled && !!(await read(PIN_KEY))
}

export const setPin = async (pin) => {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 to 6 digits.')
  const salt = toBase64(getRandomBytes(16))
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt, hash: await hashPin(pin, salt) }))
  await SecureStore.deleteItemAsync(TRIES_KEY)
  await updateSettings({ lockEnabled: true })
}

export const disableLock = async () => {
  await SecureStore.deleteItemAsync(PIN_KEY)
  await SecureStore.deleteItemAsync(TRIES_KEY)
  await updateSettings({ lockEnabled: false, lockBiometric: false })
}

/** @returns {Promise<{ ok: boolean, retryInMs: number }>} */
export const verifyPin = async (pin) => {
  const tries = (await read(TRIES_KEY)) || { failed: 0, lockedUntil: 0 }
  const wait = tries.lockedUntil - Date.now()
  if (wait > 0) return { ok: false, retryInMs: wait }

  const stored = await read(PIN_KEY)
  if (stored && safeEqual(await hashPin(pin, stored.salt), stored.hash)) {
    await SecureStore.deleteItemAsync(TRIES_KEY)
    return { ok: true, retryInMs: 0 }
  }
  const failed = tries.failed + 1
  const lock = lockoutMs(failed)
  await SecureStore.setItemAsync(TRIES_KEY, JSON.stringify({ failed, lockedUntil: lock ? Date.now() + lock : 0 }))
  return { ok: false, retryInMs: lock }
}

export const biometricAvailable = async () =>
  (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())

export const unlockWithBiometrics = async () => {
  const s = await getSettings()
  if (!s.lockBiometric || !(await biometricAvailable())) return false
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Outspend', cancelLabel: 'Use PIN' })
  return !!r.success
}
