import { Q } from '@nozbe/watermelondb'
import { database } from '../db'
import { col, toPlain } from './util'
import { findRule } from '../services/RuleEngine'

const live = Q.where('is_deleted', false)

export const observeLiveTransactions = () =>
  col('transactions').query(live, Q.sortBy('timestamp', Q.desc))

export const observeRecentTransactions = (n = 5) =>
  col('transactions').query(live, Q.sortBy('timestamp', Q.desc), Q.take(n))

export const observeNeedsReview = () =>
  col('transactions').query(live, Q.where('needs_review', true), Q.sortBy('timestamp', Q.desc))

export const fetchLiveTransactions = async () => (await col('transactions').query(live).fetch()).map(toPlain)

export const fetchTransactionsBetween = async (start, end) =>
  (await col('transactions').query(live, Q.where('timestamp', Q.between(start, end - 1))).fetch()).map(toPlain)

export const fetchAllTransactionsRaw = () => col('transactions').query().fetch()

export const createTransaction = (fields) =>
  database.write(() =>
    col('transactions').create(tx => {
      const now = Date.now()
      tx.amount = fields.amount
      tx.merchant = fields.merchant || 'Unknown Vendor'
      tx.type = fields.type || 'DEBIT'
      tx.timestamp = fields.timestamp || now
      tx.category = fields.category || null
      tx.source = fields.source || 'MANUAL'
      tx.raw_text = fields.raw_text || null
      tx.external_id = fields.external_id || null
      tx.needs_review = !!fields.needs_review
      tx.is_deleted = false
      tx.account_id = fields.account_id || null
      tx.card_id = fields.card_id || null
      tx.notes = fields.notes || null
      tx.created_at = now
      tx.updated_at = now
    })
  )

export const updateTransaction = (tx, patch) =>
  database.write(() =>
    tx.update(t => {
      Object.assign(t, patch)
      t.updated_at = Date.now()
    })
  )

export const softDeleteTransaction = (tx) => updateTransaction(tx, { is_deleted: true })
export const restoreTransaction = (tx) => updateTransaction(tx, { is_deleted: false })
export const attachReceipt = (tx, path) => updateTransaction(tx, { receipt_path: path })

/**
 * Apply a saved merchant rule to every stored transaction it matches that has
 * not already been settled by another rule. Returns the number updated.
 */
export const applyRuleToExisting = async (rule) => {
  const all = await col('transactions').query(live).fetch()
  const matching = all.filter(t => {
    if (t.merchant_rule_id && t.merchant_rule_id !== rule.id) return false
    return findRule([rule], { merchant: t.merchant, raw_text: t.raw_text }) !== null
  })
  if (!matching.length) return 0
  const now = Date.now()
  await database.write(() =>
    database.batch(
      ...matching.map(t =>
        t.prepareUpdate(r => {
          r.merchant = rule.mapped_merchant || r.merchant
          if (rule.category) r.category = rule.category
          r.needs_review = false
          r.merchant_rule_id = rule.id
          r.updated_at = now
        })
      )
    )
  )
  return matching.length
}

export const wipeAllData = () => database.write(() => database.unsafeResetDatabase())
