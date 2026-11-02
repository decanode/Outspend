import { UNCATEGORIZED } from '../constants/categories'
import { isTransfer, shareOf } from './Analytics'
import { isForeignCurrency } from '../regions'
import { parseTags } from './Planning'

export const UNASSIGNED = 'NONE' // account filter value: transactions not tied to any account or card

export const DEFAULT_FILTERS = {
  query: '',
  type: 'ALL', // ALL | DEBIT | CREDIT | REFUND
  from: 0, // period start (ms); the Period dropdown resolves its choice to this when picked
  category: null, // category name or UNCATEGORIZED
  account: null, // account/card id or UNASSIGNED
  tag: null,
  show: 'ALL', // ALL | NO_RECEIPT | TRANSFERS | HIDE_TRANSFERS
}

export const hasActiveFilters = (f) =>
  !!f.query || f.type !== 'ALL' || f.from > 0 || !!f.category || !!f.account || !!f.tag || f.show !== 'ALL'

/** True when a transaction belongs to the given account or card (or to none, for UNASSIGNED). */
export const matchesAccount = (t, account) =>
  account === UNASSIGNED ? !t.account_id && !t.card_id : t.account_id === account || t.card_id === account

export const filterTransactions = (txs, f) => {
  const q = (f.query || '').trim().toLowerCase()
  return txs.filter(t => {
    if (t.timestamp < f.from) return false
    if (f.type !== 'ALL' && t.type !== f.type) return false
    if (f.category && (t.category || UNCATEGORIZED) !== f.category) return false
    if (f.account && !matchesAccount(t, f.account)) return false
    if (f.tag && !parseTags(t.tags).includes(f.tag)) return false
    if (f.show === 'NO_RECEIPT' && (t.type !== 'DEBIT' || t.receipt_path)) return false
    if (f.show === 'TRANSFERS' && !isTransfer(t)) return false
    if (f.show === 'HIDE_TRANSFERS' && isTransfer(t)) return false
    if (q && !`${t.merchant} ${t.category || ''} ${t.notes || ''} ${t.tags || ''} ${t.amount}`.toLowerCase().includes(q)) return false
    return true
  })
}

/** What a set of transactions adds up to as spending: transfers and other currencies never count. */
export const spentIn = (txs) =>
  txs.reduce((sum, t) => {
    if (isTransfer(t) || isForeignCurrency(t)) return sum
    if (t.type === 'DEBIT') return sum + shareOf(t)
    return t.type === 'REFUND' ? sum - t.amount : sum
  }, 0)
