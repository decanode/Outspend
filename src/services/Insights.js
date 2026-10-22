import { spendEntries, aggregateSpend, incomeTotal, shareOf } from './Analytics'

const DAY = 86400000
export const SMALL_PURCHASE = 200

/** A period is a Monday-Sunday week or a calendar month: { mode, start, end(exclusive) }. */
export const makePeriod = (mode, ts = Date.now()) => {
  const d = new Date(ts)
  if (mode === 'WEEK') {
    const back = (d.getDay() + 6) % 7
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
    return { mode, start: start.getTime(), end: end.getTime() }
  }
  return {
    mode: 'MONTH',
    start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
  }
}

export const shiftPeriod = (p, delta) => {
  const d = new Date(p.start)
  return p.mode === 'WEEK'
    ? makePeriod('WEEK', new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * delta, 12).getTime())
    : makePeriod('MONTH', new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime())
}

export const isCurrentPeriod = (p, now = Date.now()) => now >= p.start && now < p.end
export const periodDays = (p) => Math.round((p.end - p.start) / DAY)

export const periodLabel = (p) => {
  if (p.mode === 'MONTH') return new Date(p.start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const a = new Date(p.start)
  const b = new Date(p.end - DAY)
  const sameMonth = a.getMonth() === b.getMonth()
  const left = a.toLocaleDateString('en-IN', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${left} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const pct = (delta, base) => (base > 0 ? Math.round((delta / base) * 100) : null)

const timeBucket = (hour) =>
  hour >= 5 && hour <= 11 ? 'morning' : hour >= 12 && hour <= 16 ? 'afternoon' : hour >= 17 && hour <= 20 ? 'evening' : 'night'

/**
 * Everything the Analytics screen needs for one period, compared with the one before it.
 * txs: plain transaction objects (any time range).
 */
export const analyzePeriod = (txs, period, now = Date.now()) => {
  const prevPeriod = shiftPeriod(period, -1)
  const cur = aggregateSpend(txs, period.start, period.end)
  const prev = aggregateSpend(txs, prevPeriod.start, prevPeriod.end)
  const income = incomeTotal(txs, period.start, period.end)
  const entries = spendEntries(txs, period.start, period.end)

  // categories incl. ones that vanished this period (needed for "fell the most")
  const prevByName = new Map(prev.categories.map(c => [c.name, c.amount]))
  const curByName = new Map(cur.categories.map(c => [c.name, c.amount]))
  const names = new Set([...prevByName.keys(), ...curByName.keys()])
  const rows = [...names].map(name => {
    const amount = curByName.get(name) || 0
    const before = prevByName.get(name) || 0
    return { name, amount, prev: before, delta: amount - before, deltaPct: pct(amount - before, before) }
  })
  const categories = rows.filter(r => r.amount > 0).sort((a, b) => b.amount - a.amount)
  const movers = {
    up: rows.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    down: rows.filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
  }

  // daily buckets
  const days = periodDays(period)
  const daily = []
  for (let i = 0; i < days; i++) {
    const d = new Date(period.start)
    d.setDate(d.getDate() + i)
    daily.push({ start: d.getTime(), label: d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2), day: d.getDate(), amount: 0 })
  }
  const debits = entries.filter(e => e.amount > 0)
  for (const e of entries) {
    const idx = Math.min(daily.length - 1, Math.max(0, Math.floor((new Date(e.t.timestamp).setHours(0, 0, 0, 0) - period.start) / DAY + 0.5)))
    daily[idx].amount += e.amount
  }
  const busiest = daily.reduce((m, d) => (d.amount > (m ? m.amount : 0) ? d : m), null)

  // patterns
  let weekend = 0
  let weekday = 0
  const tod = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  const small = { count: 0, total: 0, share: 0, threshold: SMALL_PURCHASE }
  for (const e of debits) {
    const dt = new Date(e.t.timestamp)
    if (dt.getDay() === 0 || dt.getDay() === 6) weekend += e.amount
    else weekday += e.amount
    tod[timeBucket(dt.getHours())] += e.amount
    if (e.amount < SMALL_PURCHASE) { small.count++; small.total += e.amount }
  }
  small.share = cur.total > 0 ? Math.round((small.total / cur.total) * 100) : 0
  const patternTotal = weekend + weekday

  const top = debits
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(e => ({ id: e.t.id, merchant: e.t.merchant, amount: e.amount, timestamp: e.t.timestamp, category: e.category }))

  const elapsed = isCurrentPeriod(period, now) ? Math.max(1, Math.ceil((now - period.start) / DAY)) : days

  return {
    period,
    total: cur.total,
    prevTotal: prev.total,
    delta: cur.total - prev.total,
    deltaPct: pct(cur.total - prev.total, prev.total),
    income,
    net: income - cur.total,
    savingsRate: income > 0 ? Math.round(((income - cur.total) / income) * 100) : null,
    avgPerDay: cur.total / elapsed,
    count: debits.length,
    categories,
    merchants: cur.merchants,
    movers,
    daily,
    busiest: busiest && busiest.amount > 0 ? busiest : null,
    patterns: {
      weekendShare: patternTotal > 0 ? Math.round((weekend / patternTotal) * 100) : 0,
      weekday,
      weekend,
      timeOfDay: tod,
      small,
    },
    top,
  }
}

/** "At this pace you will spend X this month." Null when it is too early or not the current month. */
export const runRate = (total, period, now = Date.now()) => {
  if (period.mode !== 'MONTH' || !isCurrentPeriod(period, now)) return null
  const elapsed = Math.ceil((now - period.start) / DAY)
  if (elapsed < 3) return null
  const days = periodDays(period)
  return { projected: (total / elapsed) * days, elapsed, days }
}

/** Last `months` calendar months ending with the month containing endTs, oldest first. */
export const monthlyTrend = (txs, endTs = Date.now(), months = 6) => {
  const out = []
  for (let i = months - 1; i >= 0; i--) {
    const p = shiftPeriod(makePeriod('MONTH', endTs), -i)
    out.push({
      start: p.start,
      label: new Date(p.start).toLocaleDateString('en-IN', { month: 'short' }),
      total: aggregateSpend(txs, p.start, p.end).total,
      income: incomeTotal(txs, p.start, p.end),
    })
  }
  return out
}

/** Month-by-month series for the biggest categories over the window. */
export const categoryTrend = (txs, endTs = Date.now(), months = 6, topN = 5) => {
  const series = new Map()
  for (let i = months - 1; i >= 0; i--) {
    const p = shiftPeriod(makePeriod('MONTH', endTs), -i)
    const agg = aggregateSpend(txs, p.start, p.end)
    const seen = new Map(agg.categories.map(c => [c.name, c.amount]))
    for (const name of new Set([...series.keys(), ...seen.keys()])) {
      if (!series.has(name)) series.set(name, Array(months - 1 - i).fill(0))
      series.get(name).push(seen.get(name) || 0)
    }
  }
  return [...series.entries()]
    .map(([name, values]) => ({ name, values, total: values.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN)
}

/** Average of (income - spend) over the last `months` completed months; never negative. */
export const averageSurplus = (txs, now = Date.now(), months = 3) => {
  const trend = monthlyTrend(txs, now, months + 1).slice(0, months)
  const active = trend.filter(m => m.income > 0 || m.total > 0)
  if (!active.length) return 0
  return Math.max(0, active.reduce((s, m) => s + (m.income - m.total), 0) / active.length)
}

export { shareOf }
