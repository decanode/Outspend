export const LOCK_GRACE_MS = 30 * 1000

/** Lock again when the app comes back after being in the background longer than the grace period. */
export const shouldLockOnResume = ({ enabled, backgroundedAt, now = Date.now(), graceMs = LOCK_GRACE_MS }) =>
  !!enabled && backgroundedAt !== null && backgroundedAt !== undefined && now - backgroundedAt >= graceMs

/**
 * Authentication errors that mean "this phone cannot ask": it has no screen lock set (or lost
 * it after the app lock was turned on). We must not lock the user out in that case.
 */
export const isUnenforceable = (error) => ['passcode_not_set', 'not_enrolled', 'not_available'].includes(error)
