import { col } from './util'
import { updateTransaction } from './transactions'
import { createRule } from './rules'
import { keywordCategory, suggestPattern } from '../services/RuleEngine'

/**
 * The user told us who an unrecognised payment was to. Save a rule when we have a
 * stable pattern (so future payments are recognised and past ones fixed), otherwise
 * just fix this one transaction. Returns how many transactions were updated.
 */
export const nameUnknownTransaction = async (tx, merchant, category = null) => {
  const name = (merchant || '').trim()
  if (!name) return 0
  const cat = category || keywordCategory(name)
  const pattern = suggestPattern(tx)
  if (pattern) {
    const { updated } = await createRule({ pattern, mapped_merchant: name, category: cat })
    return updated
  }
  await updateTransaction(tx, { merchant: name, category: cat, needs_review: false })
  return 1
}

/** Same, by id (used by the notification reply, where we only have the id). */
export const nameTransactionById = async (id, merchant, category = null) => {
  let tx
  try {
    tx = await col('transactions').find(id)
  } catch {
    return 0 // deleted since the notification was sent
  }
  return nameUnknownTransaction(tx, merchant, category)
}
