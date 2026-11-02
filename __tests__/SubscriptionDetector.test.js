import { detectSubscriptions, rollForward, addCycle, subscriptionKey } from '../src/services/SubscriptionDetector'

const d = (y, m, day) => new Date(y, m, day, 12).getTime()
const tx = (o) => ({ id: 'x' + Math.random(), type: 'DEBIT', amount: 649, merchant: 'Netflix', timestamp: d(2026, 7, 5), ...o })

describe('detectSubscriptions', () => {
  const now = d(2026, 9, 20)
  test('detects a monthly subscription and projects the next date', () => {
    const txs = [tx({ timestamp: d(2026, 7, 5) }), tx({ timestamp: d(2026, 8, 5) }), tx({ timestamp: d(2026, 9, 5) })]
    const out = detectSubscriptions(txs, { now })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ merchant: 'Netflix', amount: 649, cycle: 'MONTHLY' })
    expect(out[0].nextDate).toBe(d(2026, 10, 5))
  })
  test('tolerates small price drift but not big', () => {
    const drift = [tx({ amount: 649, timestamp: d(2026, 8, 5) }), tx({ amount: 660, timestamp: d(2026, 9, 5) })]
    expect(detectSubscriptions(drift, { now })).toHaveLength(1)
    const big = [tx({ amount: 649, timestamp: d(2026, 8, 5) }), tx({ amount: 900, timestamp: d(2026, 9, 5) })]
    expect(detectSubscriptions(big, { now })).toHaveLength(0)
  })
  test('detects yearly', () => {
    const txs = [tx({ merchant: 'Prime', amount: 1499, timestamp: d(2025, 9, 10) }), tx({ merchant: 'Prime', amount: 1499, timestamp: d(2026, 9, 10) })]
    expect(detectSubscriptions(txs, { now })[0]).toMatchObject({ cycle: 'YEARLY' })
  })
  test('ignores irregular gaps, singles, credits, deleted, unknown vendors', () => {
    expect(detectSubscriptions([tx({ timestamp: d(2026, 9, 1) }), tx({ timestamp: d(2026, 9, 9) })], { now })).toHaveLength(0)
    expect(detectSubscriptions([tx({})], { now })).toHaveLength(0)
    const monthly = (o) => [tx({ ...o, timestamp: d(2026, 8, 5) }), tx({ ...o, timestamp: d(2026, 9, 5) })]
    expect(detectSubscriptions(monthly({ type: 'CREDIT' }), { now })).toHaveLength(0)
    expect(detectSubscriptions(monthly({ is_deleted: true }), { now })).toHaveLength(0)
    expect(detectSubscriptions(monthly({ merchant: 'Unknown Vendor' }), { now })).toHaveLength(0)
  })
  test('skips already-tracked, dismissed and stale subscriptions', () => {
    const txs = [tx({ timestamp: d(2026, 8, 5) }), tx({ timestamp: d(2026, 9, 5) })]
    expect(detectSubscriptions(txs, { now, existing: [{ merchant: 'Netflix' }] })).toHaveLength(0)
    expect(detectSubscriptions(txs, { now, dismissed: [subscriptionKey('Netflix', 'MONTHLY')] })).toHaveLength(0)
    const old = [tx({ timestamp: d(2026, 1, 5) }), tx({ timestamp: d(2026, 2, 5) })]
    expect(detectSubscriptions(old, { now })).toHaveLength(0)
  })
})

describe('dates', () => {
  test('rollForward lands in the future', () => {
    const now = d(2026, 9, 20)
    expect(rollForward(d(2026, 6, 5), 'MONTHLY', now)).toBe(d(2026, 10, 5))
    expect(rollForward(d(2026, 11, 5), 'MONTHLY', now)).toBe(d(2026, 11, 5))
  })
  test('addCycle', () => {
    expect(addCycle(d(2026, 0, 31), 'YEARLY')).toBe(d(2027, 0, 31))
  })
})
