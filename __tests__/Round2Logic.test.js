import { looksLikeTransfer, findTransferPairs } from '../src/services/TransferDetector'
import { makePeriod, shiftPeriod, periodLabel, analyzePeriod, runRate, monthlyTrend, categoryTrend, averageSurplus, periodDays } from '../src/services/Insights'
import { budgetStatus, goalProgress, levelFor } from '../src/services/Budgets'
import { detectAnomalies } from '../src/services/Anomaly'
import { detectSalary, upcomingBills, owedByPerson, myShareAfterSplit, parseTags, tagsToString } from '../src/services/Planning'
import { aggregateSpend, incomeTotal, shareOf, isTransfer, formatMoney } from '../src/services/Analytics'
import { setGroupingOverride } from '../src/regions'
import { encryptText, decryptText, toBase64, fromBase64 } from '../src/services/BackupCrypto'
import { planIngest } from '../src/services/IngestPlanner'
import { randomBytes } from '@noble/hashes/utils.js'

const d = (y, m, day, h = 12) => new Date(y, m, day, h).getTime()
let n = 0
const tx = (o) => ({ id: 't' + n++, type: 'DEBIT', amount: 100, merchant: 'Shop', category: 'Shopping', timestamp: d(2026, 9, 5), ...o })

describe('transfers', () => {
  test.each([
    ['Payment of Rs.5,000 towards your HDFC credit card bill', true],
    ['CC payment to ICICI card', true],
    ['Payment of Rs 2000 received on your SBI Card. Thank you for your payment', true],
    ['Self transfer to own account', true],
    ['Paid to CRED (cred.club)', true],
    ['Added Rs.500 to Paytm wallet', true],
    ['Paid Rs.250 to Swiggy', false],
    ['Spent Rs.500 on card at Amazon', false],
    ['', false],
  ])('%s -> %s', (text, expected) => expect(looksLikeTransfer(text)).toBe(expected))

  test('pairs an equal debit and credit between two of your own accounts', () => {
    const txs = [
      tx({ id: 'd1', amount: 5000, account_id: 'sav', timestamp: d(2026, 9, 5, 10) }),
      tx({ id: 'c1', type: 'CREDIT', amount: 5000, card_id: 'cc', timestamp: d(2026, 9, 5, 11) }),
      tx({ id: 'd2', amount: 700, account_id: 'sav' }),
    ]
    expect(findTransferPairs(txs)).toEqual([{ debitId: 'd1', creditId: 'c1' }])
  })
  test('does not pair across the window, same owner, unowned or already-judged rows', () => {
    const base = { amount: 5000 }
    expect(findTransferPairs([tx({ ...base, id: 'a', account_id: 'x' }), tx({ ...base, id: 'b', type: 'CREDIT', account_id: 'y', timestamp: d(2026, 9, 7) })])).toEqual([])
    expect(findTransferPairs([tx({ ...base, id: 'a', account_id: 'x' }), tx({ ...base, id: 'b', type: 'CREDIT', account_id: 'x' })])).toEqual([])
    expect(findTransferPairs([tx({ ...base, id: 'a' }), tx({ ...base, id: 'b', type: 'CREDIT', account_id: 'y' })])).toEqual([])
    expect(findTransferPairs([tx({ ...base, id: 'a', account_id: 'x', transfer: 'NOT' }), tx({ ...base, id: 'b', type: 'CREDIT', account_id: 'y' })])).toEqual([])
  })
  test('each credit is used once', () => {
    const pairs = findTransferPairs([
      tx({ id: 'a', amount: 100, account_id: 'x' }), tx({ id: 'b', amount: 100, account_id: 'x' }),
      tx({ id: 'c', type: 'CREDIT', amount: 100, account_id: 'y' }),
    ])
    expect(pairs).toHaveLength(1)
  })
  test('ingest marks bill-payment SMS as a transfer, and plain purchases not', () => {
    const plan = planIngest([
      { sender: 'VM-HDFCBK', body: 'Rs.5,000 debited from A/c XX1234 towards your credit card bill payment on 5-10-26', timestamp: d(2026, 9, 5) },
      { sender: 'VM-HDFCBK', body: 'Paid Rs.100 to Swiggy on 5-10-26', timestamp: d(2026, 9, 5, 13) },
    ], {})
    expect(plan.creates.map(c => c.transfer)).toEqual(['AUTO', null])
  })
  test('transfers and split shares change analytics, not balances', () => {
    const start = d(2026, 9, 1), end = d(2026, 10, 1)
    const txs = [
      tx({ amount: 300 }),
      tx({ amount: 5000, transfer: 'AUTO' }),
      tx({ amount: 1000, my_share: 250 }),
      tx({ id: 'inc', type: 'CREDIT', amount: 50000 }),
      tx({ id: 'xfer', type: 'CREDIT', amount: 5000, transfer: 'AUTO' }),
    ]
    expect(isTransfer(txs[1])).toBe(true)
    expect(shareOf(txs[2])).toBe(250)
    expect(aggregateSpend(txs, start, end).total).toBe(550)
    expect(incomeTotal(txs, start, end)).toBe(50000)
  })
  test('refund of a split purchase is scaled to your share', () => {
    const debit = tx({ id: 'dd', amount: 1000, my_share: 250 })
    const refund = tx({ type: 'REFUND', amount: 1000, linked_transaction_id: 'dd', category: null })
    expect(aggregateSpend([debit, refund], d(2026, 9, 1), d(2026, 10, 1)).total).toBe(0)
  })
})

describe('periods', () => {
  test('weeks run Monday to Sunday', () => {
    const wed = d(2026, 9, 21) // Wed 21 Oct 2026
    const p = makePeriod('WEEK', wed)
    expect(new Date(p.start).getDay()).toBe(1)
    expect(periodDays(p)).toBe(7)
    expect(new Date(p.start).getDate()).toBe(19)
    const sunday = makePeriod('WEEK', d(2026, 9, 25))
    expect(sunday.start).toBe(p.start)
  })
  test('shift and labels', () => {
    const m = makePeriod('MONTH', d(2026, 0, 15))
    expect(shiftPeriod(m, -1).start).toBe(new Date(2025, 11, 1).getTime())
    const w = makePeriod('WEEK', d(2026, 9, 21))
    expect(shiftPeriod(w, 1).start).toBe(new Date(2026, 9, 26).getTime())
    expect(shiftPeriod(w, -1).start).toBe(new Date(2026, 9, 12).getTime())
    expect(periodLabel(m)).toContain('2026')
    expect(periodLabel(w)).toMatch(/19.*25 Oct 2026/)
  })
})

describe('analyzePeriod', () => {
  const week = makePeriod('WEEK', d(2026, 9, 21))
  const txs = [
    tx({ amount: 1200, category: 'Food & Dining', merchant: 'Swiggy', timestamp: d(2026, 9, 24, 21) }), // Sat night
    tx({ amount: 150, category: 'Food & Dining', merchant: 'Chai', timestamp: d(2026, 9, 20, 8) }), // Tue morning
    tx({ amount: 80, category: 'Transport', merchant: 'Metro', timestamp: d(2026, 9, 21, 9) }),
    tx({ amount: 400, category: 'Food & Dining', merchant: 'Swiggy', timestamp: d(2026, 9, 14, 13) }), // previous week
    tx({ amount: 900, category: 'Shopping', merchant: 'Amazon', timestamp: d(2026, 9, 13, 13) }), // previous week
    tx({ type: 'CREDIT', amount: 5000, merchant: 'Acme', timestamp: d(2026, 9, 22) }),
  ]
  const a = analyzePeriod(txs, week, d(2026, 9, 25))

  test('totals, income, change vs previous', () => {
    expect(a.total).toBe(1430)
    expect(a.prevTotal).toBe(1300)
    expect(a.delta).toBe(130)
    expect(a.deltaPct).toBe(10)
    expect(a.income).toBe(5000)
    expect(a.savingsRate).toBe(71)
  })
  test('categories ranked with deltas; movers include vanished categories', () => {
    expect(a.categories[0]).toMatchObject({ name: 'Food & Dining', amount: 1350, prev: 400, delta: 950 })
    expect(a.movers.up[0].name).toBe('Food & Dining')
    expect(a.movers.down[0]).toMatchObject({ name: 'Shopping', amount: 0, delta: -900 })
  })
  test('daily buckets and busiest day', () => {
    expect(a.daily).toHaveLength(7)
    expect(a.busiest.amount).toBe(1200)
    expect(a.daily.reduce((s, x) => s + x.amount, 0)).toBe(1430)
  })
  test('patterns', () => {
    expect(a.patterns.weekend).toBe(1200)
    expect(a.patterns.weekendShare).toBe(84)
    expect(a.patterns.timeOfDay.night).toBe(1200)
    expect(a.patterns.small).toMatchObject({ count: 2, total: 230 })
  })
  test('top expenses are sorted and capped', () => {
    expect(a.top[0]).toMatchObject({ merchant: 'Swiggy', amount: 1200 })
    expect(a.top.length).toBeLessThanOrEqual(10)
  })
  test('average per day uses elapsed days for the current week', () => {
    expect(a.avgPerDay).toBeCloseTo(1430 / 7)
  })
  test('empty period is safe', () => {
    const e = analyzePeriod([], week, d(2026, 9, 25))
    expect(e).toMatchObject({ total: 0, savingsRate: null, busiest: null, top: [] })
  })
})

describe('trends and projection', () => {
  const now = d(2026, 9, 20)
  const txs = [
    tx({ amount: 1000, category: 'Food & Dining', timestamp: d(2026, 7, 5) }),
    tx({ amount: 2000, category: 'Food & Dining', timestamp: d(2026, 8, 5) }),
    tx({ amount: 3000, category: 'Shopping', timestamp: d(2026, 9, 5) }),
    tx({ type: 'CREDIT', amount: 10000, timestamp: d(2026, 8, 1) }),
  ]
  test('monthlyTrend is oldest first, ends this month', () => {
    const t = monthlyTrend(txs, now, 4)
    expect(t).toHaveLength(4)
    expect(t.map(m => m.total)).toEqual([0, 1000, 2000, 3000])
    expect(t[2].income).toBe(10000)
  })
  test('categoryTrend aligns series with months', () => {
    const c = categoryTrend(txs, now, 4, 5)
    const food = c.find(x => x.name === 'Food & Dining')
    expect(food.values).toEqual([0, 1000, 2000, 0])
    expect(c.find(x => x.name === 'Shopping').values).toEqual([0, 0, 0, 3000])
  })
  test('averageSurplus ignores negative months', () => {
    expect(averageSurplus(txs, now, 3)).toBeGreaterThanOrEqual(0)
  })
  test('runRate only for the current month after a few days', () => {
    const m = makePeriod('MONTH', now)
    expect(runRate(2000, m, now).projected).toBeCloseTo((2000 / 20) * 31)
    expect(runRate(2000, m, d(2026, 9, 2))).toBeNull()
    expect(runRate(2000, shiftPeriod(m, -1), now)).toBeNull()
    expect(runRate(2000, makePeriod('WEEK', now), now)).toBeNull()
  })
})

describe('budgets and goals', () => {
  const spend = { total: 9000, categories: [{ name: 'Food & Dining', amount: 4500 }, { name: 'Shopping', amount: 4500 }], merchants: [] }
  test('levels', () => {
    expect(levelFor(0.5)).toBe('ok'); expect(levelFor(0.8)).toBe('warning'); expect(levelFor(1)).toBe('over')
  })
  test('overall + category status and daily allowance', () => {
    const now = d(2026, 9, 21)
    const s = budgetStatus([
      { id: 'o', category: 'ALL', amount: 12000 },
      { id: 'f', category: 'Food & Dining', amount: 5000 },
      { id: 'z', category: 'Transport', amount: 1000 },
    ], spend, d(2026, 10, 1, 0), now)
    expect(s.overall).toMatchObject({ spent: 9000, remaining: 3000, level: 'ok' })
    expect(s.daysLeft).toBe(11)
    expect(s.overall.dailyAllowance).toBeCloseTo(3000 / 11)
    expect(s.categories[0]).toMatchObject({ category: 'Food & Dining', level: 'warning' })
    expect(s.categories[1]).toMatchObject({ category: 'Transport', spent: 0 })
  })
  test('overspent budget has no negative allowance', () => {
    const s = budgetStatus([{ id: 'o', category: 'ALL', amount: 5000 }], spend, d(2026, 10, 1, 0), d(2026, 9, 21))
    expect(s.overall).toMatchObject({ level: 'over', dailyAllowance: 0 })
  })
  test('goal progress', () => {
    const now = d(2026, 9, 1)
    const g = { target_amount: 120000, saved_amount: 30000, target_date: d(2027, 2, 1) }
    const p = goalProgress(g, 20000, now)
    expect(p).toMatchObject({ pct: 25, remaining: 90000, done: false, overdue: false })
    expect(p.monthsLeft).toBe(5)
    expect(p.requiredPerMonth).toBe(18000)
    expect(p.onTrack).toBe(true)
    expect(goalProgress(g, 5000, now).onTrack).toBe(false)
    expect(goalProgress({ ...g, saved_amount: 120000 }, 0, now)).toMatchObject({ done: true, onTrack: true })
    expect(goalProgress({ ...g, target_date: d(2026, 8, 1) }, 0, now)).toMatchObject({ overdue: true })
  })
})

describe('anomalies', () => {
  const hist = [100, 120, 90, 110].map((a, i) => tx({ id: 'h' + i, amount: a, merchant: 'Swiggy', category: 'Food & Dining', timestamp: d(2026, 8, 1 + i * 3) }))
  const now = d(2026, 9, 5)
  test('unusual amount for a known merchant', () => {
    const out = detectAnomalies(tx({ id: 'n', amount: 4500, merchant: 'Swiggy', category: 'Food & Dining', timestamp: now }), hist)
    expect(out[0].kind).toBe('UNUSUAL')
    expect(out[0].message).toContain('usual')
  })
  test('normal or slightly higher amounts are fine', () => {
    expect(detectAnomalies(tx({ id: 'n', amount: 140, merchant: 'Swiggy', timestamp: now }), hist)).toEqual([])
    expect(detectAnomalies(tx({ id: 'n', amount: 600, merchant: 'Swiggy', timestamp: now }), hist)).toEqual([]) // 5x but under +500? 600-105=495
  })
  test('duplicate within 10 minutes', () => {
    const first = tx({ id: 'a', amount: 250, merchant: 'Cafe', timestamp: now })
    const second = tx({ id: 'b', amount: 250, merchant: 'CAFE', timestamp: now + 5 * 60000 })
    expect(detectAnomalies(second, [first])[0].kind).toBe('DUPLICATE')
    expect(detectAnomalies(tx({ id: 'c', amount: 250, merchant: 'Cafe', timestamp: now + 30 * 60000 }), [first])).toEqual([])
  })
  test('category fallback for a new merchant, ignoring unknown vendors, credits and transfers', () => {
    const catHist = [200, 220, 180, 210, 190, 205].map((a, i) => tx({ id: 'c' + i, amount: a, merchant: 'M' + i, category: 'Food & Dining' }))
    expect(detectAnomalies(tx({ id: 'n', amount: 5000, merchant: 'New Place', category: 'Food & Dining' }), catHist)[0].kind).toBe('UNUSUAL')
    expect(detectAnomalies(tx({ id: 'n', amount: 5000, merchant: 'Unknown Vendor', category: null }), catHist)).toEqual([])
    expect(detectAnomalies(tx({ id: 'n', type: 'CREDIT', amount: 99999 }), catHist)).toEqual([])
    expect(detectAnomalies(tx({ id: 'n', amount: 99999, transfer: 'AUTO', category: 'Food & Dining' }), catHist)).toEqual([])
  })
})

describe('salary, bills, splits, tags', () => {
  test('salary detection and payday countdown', () => {
    const pay = (m, day, amt = 60000) => tx({ type: 'CREDIT', amount: amt, merchant: 'Acme Corp', timestamp: d(2026, m, day) })
    const s = detectSalary([pay(7, 1), pay(8, 2), pay(9, 1)], d(2026, 9, 20))
    expect(s).toMatchObject({ merchant: 'Acme Corp', amount: 60000, day: 1 })
    expect(s.nextDate).toBe(new Date(2026, 10, 1).getTime())
    expect(s.daysUntil).toBe(12)
  })
  test('single credit counts only when labelled salary', () => {
    const one = tx({ type: 'CREDIT', amount: 40000, merchant: 'NEFT-ACME SALARY', timestamp: d(2026, 9, 1) })
    expect(detectSalary([one], d(2026, 9, 20))).not.toBeNull()
    expect(detectSalary([{ ...one, merchant: 'Rahul' }], d(2026, 9, 20))).toBeNull()
  })
  test('ignores small, irregular, stale and transfer credits', () => {
    const now = d(2026, 9, 20)
    expect(detectSalary([tx({ type: 'CREDIT', amount: 900, merchant: 'A', timestamp: d(2026, 8, 1) }), tx({ type: 'CREDIT', amount: 900, merchant: 'A', timestamp: d(2026, 9, 1) })], now)).toBeNull()
    expect(detectSalary([tx({ type: 'CREDIT', amount: 9000, merchant: 'B', timestamp: d(2026, 5, 1) }), tx({ type: 'CREDIT', amount: 9000, merchant: 'B', timestamp: d(2026, 6, 1) })], now)).toBeNull()
    expect(detectSalary([tx({ type: 'CREDIT', amount: 9000, merchant: 'C', timestamp: d(2026, 8, 1), transfer: 'AUTO' }), tx({ type: 'CREDIT', amount: 9000, merchant: 'C', timestamp: d(2026, 9, 1), transfer: 'AUTO' })], now)).toBeNull()
  })
  test('upcoming bills expand monthly renewals and total this week', () => {
    const now = d(2026, 9, 20, 9)
    const subs = [
      { id: 's1', name: 'Netflix', amount: 649, billing_cycle: 'MONTHLY', next_billing_date: d(2026, 9, 22), is_active: true },
      { id: 's2', name: 'Prime', amount: 1499, billing_cycle: 'YEARLY', next_billing_date: d(2026, 11, 15), is_active: true },
      { id: 's3', name: 'Old', amount: 99, billing_cycle: 'MONTHLY', next_billing_date: d(2026, 9, 21), is_active: false },
      { id: 's4', name: 'Lapsed', amount: 200, billing_cycle: 'MONTHLY', next_billing_date: d(2026, 7, 25), is_active: true },
    ]
    const u = upcomingBills(subs, now, 30)
    expect(u.items.map(i => i.name)).toEqual(['Netflix', 'Lapsed'])
    expect(u.dueThisWeek).toBe(649 + 200) // Lapsed rolls forward to 25 Oct, also inside the week
    expect(u.groups).toHaveLength(2)
  })
  test('owed by person ignores settled and merges name casing', () => {
    const r = owedByPerson([
      { person: 'Anil', amount: 300, is_settled: false }, { person: 'anil ', amount: 200, is_settled: false },
      { person: 'Riya', amount: 100, is_settled: true }, { person: 'Meera', amount: 50, is_settled: false },
    ])
    expect(r.total).toBe(550)
    expect(r.people[0]).toMatchObject({ owed: 500, count: 2 })
    expect(r.people).toHaveLength(2)
  })
  test('myShareAfterSplit', () => {
    expect(myShareAfterSplit(1000, [300, 300])).toBe(400)
    expect(myShareAfterSplit(1000, [1000])).toBe(0)
    expect(myShareAfterSplit(1000, [600, 600])).toBeNull()
    expect(myShareAfterSplit(1000, [0])).toBeNull()
  })
  test('tags', () => {
    expect(parseTags('Trip, #Goa  work,trip')).toEqual(['trip', 'goa', 'work'])
    expect(tagsToString(['A', 'b', 'a'])).toBe('a,b')
    expect(parseTags('')).toEqual([])
  })
})

describe('number format', () => {
  test('lakh grouping vs international', () => {
    setGroupingOverride('lakh'); expect(formatMoney(1234567)).toBe('₹12,34,567')
    setGroupingOverride('standard'); expect(formatMoney(1234567)).toBe('₹1,234,567')
    setGroupingOverride(null)
  })
})

describe('encrypted backup', () => {
  const opts = { randomBytes, iterations: 1000 } // fast for tests; the app uses 100k
  test('base64 round trip for any length', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 31, 32, 33]) {
      const bytes = randomBytes(len)
      expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes))
    }
  })
  test('round trip including unicode', async () => {
    const secret = JSON.stringify({ merchant: 'चाय Point ₹', n: 1 })
    const blob = await encryptText(secret, 'correct horse', opts)
    expect(blob).not.toContain('Point')
    expect(await decryptText(blob, 'correct horse')).toBe(secret)
  })
  test('wrong passphrase, tampering and junk are rejected', async () => {
    const blob = await encryptText('hello', 'pw', opts)
    await expect(decryptText(blob, 'nope')).rejects.toThrow(/Wrong passphrase/)
    const file = JSON.parse(blob)
    file.data = toBase64(Uint8Array.from(fromBase64(file.data), (b, i) => (i === 0 ? b ^ 1 : b)))
    await expect(decryptText(JSON.stringify(file), 'pw')).rejects.toThrow(/Wrong passphrase/)
    await expect(decryptText('not json', 'pw')).rejects.toThrow(/not an Outspend backup/)
    await expect(decryptText('{"app":"x"}', 'pw')).rejects.toThrow(/not an Outspend backup/)
  })
  test('same input encrypts differently each time', async () => {
    expect(await encryptText('a', 'pw', opts)).not.toBe(await encryptText('a', 'pw', opts))
  })
  test('empty passphrase refused on encrypt', async () => {
    await expect(encryptText('a', '', opts)).rejects.toThrow()
  })
})

import { shouldLockOnResume, isUnenforceable } from '../src/services/LockLogic'

describe('app lock logic (uses the phone screen lock, no app PIN)', () => {
  test('locks after 30 s in the background, not before, not when off', () => {
    const now = 1_000_000
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: now - 31000, now })).toBe(true)
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: now - 5000, now })).toBe(false)
    expect(shouldLockOnResume({ enabled: false, backgroundedAt: now - 99999, now })).toBe(false)
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: null, now })).toBe(false)
  })
  test('a phone with no screen lock can never lock the user out', () => {
    for (const e of ['passcode_not_set', 'not_enrolled', 'not_available']) expect(isUnenforceable(e)).toBe(true)
    for (const e of ['user_cancel', 'authentication_failed', 'lockout', 'timeout']) expect(isUnenforceable(e)).toBe(false)
  })
})
