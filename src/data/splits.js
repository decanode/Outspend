import { Q } from '@nozbe/watermelondb'
import { col, watch } from './util'
import { database } from '../db'
import { myShareAfterSplit } from '../services/Planning'

export const observeSplits = () => watch(col('splits').query())
export const observeSplitsFor = (transactionId) => watch(col('splits').query(Q.where('transaction_id', transactionId)))
export const fetchSplitsFor = (transactionId) => col('splits').query(Q.where('transaction_id', transactionId)).fetch()

/**
 * Record who else a payment was for. Replaces the open parts of this payment, keeps ones
 * already settled, and sets your own share so analytics count only what you really spent.
 * parts: [{ person, amount }]. Returns false when the parts do not fit inside the amount.
 */
export const setSplits = async (tx, parts) => {
  const existing = await fetchSplitsFor(tx.id)
  const settled = existing.filter(s => s.is_settled)
  const settledTotal = settled.reduce((s, x) => s + x.amount, 0)
  const share = myShareAfterSplit(tx.amount, [...parts.map(p => p.amount), ...(settledTotal > 0 ? [settledTotal] : [])])
  if (share === null) return false
  const now = Date.now()
  await database.write(async () => {
    const ops = existing.filter(s => !s.is_settled).map(s => s.prepareDestroyPermanently())
    for (const p of parts) {
      ops.push(col('splits').prepareCreate(s => {
        s.transaction_id = tx.id
        s.person = p.person.trim()
        s.amount = p.amount
        s.is_settled = false
        s.created_at = now
      }))
    }
    ops.push(tx.prepareUpdate(t => { t.my_share = share; t.updated_at = now }))
    await database.batch(...ops)
  })
  return true
}

/** Undo a split: the whole payment is yours again. */
export const clearSplits = async (tx) => {
  const existing = await fetchSplitsFor(tx.id)
  await database.write(() =>
    database.batch(
      ...existing.map(s => s.prepareDestroyPermanently()),
      tx.prepareUpdate(t => { t.my_share = null; t.updated_at = Date.now() })
    )
  )
}

export const settleSplit = (split) =>
  database.write(() => split.update(s => { s.is_settled = true; s.settled_at = Date.now() }))

export const settlePerson = async (person) => {
  const key = person.trim().toLowerCase()
  const open = (await col('splits').query(Q.where('is_settled', false)).fetch()).filter(s => s.person.trim().toLowerCase() === key)
  const now = Date.now()
  await database.write(() => database.batch(...open.map(s => s.prepareUpdate(x => { x.is_settled = true; x.settled_at = now }))))
  return open.length
}
