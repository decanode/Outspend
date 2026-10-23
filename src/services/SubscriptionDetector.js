const DAY = 24 * 60 * 60 * 1000

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export const subscriptionKey = (merchant, cycle) => `${norm(merchant)}:${cycle}`

export const addCycle = (ts, cycle) => {
  const d = new Date(ts)
  if (cycle === 'YEARLY') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

/** Move a billing date forward until it is in the future. */
export const rollForward = (ts, cycle, now = Date.now()) => {
  let next = ts
  let guard = 0
  while (next <= now && guard++ < 600) next = addCycle(next, cycle)
  return next
}

/**
 * Find recurring debits: same merchant, amounts within +/-5% of the median,
 * and gaps of roughly a month or a year. Needs at least two charges.
 */
export const detectSubscriptions = (txs, { existing = [], dismissed = [], now = Date.now() } = {}) => {
  const groups = new Map()
  for (const t of txs) {
    if (t.is_deleted || t.type !== 'DEBIT' || !t.merchant || t.merchant === 'Unknown Vendor') continue
    const k = norm(t.merchant)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(t)
  }

  const known = new Set(existing.map(s => norm(s.merchant || s.name)))
  const out = []

  for (const [k, list] of groups) {
    if (list.length < 2 || known.has(k)) continue
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)
    const amt = median(sorted.map(t => t.amount))
    const similar = sorted.filter(t => Math.abs(t.amount - amt) <= amt * 0.05)
    if (similar.length < 2) continue

    const gaps = []
    for (let i = 1; i < similar.length; i++) gaps.push((similar[i].timestamp - similar[i - 1].timestamp) / DAY)
    const gap = median(gaps)
    const cycle = gap >= 26 && gap <= 35 ? 'MONTHLY' : gap >= 350 && gap <= 380 ? 'YEARLY' : null
    if (!cycle) continue

    const key = subscriptionKey(similar[0].merchant, cycle)
    if (dismissed.includes(key)) continue

    const last = similar[similar.length - 1]
    // A subscription that has not charged for two cycles is probably cancelled.
    const stale = cycle === 'MONTHLY' ? 70 : 400
    if ((now - last.timestamp) / DAY > stale) continue

    out.push({
      key,
      merchant: last.merchant,
      amount: Math.round(amt * 100) / 100,
      cycle,
      lastDate: last.timestamp,
      nextDate: rollForward(addCycle(last.timestamp, cycle), cycle, now),
      txId: last.id,
    })
  }
  return out.sort((a, b) => b.amount - a.amount)
}
