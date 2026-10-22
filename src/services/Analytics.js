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

/** A transfer between your own accounts/cards (or a card bill payment) is not spending or income. */
export const isTransfer = (t) => t.transfer === 'AUTO' || t.transfer === 'USER'

const hasShare = (t) => t.my_share !== null && t.my_share !== undefined && t.my_share >= 0

/** What a debit really cost you: your share of a split payment, else the full amount. */
export const shareOf = (t) => (hasShare(t) ? t.my_share : t.amount)

/**
 * Signed spend entries for [start, end): DEBIT adds your share, REFUND subtracts (scaled
 * to your share when the original was split). CREDIT and transfers are ignored.
 */
export const spendEntries = (txs, start, end) => {
  const all = live(txs)
  const byId = new Map(all.map(t => [t.id, t]))
  const out = []
  for (const t of all) {
    if (t.timestamp < start || t.timestamp >= end || t.type === 'CREDIT' || isTransfer(t)) continue
    const linked = t.linked_transaction_id ? byId.get(t.linked_transaction_id) : null
    let amount
    if (t.type === 'REFUND') {
      const factor = linked && hasShare(linked) && linked.amount > 0 ? linked.my_share / linked.amount : 1
      amount = -t.amount * factor
    } else {
      amount = shareOf(t)
    }
    out.push({
      t,
      amount,
      category: t.category || (linked && linked.category) || UNCATEGORIZED,
      merchant: (linked && linked.merchant) || t.merchant,
    })
  }
  return out
}

export const aggregateSpend = (txs, start, end) => {
  const byCategory = new Map()
  const byMerchant = new Map()
  let total = 0
  const add = (map, key, value) => map.set(key, (map.get(key) || 0) + value)

  for (const e of spendEntries(txs, start, end)) {
    add(byCategory, e.category, e.amount)
    add(byMerchant, e.merchant, e.amount)
    total += e.amount
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

/** Money received in [start, end): salary, gifts, interest. Refunds and transfers are not income. */
export const incomeTotal = (txs, start, end) =>
  live(txs)
    .filter(t => t.type === 'CREDIT' && !isTransfer(t) && t.timestamp >= start && t.timestamp < end)
    .reduce((sum, t) => sum + t.amount, 0)

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

let numberLocale = 'en-IN'
/** 'IN' groups as 1,00,000 (lakh/crore); 'INTL' as 100,000. */
export const setNumberStyle = (style) => { numberLocale = style === 'INTL' ? 'en-US' : 'en-IN' }

export const formatINR = (n) =>
  '₹' + Math.abs(n).toLocaleString(numberLocale, { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })
