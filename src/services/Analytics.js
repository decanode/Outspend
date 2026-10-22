import { UNCATEGORIZED } from '../constants/categories'

export const monthBounds = (year, month) => ({
  start: new Date(year, month, 1).getTime(),
  end: new Date(year, month + 1, 1).getTime(), // exclusive
})

export const shiftMonth = ({ year, month }, delta) => {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export const monthLabel = ({ year, month }) =>
  new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

const live = (txs) => txs.filter(t => !t.is_deleted)

/**
 * Net spend for [start, end): DEBIT adds, REFUND subtracts. CREDIT (income) is
 * ignored. A linked refund is netted against the original debit's category.
 */
export const aggregateSpend = (txs, start, end) => {
  const all = live(txs)
  const byId = new Map(all.map(t => [t.id, t]))
  const inRange = all.filter(t => t.timestamp >= start && t.timestamp < end)

  const byCategory = new Map()
  const byMerchant = new Map()
  let total = 0

  const add = (map, key, value) => map.set(key, (map.get(key) || 0) + value)

  for (const t of inRange) {
    if (t.type === 'CREDIT') continue
    const sign = t.type === 'REFUND' ? -1 : 1
    const linked = t.linked_transaction_id ? byId.get(t.linked_transaction_id) : null
    const category = t.category || (linked && linked.category) || UNCATEGORIZED
    const merchant = (linked && linked.merchant) || t.merchant
    add(byCategory, category, sign * t.amount)
    add(byMerchant, merchant, sign * t.amount)
    total += sign * t.amount
  }

  const toList = (map) =>
    [...map.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter(x => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)

  return {
    total: Math.max(total, 0),
    categories: toList(byCategory),
    merchants: toList(byMerchant),
  }
}

const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }

/** Spend per day for the last `days` days ending today (oldest first). */
export const dailySpend = (txs, now = Date.now(), days = 7) => {
  const today = startOfDay(now)
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const start = d.getTime()
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    out.push({ start, label: d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2), amount: aggregateSpend(txs, start, next.getTime()).total })
  }
  return out
}

/** Current balance = balance at last reconciliation + money movements since. */
export const accountBalance = (account, txs) => {
  let bal = account.balance || 0
  for (const t of live(txs)) {
    if (t.account_id !== account.id || t.timestamp <= account.last_reconciled_at) continue
    bal += t.type === 'DEBIT' ? -t.amount : t.amount
  }
  return bal
}

/** Start of the credit-card billing cycle that contains `now`. */
export const cycleStart = (billingDay, now = Date.now()) => {
  const day = Math.min(Math.max(billingDay || 1, 1), 28)
  const d = new Date(now)
  const start = new Date(d.getFullYear(), d.getMonth(), day)
  if (start.getTime() > now) start.setMonth(start.getMonth() - 1)
  return start.getTime()
}

export const cardSpend = (card, txs, now = Date.now()) => {
  const from = cycleStart(card.billing_day, now)
  let spend = 0
  for (const t of live(txs)) {
    if (t.card_id !== card.id || t.timestamp < from) continue
    if (t.type === 'DEBIT') spend += t.amount
    else if (t.type === 'REFUND') spend -= t.amount
  }
  return Math.max(spend, 0)
}

export const utilisation = (spend, limit) => (limit > 0 ? Math.min(spend / limit, 1) : 0)
export const utilisationLevel = (ratio) => (ratio >= 0.95 ? 'critical' : ratio >= 0.8 ? 'warning' : 'ok')

export const formatINR = (n) =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })
