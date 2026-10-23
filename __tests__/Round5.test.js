import { salaryKey, isSalaryCredit, salaryAnchors, cycleLength, makeCyclePeriod, shiftCycle, resolveMonthPeriod, salaryMissingThisMonth } from '../src/services/PayCycle'
import { makePeriod, shiftPeriod, periodLabel, periodDays, analyzePeriod, runRate, trendFor, categoryTrendFor, isCurrentPeriod } from '../src/services/Insights'
import { aggregateSpend, incomeTotal } from '../src/services/Analytics'
import { detectSalary } from '../src/services/Planning'
import { DEFAULT_FILTERS, UNASSIGNED, filterTransactions, hasActiveFilters, spentIn, matchesAccount } from '../src/services/LedgerFilter'
import { budgetStatus } from '../src/services/Budgets'

const d = (y, m, day, h = 12) => new Date(y, m, day, h).getTime()
let n = 0
const tx = (o) => ({ id: 't' + n++, type: 'DEBIT', amount: 100, merchant: 'Shop', category: 'Shopping', timestamp: d(2026, 9, 5), ...o })
const pay = (m, day, amount = 200000, o = {}) => tx({ type: 'CREDIT', amount, merchant: 'VW India Pvt Ltd', category: null, timestamp: d(2026, m, day), ...o })
const SOURCE = { key: salaryKey('VW India') }

describe('R5-5: credits posted to a card are never income', () => {
  const start = d(2026, 9, 1), end = d(2026, 10, 1)
  test('a card credit does not count, a bank credit does', () => {
    const txs = [tx({ type: 'CREDIT', amount: 5000, card_id: 'card1' }), tx({ type: 'CREDIT', amount: 70000, account_id: 'a1' })]
    expect(incomeTotal(txs, start, end)).toBe(70000)
  })
  test('nor does it look like a salary', () => {
    const credits = [8, 9].map(m => tx({ type: 'CREDIT', amount: 60000, merchant: 'Acme', card_id: 'c', timestamp: d(2026, m, 1) }))
    expect(detectSalary(credits, d(2026, 9, 20))).toBeNull()
  })
})

describe('R5-8: pay cycles', () => {
  // salary landed on 30 Jun (Tue), 31 Jul, 28 Aug (Fri, 30th was a weekend), 30 Sep
  const anchors = salaryAnchors([pay(5, 30), pay(6, 31, 195000), pay(7, 28, 201000), pay(8, 30, 201000)], SOURCE)

  test('matches by who paid, whatever the amount, and ignores other credits', () => {
    expect(anchors).toHaveLength(4)
    expect(isSalaryCredit(pay(9, 1, 5), SOURCE)).toBe(true) // amount is irrelevant
    expect(isSalaryCredit(pay(9, 1, 200000, { merchant: 'NEFT-VW INDIA PVT LTD SALARY' }), SOURCE)).toBe(true) // name variations
    expect(isSalaryCredit(tx({ type: 'CREDIT', merchant: 'Rahul' }), SOURCE)).toBe(false)
    expect(isSalaryCredit(pay(9, 1, 1, { card_id: 'c' }), SOURCE)).toBe(false)
    expect(isSalaryCredit(pay(9, 1, 1, { transfer: 'AUTO' }), SOURCE)).toBe(false)
    expect(isSalaryCredit(pay(9, 1, 1, { currency: 'USD' }), SOURCE)).toBe(false)
    expect(isSalaryCredit(pay(9, 1, 1, { is_deleted: true }), SOURCE)).toBe(false)
    expect(isSalaryCredit(pay(9, 1), null)).toBe(false)
    expect(isSalaryCredit(tx({ type: 'DEBIT', merchant: 'VW India' }), SOURCE)).toBe(false)
  })

  test('two credits a couple of days apart are one salary', () => {
    const a = salaryAnchors([pay(8, 30, 150000), pay(9, 1, 50000)], SOURCE)
    expect(a).toHaveLength(1)
  })

  test('cycle length follows the real gaps and is kept sensible', () => {
    expect(cycleLength(anchors)).toBe(31) // gaps are 31, 28 and 33 days
    expect(cycleLength([anchors[0]])).toBe(30)
    expect(cycleLength([d(2026, 0, 1), d(2026, 0, 10)])).toBe(25) // clamped
  })

  test('the salary day starts the new cycle and the next one ends it', () => {
    const p = makeCyclePeriod(anchors, d(2026, 8, 15), d(2026, 9, 20))
    expect(p.start).toBe(d(2026, 7, 28, 0)) // 28 Aug, the real (weekend-shifted) payday
    expect(p.end).toBe(d(2026, 8, 30, 0)) // 30 Sep: the salary day belongs to the NEXT cycle
    expect(p.open).toBe(false)
    expect(periodDays(p)).toBe(33)
  })

  test('the current cycle stays open until the next salary and always includes today', () => {
    const now = d(2026, 9, 20)
    const p = makeCyclePeriod(anchors, now, now)
    expect(p.start).toBe(d(2026, 8, 30, 0))
    expect(p.open).toBe(true)
    expect(isCurrentPeriod(p, now)).toBe(true)
    // salary is late: still no new anchor in December, but the period still covers "now"
    const late = d(2026, 11, 20)
    const q = makeCyclePeriod(anchors, late, late)
    expect(isCurrentPeriod(q, late)).toBe(true)
  })

  test('before the first salary there is no cycle', () => {
    expect(makeCyclePeriod(anchors, d(2026, 4, 1), d(2026, 9, 20))).toBeNull()
    expect(makeCyclePeriod([], d(2026, 9, 1))).toBeNull()
  })

  test('the user\'s case: salary at month end, spent next month, no distortion', () => {
    // Sep 30 salary 2,01,000; October spending 24,000 -> belongs to the cycle that starts 30 Sep
    const txs = [pay(8, 30, 201000), tx({ amount: 24000, timestamp: d(2026, 9, 12) }), tx({ amount: 8000, timestamp: d(2026, 8, 10) })]
    const now = d(2026, 9, 20)
    const cycle = makeCyclePeriod(salaryAnchors(txs, SOURCE), now, now)
    const a = analyzePeriod(txs, cycle, now)
    expect(a.income).toBe(201000)
    expect(a.total).toBe(24000)
    expect(a.savingsRate).toBe(88)
    // the calendar month shows the distortion this feature removes
    const calendar = analyzePeriod(txs, makePeriod('MONTH', now), now)
    expect(calendar.income).toBe(0)
    expect(calendar.savingsRate).toBeNull()
  })

  test('navigating back and forward between cycles', () => {
    const now = d(2026, 9, 20)
    const cur = makeCyclePeriod(anchors, now, now)
    const prev = shiftPeriod(cur, -1)
    expect(prev.start).toBe(d(2026, 7, 28, 0))
    expect(prev.end).toBe(cur.start)
    expect(shiftPeriod(prev, 1).start).toBe(cur.start)
    expect(shiftPeriod(cur, 1)).toBe(cur) // cannot go past the current cycle
    // before the first salary a typical-length cycle is assumed
    const first = makeCyclePeriod(anchors, anchors[0], now)
    const before = shiftCycle(first, -1)
    expect(before.synthetic).toBe(true)
    expect(before.end).toBe(first.start)
  })

  test('label, projection and trend work on cycles', () => {
    const now = d(2026, 9, 20)
    const cur = makeCyclePeriod(anchors, now, now)
    expect(periodLabel(cur)).toMatch(/30 Sep\w* – today/i)
    const closed = shiftPeriod(cur, -1)
    expect(periodLabel(closed)).toMatch(/2026/)
    expect(runRate(15000, cur, now).projected).toBeGreaterThan(15000)
    const txs = [pay(7, 28), pay(8, 30), tx({ amount: 3000, timestamp: d(2026, 8, 5) }), tx({ amount: 5000, timestamp: d(2026, 9, 5), category: 'Food & Dining' })]
    const trend = trendFor(txs, cur, 3)
    expect(trend).toHaveLength(3)
    expect(trend[2].total).toBe(5000)
    expect(trend[1].total).toBe(3000)
    expect(trend[1].income).toBe(200000)
    const cats = categoryTrendFor(txs, cur, 3, 5)
    expect(cats.find(c => c.name === 'Food & Dining').values).toEqual([0, 0, 5000])
  })

  test('resolveMonthPeriod uses the cycle once a source exists, the calendar otherwise', () => {
    const now = d(2026, 9, 20)
    const txs = [pay(7, 28), pay(8, 30)]
    const cal = (ts) => makePeriod('MONTH', ts)
    expect(resolveMonthPeriod(now, SOURCE, txs, cal, now).mode).toBe('CYCLE')
    expect(resolveMonthPeriod(now, null, txs, cal, now).mode).toBe('MONTH')
    expect(resolveMonthPeriod(now, SOURCE, [], cal, now).mode).toBe('MONTH') // none seen yet
    expect(resolveMonthPeriod(d(2026, 4, 1), SOURCE, txs, cal, now).mode).toBe('MONTH') // before the first salary
  })

  test('budgets measure against the cycle', () => {
    const now = d(2026, 9, 20)
    const txs = [pay(8, 30), tx({ amount: 9000, timestamp: d(2026, 9, 5) }), tx({ amount: 4000, timestamp: d(2026, 8, 20) })]
    const cycle = makeCyclePeriod(salaryAnchors(txs, SOURCE), now, now)
    const spend = aggregateSpend(txs, cycle.start, cycle.end)
    expect(spend.total).toBe(9000) // the 20 Sep spend belongs to the previous cycle
    const s = budgetStatus([{ id: 'o', category: 'ALL', amount: 12000 }], spend, cycle.end, now)
    expect(s.overall).toMatchObject({ spent: 9000, remaining: 3000 })
  })

  test('"has your salary arrived?" only in the first days of a month when it is overdue', () => {
    const a = salaryAnchors([pay(7, 28), pay(8, 30)], SOURCE) // last salary 30 Sep
    expect(salaryMissingThisMonth(a, d(2026, 9, 1))).toBe(false) // salary landed 30 Sep: fine
    expect(salaryMissingThisMonth(a, d(2026, 10, 2))).toBe(true) // 2 Nov and nothing since 30 Sep... 
    expect(salaryMissingThisMonth(a, d(2026, 10, 12))).toBe(false) // only nudge in days 1-5
    expect(salaryMissingThisMonth([], d(2026, 10, 2))).toBe(false)
  })
})

describe('R5-3/R5-4: ledger filters', () => {
  const rows = [
    tx({ id: 'a', merchant: 'Swiggy', category: 'Food & Dining', account_id: 'acc1', timestamp: d(2026, 9, 10), notes: 'biryani', tags: 'trip' }),
    tx({ id: 'b', merchant: 'Amazon', category: null, card_id: 'card1', timestamp: d(2026, 8, 1), notes: 'phone charger' }),
    tx({ id: 'c', type: 'CREDIT', merchant: 'VW', amount: 200000, account_id: 'acc2', timestamp: d(2026, 9, 1) }),
    tx({ id: 'd', merchant: 'To wallet', transfer: 'AUTO', account_id: 'acc1', timestamp: d(2026, 9, 11), receipt_path: 'file://x' }),
    tx({ id: 'e', merchant: 'Cash', timestamp: d(2026, 9, 12) }),
  ]
  const ids = (f) => filterTransactions(rows, { ...DEFAULT_FILTERS, ...f }).map(t => t.id)

  test('no filters returns everything', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })
  test('account filter matches accounts, cards and unassigned', () => {
    expect(ids({ account: 'acc1' })).toEqual(['a', 'd'])
    expect(ids({ account: 'card1' })).toEqual(['b'])
    expect(ids({ account: UNASSIGNED })).toEqual(['e'])
    expect(matchesAccount(rows[0], 'acc2')).toBe(false)
  })
  test('type, category, tag, period', () => {
    expect(ids({ type: 'CREDIT' })).toEqual(['c'])
    expect(ids({ category: 'Food & Dining' })).toEqual(['a'])
    expect(ids({ category: 'Uncategorized' })).toEqual(['b'])
    expect(ids({ tag: 'trip' })).toEqual(['a'])
    expect(ids({ from: d(2026, 9, 5) })).toEqual(['a', 'd', 'e']) // the 1 Oct salary is before the 5th
  })
  test('search covers the item name', () => {
    expect(ids({ query: 'charger' })).toEqual(['b'])
    expect(ids({ query: 'BIRYANI' })).toEqual(['a'])
  })
  test('show: no receipt, only transfers, hide transfers', () => {
    expect(ids({ show: 'NO_RECEIPT' })).toEqual(['a', 'b', 'e'])
    expect(ids({ show: 'TRANSFERS' })).toEqual(['d'])
    expect(ids({ show: 'HIDE_TRANSFERS' })).toEqual(['a', 'b', 'c', 'e'])
  })
  test('filters combine', () => {
    expect(ids({ account: 'acc1', show: 'HIDE_TRANSFERS' })).toEqual(['a'])
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, account: 'acc1' })).toBe(true)
  })
  test('the total of a view excludes transfers and other currencies', () => {
    expect(spentIn(rows)).toBe(100 + 100 + 100) // a, b, e; transfer d ignored, credit ignored
    expect(spentIn([...rows, tx({ amount: 999, currency: 'USD' })])).toBe(300)
  })
})

import { mergeSkipped, dismissEntry, emptyState, MAX_LOGGED, REASON_LABELS } from '../src/services/SkippedLog'
import { planIngest } from '../src/services/IngestPlanner'

describe('R4-A4: skipped-message log', () => {
  const entry = (id, ts, o = {}) => ({ id, sender: 'VM-HDFCBK', timestamp: ts, body: 'x', reason: 'failed', amount: 100, currency: 'INR', ...o })

  test('new entries are added newest first, duplicates and dismissed ones are not', () => {
    let s = mergeSkipped(emptyState(), [entry('a', 1), entry('b', 3), entry('a', 1)])
    expect(s.entries.map(e => e.id)).toEqual(['b', 'a'])
    expect(mergeSkipped(s, [entry('a', 1)])).toBe(s) // nothing new: same object, no write
    s = dismissEntry(s, 'a')
    expect(s.entries.map(e => e.id)).toEqual(['b'])
    expect(mergeSkipped(s, [entry('a', 1)]).entries.map(e => e.id)).toEqual(['b']) // does not come back on re-sync
  })
  test('the list is capped to the newest entries', () => {
    const many = Array.from({ length: MAX_LOGGED + 20 }, (_, i) => entry(`m${i}`, i))
    const s = mergeSkipped(emptyState(), many)
    expect(s.entries).toHaveLength(MAX_LOGGED)
    expect(s.entries[0].timestamp).toBe(MAX_LOGGED + 19)
  })
  test('every logged reason has a readable label', () => {
    for (const r of ['promo', 'failed', 'reminder', 'no_direction']) expect(REASON_LABELS[r]).toBeTruthy()
  })

  test('the planner reports what it skipped and why, but not one-time codes or no-money chatter', () => {
    const ts = 1760000000000
    const plan = planIngest([
      { sender: 'VM-HDFCBK', body: 'Paid Rs.100 to Swiggy on 1-1-26', timestamp: ts },
      { sender: 'VM-HDFCBK', body: 'Txn of Rs.800 at AMAZON failed due to insufficient funds', timestamp: ts + 1 },
      { sender: 'VM-HDFCBK', body: 'Rs.500 is the fee for your account', timestamp: ts + 2 },
      { sender: 'VM-HDFCBK', body: 'Your OTP for txn of Rs.1,000 is 123456. Do not share.', timestamp: ts + 3 },
      { sender: 'VM-HDFCBK', body: 'Welcome to HDFC NetBanking', timestamp: ts + 4 },
    ], {})
    expect(plan.creates).toHaveLength(1)
    expect(plan.skipped).toBe(4)
    expect(plan.skippedDetails.map(d => [d.reason, d.amount])).toEqual([['failed', 800], ['no_direction', 500]])
    expect(plan.skippedDetails[0]).toMatchObject({ sender: 'VM-HDFCBK', timestamp: ts + 1, currency: 'INR' })
    expect(plan.skippedDetails[0].id).toMatch(/^sms_/)
  })
})
