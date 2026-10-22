import { TRIAL_DAYS } from './Settings'

const DAY = 86400000
export const OFFLINE_GRACE_MS = 7 * DAY

/**
 * Pure access decision.
 *  entitled: true/false from the store, or null when the store could not be reached.
 */
export const computeAccess = ({ now = Date.now(), trialStartedAt, entitled, lastEntitledAt, trialDays = TRIAL_DAYS }) => {
  if (entitled === true) return { status: 'subscribed', trialDaysLeft: 0, hasAccess: true }
  if (entitled === null && lastEntitledAt && now - lastEntitledAt < OFFLINE_GRACE_MS) {
    return { status: 'subscribed', trialDaysLeft: 0, hasAccess: true } // offline grace
  }
  const started = trialStartedAt || now
  const left = Math.max(0, Math.ceil((started + trialDays * DAY - now) / DAY))
  return left > 0
    ? { status: 'trial', trialDaysLeft: left, hasAccess: true }
    : { status: 'expired', trialDaysLeft: 0, hasAccess: false }
}
