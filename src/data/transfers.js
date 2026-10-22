import { Q } from '@nozbe/watermelondb'
import { col, toPlain } from './util'
import { database } from '../db'
import { findTransferPairs, TRANSFER_PAIR_WINDOW_MS } from '../services/TransferDetector'
import { updateTransaction } from './transactions'

/**
 * Pair up equal debits/credits between your own accounts and cards. Looks at the last
 * `days` days of rows nobody has judged yet. Returns the number of rows marked.
 */
export const reconcileTransfers = async (days = 45) => {
  const since = Date.now() - days * 86400000 - TRANSFER_PAIR_WINDOW_MS
  const rows = await col('transactions').query(Q.where('is_deleted', false), Q.where('timestamp', Q.gte(since))).fetch()
  const pairs = findTransferPairs(rows.map(toPlain))
  if (!pairs.length) return 0
  const ids = new Set(pairs.flatMap(p => [p.debitId, p.creditId]))
  await database.write(() =>
    database.batch(...rows.filter(r => ids.has(r.id)).map(r => r.prepareUpdate(t => { t.transfer = 'AUTO' })))
  )
  return ids.size
}

/** The user's call always wins over detection. */
export const setTransferFlag = (tx, isTransfer) => updateTransaction(tx, { transfer: isTransfer ? 'USER' : 'NOT' })
