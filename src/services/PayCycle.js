import { isTransfer } from './Analytics'
import { isForeignCurrency } from '../regions'

// A "pay cycle" runs from one salary credit to the next, so spending is compared with the
// income it is actually paid from. The boundary is the real salary transaction (so a payday
// that moves around weekends needs no special handling) and is matched by who paid, not by how
// much, because the amount changes from month to month.

const DAY = 86400000
const MIN_GAP_DAYS = 15 // two credits closer than this are one salary (e.g. a split payment)

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }

export const salaryKey = (merchant) => norm(merchant)

const sameSender = (merchant, key) => {
  const m = norm(merchant)
  return m.length >= 4 && key.length >= 4 && (m === key || m.includes(key) || key.includes(m))
}

/** Is this transaction a salary credit from the confirmed source? Card credits are never income. */
export const isSalaryCredit = (t, source) =>
  !!source && !!source.key && t.type === 'CREDIT' && !t.is_deleted && !t.card_id && !isTransfer(t) && !isForeignCurrency(t) &&
  sameSender(t.merchant, source.key)

/** Timestamps (oldest first) of the salary credits that start a cycle. */
export const salaryAnchors = (txs, source) => {
  const times = txs.filter(t => isSalaryCredit(t, source)).map(t => t.timestamp).sort((a, b) => a - b)
  const anchors = []
  for (const ts of times) {
    if (!anchors.length || ts - anchors[anchors.length - 1] >= MIN_GAP_DAYS * DAY) anchors.push(ts)
  }
  return anchors
}

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Typical cycle length in days (from the last few gaps), kept to a sensible 25-35. */
export const cycleLength = (anchors) => {
  if (anchors.length < 2) return 30
  const recent = anchors.slice(-7)
  const gaps = recent.slice(1).map((a, i) => (a - recent[i]) / DAY)
  return Math.min(35, Math.max(25, Math.round(median(gaps))))
}

/**
 * The cycle containing `ts`, as { mode: 'CYCLE', start, end (exclusive), anchors, open }.
 * `open` means the next salary has not arrived yet; the end then extends to include today, so
 * a late salary never makes current spending vanish. Null when `ts` is before the first salary.
 */
export const makeCyclePeriod = (anchors, ts = Date.now(), now = Date.now()) => {
  let i = -1
  for (let k = 0; k < anchors.length; k++) if (startOfDay(anchors[k]) <= ts) i = k
  if (i === -1) return null
  const start = startOfDay(anchors[i])
  const next = anchors[i + 1]
  if (next) return { mode: 'CYCLE', start, end: startOfDay(next), anchors, open: false }
  const expected = start + cycleLength(anchors) * DAY
  return { mode: 'CYCLE', start, end: Math.max(expected, startOfDay(now) + DAY), anchors, open: true }
}

/** Neighbouring cycle (delta -1 = the previous one). Before the first salary a typical-length cycle is assumed. */
export const shiftCycle = (period, delta) => {
  const { anchors } = period
  const idx = anchors.findIndex(a => startOfDay(a) === period.start)
  const target = idx + delta
  if (target >= 0 && target < anchors.length) return makeCyclePeriod(anchors, anchors[target], anchors[anchors.length - 1] + 40 * DAY)
  if (target >= anchors.length) return period // nothing after the current cycle
  const len = cycleLength(anchors) * DAY * (-target)
  return { mode: 'CYCLE', start: period.start - len, end: period.start - len + cycleLength(anchors) * DAY, anchors, open: false, synthetic: true }
}

/**
 * The period that stands in for "this month" everywhere (Analytics, budgets, Home, widget):
 * the pay cycle when a salary source is confirmed and has been seen, otherwise the calendar month.
 */
export const resolveMonthPeriod = (ts, source, txs, makeCalendar, now = Date.now()) => {
  if (source && source.key) {
    const period = makeCyclePeriod(salaryAnchors(txs, source), ts, now)
    if (period) return period
  }
  return makeCalendar(ts)
}

/** Has the salary credit for the current month shown up? Used for the "has your salary arrived?" nudge. */
export const salaryMissingThisMonth = (anchors, now = Date.now()) => {
  if (!anchors.length) return false
  const d = new Date(now)
  if (d.getDate() > 5) return false // only nudge in the first days of the month
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  // Salary normally lands in the last days of the previous month or the first of this one.
  return anchors[anchors.length - 1] < monthStart - 7 * DAY
}
