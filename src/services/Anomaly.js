import { formatMoney, scaled } from '../regions'

const MINUTE = 60 * 1000

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export const DUPLICATE_WINDOW_MS = 10 * MINUTE

/**
 * Spot a charge worth a second look.
 *  - DUPLICATE: same merchant and amount as another charge within 10 minutes.
 *  - UNUSUAL: far above what you normally pay this merchant (or, with little merchant
 *    history, this category).
 * history: plain transactions, not including `tx`.
 */
export const detectAnomalies = (tx, history) => {
  if (tx.type !== 'DEBIT' || tx.is_transfer || tx.transfer === 'AUTO' || tx.transfer === 'USER') return []
  const known = tx.merchant && tx.merchant !== 'Unknown Vendor'
  const past = history.filter(h => h.id !== tx.id && h.type === 'DEBIT' && !h.is_deleted && h.transfer !== 'AUTO' && h.transfer !== 'USER')
  const out = []

  if (known) {
    const m = norm(tx.merchant)
    const dup = past.find(h => norm(h.merchant) === m && h.amount === tx.amount && Math.abs(h.timestamp - tx.timestamp) <= DUPLICATE_WINDOW_MS)
    if (dup) out.push({ kind: 'DUPLICATE', message: `Two charges of ${formatMoney(tx.amount)} at ${tx.merchant} within 10 minutes. Was one a mistake?` })

    const sameMerchant = past.filter(h => norm(h.merchant) === m && h.timestamp < tx.timestamp - DUPLICATE_WINDOW_MS)
    if (sameMerchant.length >= 3) {
      const typical = median(sameMerchant.map(h => h.amount))
      if (tx.amount >= typical * 3 && tx.amount - typical >= scaled(500)) {
        out.push({ kind: 'UNUSUAL', message: `${formatMoney(tx.amount)} at ${tx.merchant} is far above your usual ${formatMoney(Math.round(typical))}.` })
      }
      return out
    }
  }

  if (tx.category) {
    const sameCategory = past.filter(h => h.category === tx.category)
    if (sameCategory.length >= 5) {
      const typical = median(sameCategory.map(h => h.amount))
      if (tx.amount >= typical * 4 && tx.amount >= scaled(1000)) {
        out.push({ kind: 'UNUSUAL', message: `${formatMoney(tx.amount)} is a large ${tx.category} payment (typical: ${formatMoney(Math.round(typical))}).` })
      }
    }
  }
  return out
}
