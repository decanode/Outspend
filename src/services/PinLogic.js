import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { toBase64, fromBase64 } from './BackupCrypto'

export const PIN_MIN = 4
export const PIN_MAX = 6
export const LOCK_GRACE_MS = 30 * 1000
const PIN_ITERATIONS = 20000

export const isValidPin = (pin) => /^\d{4,6}$/.test(pin || '')

/** Free tries, then 30 s, 1 min, 2 min ... capped at 30 min. */
export const lockoutMs = (failed) => (failed < 5 ? 0 : Math.min(30 * 60 * 1000, 30 * 1000 * 2 ** (failed - 5)))

export const hashPin = async (pin, saltB64) =>
  toBase64(await pbkdf2Async(sha256, new TextEncoder().encode(pin), fromBase64(saltB64), { c: PIN_ITERATIONS, dkLen: 32 }))

export const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Lock again when the app comes back after being in the background longer than the grace period. */
export const shouldLockOnResume = ({ enabled, backgroundedAt, now = Date.now(), graceMs = LOCK_GRACE_MS }) =>
  !!enabled && backgroundedAt !== null && backgroundedAt !== undefined && now - backgroundedAt >= graceMs
