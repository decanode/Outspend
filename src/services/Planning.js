import { addCycle } from './SubscriptionDetector'

const DAY = 86400000
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Find a recurring large credit (salary): same sender, amounts within 20%, paid around the
 * same day of the month. One credit is enough when it literally says "salary".
 */
export const detectSalary = (txs, now = Date.now()) => {
  const groups = new Map()
  for (const t of txs) {
    if (t.is_deleted || t.type !== 'CREDIT' || t.transfer === 'AUTO' || t.transfer === 'USER' || t.amount < 5000) continue
    const key = norm(t.merchant)
    if (!key || key === 'unknownvendor') continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }

  let best = null
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)
    const last = sorted[sorted.length - 1]
    if (now - last.timestamp > 62 * DAY) continue
    const labelled = sorted.some(t => /salary|payroll/i.test(`${t.merchant} ${t.raw_text || ''}`))
    const amount = median(sorted.map(t => t.amount))
    const days = sorted.map(t => new Date(t.timestamp).getDate())
    const day = Math.round(median(days))
    const months = new Set(sorted.map(t => `${new Date(t.timestamp).getFullYear()}-${new Date(t.timestamp).getMonth()}`))
    const steady = sorted.filter(t => Math.abs(t.amount - amount) <= amount * 0.2 && Math.abs(new Date(t.timestamp).getDate() - day) <= 3)
    if (!(labelled || (months.size >= 2 && steady.length >= 2))) continue
    if (!best || amount > best.amount) best = { merchant: last.merchant, amount, day }
  }
  if (!best) return null

  const today = new Date(startOfDay(now))
  const clamp = (y, m) => new Date(y, m, Math.min(best.day, new Date(y, m + 1, 0).getDate()))
  let next = clamp(today.getFullYear(), today.getMonth())
  if (next.getTime() < today.getTime()) next = clamp(today.getFullYear(), today.getMonth() + 1)
  return { ...best, nextDate: next.getTime(), daysUntil: Math.round((next.getTime() - today.getTime()) / DAY) }
}

/** Subscription renewals in the next `days` days, soonest first, plus the total due this week. */
export const upcomingBills = (subs, now = Date.now(), days = 30) => {
  const from = startOfDay(now)
  const to = from + days * DAY
  const items = []
  for (const s of subs) {
    if (!s.is_active) continue
    let when = s.next_billing_date
    let guard = 0
    while (when < from && guard++ < 600) when = addCycle(when, s.billing_cycle)
    while (when < to && guard++ < 1200) {
      items.push({ date: when, id: s.id, name: s.name, amount: s.amount })
      when = addCycle(when, s.billing_cycle)
    }
  }
  items.sort((a, b) => a.date - b.date)
  const weekEnd = from + 7 * DAY
  const dueThisWeek = items.filter(i => i.date < weekEnd).reduce((sum, i) => sum + i.amount, 0)
  const groups = []
  for (const it of items) {
    const key = startOfDay(it.date)
    const g = groups[groups.length - 1]
    if (g && g.key === key) g.items.push(it)
    else groups.push({ key, items: [it] })
  }
  return { items, groups, dueThisWeek, total: items.reduce((s, i) => s + i.amount, 0) }
}

/** Who owes you what. splits: [{ person, amount, is_settled }] */
export const owedByPerson = (splits) => {
  const map = new Map()
  for (const s of splits) {
    if (s.is_settled) continue
    const key = s.person.trim().toLowerCase()
    const cur = map.get(key) || { person: s.person.trim(), owed: 0, count: 0 }
    cur.owed += s.amount
    cur.count++
    map.set(key, cur)
  }
  const people = [...map.values()].sort((a, b) => b.owed - a.owed)
  return { people, total: people.reduce((s, p) => s + p.owed, 0) }
}

/** Your share of a payment after others' parts are taken out; null when the parts are invalid. */
export const myShareAfterSplit = (amount, parts) => {
  const others = parts.reduce((s, p) => s + p, 0)
  if (parts.some(p => !(p > 0)) || others > amount + 0.001) return null
  return Math.round((amount - others) * 100) / 100
}

export const parseTags = (text) =>
  [...new Set((text || '').split(/[,#\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean))]

export const tagsToString = (tags) => parseTags(Array.isArray(tags) ? tags.join(',') : tags).join(',')
