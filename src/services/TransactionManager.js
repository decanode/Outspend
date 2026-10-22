import { Q } from '@nozbe/watermelondb'
import { database } from '../db'
import { planIngest, REFUND_LINK_WINDOW_MS, DEDUPE_WINDOW_MS } from './IngestPlanner'

const BATCH_SIZE = 400

const lightweight = (m) => ({
  id: m.id,
  external_id: m.external_id,
  amount: m.amount,
  type: m.type,
  timestamp: m.timestamp,
  source: m.source,
  merchant: m.merchant,
  category: m.category,
  is_deleted: m.is_deleted,
  account_id: m.account_id,
  card_id: m.card_id,
})

/**
 * Parse, dedupe, categorise and persist a set of raw SMS in one go.
 * Used for live messages (batch of one), the onboarding import and the daily audit.
 *
 * Soft-deleted rows are loaded too: they keep their external_id, so a message the
 * user deleted is never resurrected by a later re-import.
 */
export const ingestMessages = async (messages, { onProgress } = {}) => {
  if (!messages.length) return { created: 0, merged: 0, skipped: 0 }

  const minTs = Math.min(...messages.map(m => m.timestamp))
  const maxTs = Math.max(...messages.map(m => m.timestamp))
  const txCol = database.collections.get('transactions')

  const [rules, accounts, cards, existingModels] = await Promise.all([
    database.collections.get('merchant_rules').query().fetch(),
    database.collections.get('accounts').query().fetch(),
    database.collections.get('credit_cards').query().fetch(),
    txCol.query(Q.where('timestamp', Q.between(minTs - REFUND_LINK_WINDOW_MS - DEDUPE_WINDOW_MS, maxTs + DEDUPE_WINDOW_MS))).fetch(),
  ])
  const modelById = new Map(existingModels.map(m => [m.id, m]))

  const plan = planIngest(messages, {
    rules: rules.map(r => ({ id: r.id, pattern: r.pattern, mapped_merchant: r.mapped_merchant, category: r.category })),
    accounts: accounts.map(a => ({ id: a.id, last4: a.last4 })),
    cards: cards.map(c => ({ id: c.id, last4: c.last4 })),
    existing: existingModels.map(lightweight),
  })

  const now = Date.now()
  const idByTemp = new Map()
  const ops = []

  for (const d of plan.creates) {
    ops.push(txCol.prepareCreate(r => {
      idByTemp.set(d.tempId, r.id)
      r.amount = d.amount
      r.merchant = d.merchant
      r.type = d.type
      r.timestamp = d.timestamp
      r.category = d.category
      r.source = d.source
      r.raw_text = d.raw_text
      r.external_id = d.external_id
      r.needs_review = d.needs_review
      r.is_deleted = false
      r.account_id = d.account_id
      r.card_id = d.card_id
      r.last4 = d.last4
      r.payment_mode = d.payment_mode
      r.merchant_rule_id = d.merchant_rule_id
      r.linked_transaction_id = idByTemp.get(d.linked_transaction_id) || d.linked_transaction_id
      r.created_at = now
      r.updated_at = now
    }))
  }

  for (const u of plan.updates) {
    const model = modelById.get(u.id)
    if (!model) continue
    ops.push(model.prepareUpdate(r => {
      Object.assign(r, u.patch)
      r.updated_at = now
    }))
  }

  await database.write(async () => {
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      await database.batch(...ops.slice(i, i + BATCH_SIZE))
      if (onProgress) onProgress(Math.min(i + BATCH_SIZE, ops.length), ops.length)
    }
  })

  return { created: plan.creates.length, merged: plan.updates.length, skipped: plan.skipped }
}

/** Live path: one message from the broadcast receiver. */
export const processIncomingSms = (sender, body, timestamp) =>
  ingestMessages([{ sender, body, timestamp }])
