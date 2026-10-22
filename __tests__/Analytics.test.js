import {
  aggregateSpend, accountBalance, cardSpend, cycleStart, dailySpend, monthBounds,
  shiftMonth, utilisation, utilisationLevel, formatINR,
} from '../src/services/Analytics'

const d = (y, m, day, h = 12) => new Date(y, m, day, h).getTime()
const tx = (o) => ({ id: Math.random().toString(36), type: 'DEBIT', amount: 100, merchant: 'Shop', category: 'Shopping', timestamp: d(2026, 9, 5), ...o })

describe('aggregateSpend', () => {
  const { start, end } = monthBounds(2026, 9)
  test('totals debits per category and merchant, ignoring credits, deleted and other months', () => {
    const txs = [
      tx({ amount: 300, category: 'Food & Dining', merchant: 'Swiggy' }),
      tx({ amount: 200, category: 'Food & Dining', merchant: 'Swiggy' }),
      tx({ amount: 100, category: 'Transport', merchant: 'Uber' }),
      tx({ amount: 9999, type: 'CREDIT' }),
      tx({ amount: 777, is_deleted: true }),
      tx({ amount: 555, timestamp: d(2026, 8, 30) }),
      tx({ amount: 444, timestamp: d(2026, 10, 1, 0) }), // exclusive end
    ]
    const r = aggregateSpend(txs, start, end)
    expect(r.total).toBe(600)
    expect(r.categories).toEqual([{ name: 'Food & Dining', amount: 500 }, { name: 'Transport', amount: 100 }])
    expect(r.merchants[0]).toEqual({ name: 'Swiggy', amount: 500 })
  })
  test('refund nets against its linked debit category', () => {
    const debit = tx({ id: 'd1', amount: 1000, category: 'Shopping', merchant: 'Amazon' })
    const refund = tx({ id: 'r1', type: 'REFUND', amount: 1000, category: null, linked_transaction_id: 'd1', timestamp: d(2026, 9, 8) })
    const r = aggregateSpend([debit, refund], start, end)
    expect(r.total).toBe(0)
    expect(r.categories).toEqual([])
  })
  test('uncategorised bucket and empty input', () => {
    expect(aggregateSpend([tx({ category: null })], start, end).categories[0].name).toBe('Uncategorized')
    expect(aggregateSpend([], start, end)).toEqual({ total: 0, categories: [], merchants: [] })
  })
})

describe('months', () => {
  test('shiftMonth wraps years', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
  })
})

describe('dailySpend', () => {
  test('returns 7 buckets ending today', () => {
    const now = d(2026, 9, 10)
    const out = dailySpend([tx({ amount: 50, timestamp: d(2026, 9, 10, 8) }), tx({ amount: 20, timestamp: d(2026, 9, 4) })], now, 7)
    expect(out).toHaveLength(7)
    expect(out[6].amount).toBe(50)
    expect(out[0].amount).toBe(20) // Oct 4 is 6 days before Oct 10 => first bucket
  })
})

describe('accounts and cards', () => {
  test('balance = reconciled balance + movements after reconciliation', () => {
    const acc = { id: 'a1', balance: 1000, last_reconciled_at: d(2026, 9, 1) }
    const txs = [
      tx({ account_id: 'a1', amount: 200, timestamp: d(2026, 9, 2) }),
      tx({ account_id: 'a1', type: 'CREDIT', amount: 500, timestamp: d(2026, 9, 3) }),
      tx({ account_id: 'a1', amount: 999, timestamp: d(2026, 8, 20) }), // before reconciliation
      tx({ account_id: 'other', amount: 999 }),
      tx({ account_id: 'a1', amount: 50, is_deleted: true }),
    ]
    expect(accountBalance(acc, txs)).toBe(1300)
  })
  test('cycleStart before and after billing day', () => {
    expect(cycleStart(15, d(2026, 9, 20))).toBe(new Date(2026, 9, 15).getTime())
    expect(cycleStart(15, d(2026, 9, 10))).toBe(new Date(2026, 8, 15).getTime())
  })
  test('card spend counts only the current cycle and nets refunds', () => {
    const card = { id: 'c1', billing_day: 1 }
    const now = d(2026, 9, 20)
    const txs = [
      tx({ card_id: 'c1', amount: 400, timestamp: d(2026, 9, 3) }),
      tx({ card_id: 'c1', type: 'REFUND', amount: 100, timestamp: d(2026, 9, 5) }),
      tx({ card_id: 'c1', amount: 900, timestamp: d(2026, 8, 20) }),
    ]
    expect(cardSpend(card, txs, now)).toBe(300)
  })
  test('utilisation thresholds', () => {
    expect(utilisation(48000, 50000)).toBeCloseTo(0.96)
    expect(utilisation(10, 0)).toBe(0)
    expect(utilisationLevel(0.5)).toBe('ok')
    expect(utilisationLevel(0.8)).toBe('warning')
    expect(utilisationLevel(0.96)).toBe('critical')
  })
  test('formatINR', () => {
    expect(formatINR(145000)).toBe('₹1,45,000')
    expect(formatINR(75.5)).toBe('₹75.50')
  })
})

import { parseDateInput, parseAmount, toDateInput, dayLabel } from '../src/utils/format'

describe('format helpers', () => {
  test('parseDateInput accepts real dates only', () => {
    const base = new Date(2026, 9, 5, 14, 30).getTime()
    const t = parseDateInput('2026-10-03', base)
    expect(toDateInput(t)).toBe('2026-10-03')
    expect(new Date(t).getHours()).toBe(14)
    expect(parseDateInput('2026-02-30')).toBeNull()
    expect(parseDateInput('03/10/2026')).toBeNull()
    expect(parseDateInput('')).toBeNull()
  })
  test('parseAmount', () => {
    expect(parseAmount('₹1,250.50')).toBe(1250.5)
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
  test('dayLabel', () => {
    const now = new Date(2026, 9, 10, 12).getTime()
    expect(dayLabel(new Date(2026, 9, 10, 1).getTime(), now)).toBe('Today')
    expect(dayLabel(new Date(2026, 9, 9, 23).getTime(), now)).toBe('Yesterday')
  })
})
