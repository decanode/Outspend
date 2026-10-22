import { getInboxPage, subscribeToSms, isSmsAvailable } from '../native/Sms'
import { ingestMessages } from './TransactionManager'
import { hasSmsPermission } from './Permissions'
import { getSettings, updateSettings, DEFAULT_IMPORT_DAYS } from './Settings'
import { isTransactionalSender } from './RegexEngine'
import { checkCardLimits } from './NotificationService'

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

/** Start the live listener. Returns a function that stops it. */
export const startLiveSmsListener = () =>
  subscribeToSms((msg) => {
    if (!msg || !isTransactionalSender(msg.sender)) return
    enqueue(async () => {
      try {
        const r = await ingestMessages([msg])
        if (r.created || r.merged) {
          const s = await getSettings()
          await updateSettings({ lastImportedTimestamp: Math.max(msg.timestamp, s.lastImportedTimestamp || 0) })
          checkCardLimits().catch(() => {})
        }
      } catch (e) {
        console.error('Live SMS ingest failed', e)
      }
    })
  })
