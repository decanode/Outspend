import { getInboxPage, isSmsAvailable } from '../native/Sms'
import { ingestMessages } from './TransactionManager'
import { hasSmsPermission } from './Permissions'
import { getSettings, updateSettings, DEFAULT_IMPORT_DAYS } from './Settings'
import { isTransactionalSender } from './RegexEngine'
import { checkCardLimits, notifyNeedsName } from './NotificationService'
import { afterChange, afterLiveCapture } from './PostChange'
import { logSkipped } from './SkippedLog'

const PAGE_SIZE = 500

// Writes are serialised so a burst of live SMS never races an import.
let queue = Promise.resolve()
const enqueue = (job) => {
  const run = queue.then(job, job)
  queue = run.catch(() => {})
  return run
}

/**
 * Import everything in the inbox dated >= sinceMs. Idempotent: every message has a
 * stable external_id, so overlapping ranges never create duplicates.
 */
export const importInboxSince = (sinceMs, { onProgress } = {}) =>
  enqueue(async () => {
    const totals = { created: 0, merged: 0, skipped: 0, scanned: 0 }
    if (!isSmsAvailable || !(await hasSmsPermission())) return totals

    let cursor = sinceMs
    let newest = 0
    for (;;) {
      const page = await getInboxPage(cursor, PAGE_SIZE)
      if (!page.length) break
      totals.scanned += page.length

      // Ignore chatter before the parser would; keeps batches small on big inboxes.
      const relevant = page.filter(m => isTransactionalSender(m.sender))
      const r = await ingestMessages(relevant)
      await logSkipped(r.skippedDetails)
      totals.created += r.created
      totals.merged += r.merged
      totals.skipped += r.skipped
      newest = Math.max(newest, page[page.length - 1].timestamp)
      if (onProgress) onProgress(totals)

      if (page.length < PAGE_SIZE) break
      // Same-timestamp pages would loop forever; step past them (re-reads are deduped anyway).
      cursor = page[page.length - 1].timestamp > cursor ? page[page.length - 1].timestamp : cursor + 1
    }

    if (newest) {
      const s = await getSettings()
      await updateSettings({ lastImportedTimestamp: Math.max(newest, s.lastImportedTimestamp || 0) })
    }
    if (totals.created || totals.merged) await afterChange() // quiet: no alerts for old history
    return totals
  })

/** First import after onboarding. */
export const importHistory = async ({ onProgress } = {}) => {
  const s = await getSettings()
  const since = s.onboardingStartDate || Date.now() - DEFAULT_IMPORT_DAYS * 86400000
  return importInboxSince(since, { onProgress })
}

/**
 * Delta sync from the last imported message. Doubles as the "daily audit": it picks up
 * SMS that arrived while the app was not running and any the live listener missed.
 */
export const syncInbox = async () => {
  const s = await getSettings()
  if (!s.isOnboarded) return null
  const since = s.lastImportedTimestamp
    ? s.lastImportedTimestamp - 60 * 1000 // small overlap; dedupe makes it safe
    : s.onboardingStartDate || Date.now() - DEFAULT_IMPORT_DAYS * 86400000
  const totals = await importInboxSince(since)
  await updateSettings({ lastAuditAt: Date.now() })
  return totals
}

/**
 * Handle one SMS that just arrived. Called by the headless task, which Android starts for
 * every incoming SMS, whether the app is open, in the background or closed.
 * Saves the transaction immediately; unknown payees trigger a "who was this to?" notification.
 */
export const handleIncomingSms = (msg) =>
  enqueue(async () => {
    if (!msg || !isTransactionalSender(msg.sender)) return null
    const settings = await getSettings()
    if (!settings.isOnboarded) return null

    const r = await ingestMessages([msg])
    await logSkipped(r.skippedDetails)
    if (r.created || r.merged) {
      await updateSettings({ lastImportedTimestamp: Math.max(msg.timestamp, settings.lastImportedTimestamp || 0) })
      await checkCardLimits().catch(e => console.error('Card limit check failed', e))
      await afterLiveCapture(r.createdTx)
    }
    for (const tx of r.needsReview) {
      await notifyNeedsName(tx).catch(e => console.error('Could not send notification', e))
    }
    return r
  })

/**
 * Add a message the user shared (iPhone share sheet). Same path as a received SMS, minus the sender
 * check. Returns the ingest result; created/merged are both 0 when the same message was added before.
 */
export const handleSharedText = (text, now = Date.now()) =>
  enqueue(async () => {
    const settings = await getSettings()
    if (!settings.isOnboarded) return null
    const r = await ingestMessages([{ sender: 'SHARED', body: text, timestamp: now, shared: true }])
    await logSkipped(r.skippedDetails)
    if (r.created || r.merged) await afterLiveCapture(r.createdTx)
    return r
  })
