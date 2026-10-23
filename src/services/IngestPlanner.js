import { analyzeSms } from './RegexEngine'
import { smsExternalId } from '../utils/hash'
import { categorize } from './RuleEngine'
import { looksLikeTransfer } from './TransferDetector'
import { homeCurrency } from '../regions'

export const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000
export const REFUND_LINK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const MERGEABLE_SOURCES = ['MANUAL', 'VOICE']

/**
 * Pure planning step for SMS ingestion. Given raw messages and a snapshot of
 * existing state, decide which transactions to create and which to upgrade.
 * Keeping this free of database calls makes it unit-testable and lets the
 * caller commit everything in a single batch.
 *
 * ctx = { rules, accounts, cards, existing }
 *   existing: [{ id, external_id, amount, type, timestamp, source, merchant }]
 *
 * Returns { creates: [draft], updates: [{ id, patch }], skipped: n, skippedDetails: [...] }
 * skippedDetails lists messages that mention money but were not turned into a transaction (with the
 * reason), so the user can review them. One-time codes and messages with no amount are not listed.
 * Drafts get a temporary `tempId` so refunds can reference debits created in the same batch.
 */
export const planIngest = (messages, ctx) => {
  const rules = ctx.rules || []
  const accounts = ctx.accounts || []
  const cards = ctx.cards || []
  const existing = [...(ctx.existing || [])]
  const seenExternal = new Set(existing.map(e => e.external_id).filter(Boolean))
  const mergedIds = new Set()

  const creates = []
  const updates = []
  let skipped = 0
  const skippedDetails = []
  let tempCounter = 0

  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)

  for (const msg of sorted) {
    const analysis = analyzeSms(msg.sender, msg.body, msg.timestamp, undefined, { shared: !!msg.shared })
    if (!analysis.tx) {
      skipped++
      if (analysis.amount && analysis.reject !== 'otp' && analysis.reject !== 'not_bank_sender') {
        skippedDetails.push({
          id: msg.shared ? smsExternalId('SHARED', 0, msg.body) : smsExternalId(msg.sender, msg.timestamp, msg.body),
          sender: msg.sender,
          timestamp: msg.timestamp,
          body: (msg.body || '').slice(0, 300),
          reason: analysis.reject,
          amount: analysis.amount,
          currency: analysis.currency,
        })
      }
      continue
    }
    const parsed = analysis.tx
    if (seenExternal.has(parsed.external_id)) { skipped++; continue }

    const cat = categorize(parsed, rules)
    const card = parsed.last4 ? cards.find(c => c.last4 && c.last4 === parsed.last4) : null
    const account = !card && parsed.last4 ? accounts.find(a => a.last4 && a.last4 === parsed.last4) : null

    // Smart merge: a manual/voice entry for the same amount around the same time
    // is the same purchase. Upgrade it instead of creating a duplicate.
    if (parsed.type === 'DEBIT') {
      const match = existing.find(e =>
        MERGEABLE_SOURCES.includes(e.source) &&
        !mergedIds.has(e.id) &&
        !e.is_deleted &&
        e.type === 'DEBIT' &&
        e.amount === parsed.amount &&
        Math.abs(e.timestamp - parsed.timestamp) <= DEDUPE_WINDOW_MS
      )
      if (match) {
        mergedIds.add(match.id)
        seenExternal.add(parsed.external_id)
        const patch = {
          source: 'VERIFIED_SMS',
          raw_text: parsed.raw_text,
          external_id: parsed.external_id,
          last4: parsed.last4,
          payment_mode: parsed.payment_mode,
        }
        if (parsed.merchant !== 'Unknown Vendor') patch.merchant = cat.merchant
        if (cat.category) patch.category = cat.category
        updates.push({ id: match.id, patch })
        match.source = 'VERIFIED_SMS'
        continue
      }
    }

    const tempId = `tmp_${tempCounter++}`
    const draft = {
      tempId,
      amount: parsed.amount,
      merchant: cat.merchant,
      type: parsed.type,
      timestamp: parsed.timestamp,
      category: cat.category,
      source: 'SMS',
      raw_text: parsed.raw_text,
      external_id: parsed.external_id,
      needs_review: cat.needs_review,
      merchant_rule_id: cat.merchant_rule_id,
      last4: parsed.last4,
      payment_mode: parsed.payment_mode,
      currency: parsed.currency && parsed.currency !== homeCurrency() ? parsed.currency : null,
      account_id: account ? account.id : null,
      card_id: card ? card.id : null,
      linked_transaction_id: null,
      transfer: looksLikeTransfer(`${parsed.merchant} ${parsed.raw_text}`) ? 'AUTO' : null,
    }

    if (parsed.type === 'REFUND') {
      const original = findRefundTarget(draft, existing, creates)
      if (original) {
        draft.linked_transaction_id = original.id || original.tempId
        if (!draft.category) draft.category = original.category || null
        draft.account_id = draft.account_id || original.account_id || null
        draft.card_id = draft.card_id || original.card_id || null
      }
    }

    seenExternal.add(parsed.external_id)
    creates.push(draft)
    existing.push({ ...draft, id: tempId })
  }

  return { creates, updates, skipped, skippedDetails }
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Find the most recent earlier DEBIT that a refund most plausibly reverses:
 * same merchant (when both known) and an amount no smaller than the refund,
 * within 30 days. Falls back to an exact-amount match for unknown merchants.
 */
export const findRefundTarget = (refund, existing, drafts = []) => {
  const pool = [...existing, ...drafts.map(d => ({ ...d, id: d.tempId }))]
  const unknown = !refund.merchant || refund.merchant === 'Unknown Vendor'
  const candidates = pool
    .filter(t =>
      t.type === 'DEBIT' &&
      !t.is_deleted &&
      t.timestamp <= refund.timestamp &&
      refund.timestamp - t.timestamp <= REFUND_LINK_WINDOW_MS &&
      t.amount >= refund.amount
    )
    .filter(t => {
      if (unknown) return t.amount === refund.amount
      const a = norm(t.merchant)
      const b = norm(refund.merchant)
      return a && b && (a.includes(b) || b.includes(a))
    })
    .sort((x, y) => y.timestamp - x.timestamp)
  return candidates[0] || null
}
