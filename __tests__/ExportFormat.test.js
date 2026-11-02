import { csvField, toCsv, toJson, escapeHtml, buildBillHtml, buildReportHtml } from '../src/services/ExportFormat'

const tx = (o) => ({ id: '1', timestamp: Date.UTC(2026, 9, 5, 12), merchant: 'Shop', amount: 100, type: 'DEBIT', category: 'Shopping', source: 'SMS', ...o })

describe('csv', () => {
  test('quotes commas, quotes and newlines; keeps content intact', () => {
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
    expect(csvField(null)).toBe('')
    expect(csvField(12.5)).toBe('12.5')
  })
  test('full export keeps commas in merchant names', () => {
    const csv = toCsv([tx({ merchant: 'Ravi, Sons & Co', notes: 'split "dinner"' })])
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('Date,Merchant,Amount,Currency,Type,Category,Source,Account,Notes,Has receipt,Your share,Tags,Transfer')
    expect(lines[1]).toContain('"Ravi, Sons & Co"')
    expect(lines[1]).toContain('"split ""dinner"""')
  })
  test('account names resolve', () => {
    expect(toCsv([tx({ account_id: 'a1' })], { a1: 'HDFC' })).toContain(',HDFC,')
  })
})

describe('json', () => {
  test('is valid JSON with all rows', () => {
    const out = JSON.parse(toJson([tx({}), tx({ id: '2' })]))
    expect(out.count).toBe(2)
    expect(out.transactions[0]).toMatchObject({ merchant: 'Shop', amount: 100 })
  })
})

describe('bill html', () => {
  test('escapes user content', () => {
    expect(escapeHtml('<b>"x"&')).toBe('&lt;b&gt;&quot;x&quot;&amp;')
    const html = buildBillHtml([tx({ merchant: '<script>alert(1)</script>' })])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
  test('totals the rows', () => {
    const html = buildBillHtml([tx({ amount: 100 }), tx({ amount: 250.5 })])
    expect(html).toContain('₹350.50')
  })
})

import { computeAccess } from '../src/services/Access'

describe('computeAccess', () => {
  const DAY = 86400000
  const now = Date.UTC(2026, 9, 22)
  test('subscribed wins', () => {
    expect(computeAccess({ now, trialStartedAt: now - 99 * DAY, entitled: true })).toMatchObject({ status: 'subscribed', hasAccess: true })
  })
  test('trial counts down and expires after 30 days', () => {
    expect(computeAccess({ now, trialStartedAt: now - 1 * DAY, entitled: false })).toMatchObject({ status: 'trial', trialDaysLeft: 29 })
    expect(computeAccess({ now, trialStartedAt: now - 29.5 * DAY, entitled: false })).toMatchObject({ status: 'trial', trialDaysLeft: 1 })
    expect(computeAccess({ now, trialStartedAt: now - 30 * DAY, entitled: false })).toMatchObject({ status: 'expired', hasAccess: false })
  })
  test('offline: recent entitlement is honoured, stale one is not', () => {
    const base = { now, trialStartedAt: now - 60 * DAY, entitled: null }
    expect(computeAccess({ ...base, lastEntitledAt: now - 2 * DAY }).status).toBe('subscribed')
    expect(computeAccess({ ...base, lastEntitledAt: now - 9 * DAY }).status).toBe('expired')
    expect(computeAccess({ ...base, lastEntitledAt: null }).status).toBe('expired')
  })
  test('offline during trial stays in trial', () => {
    expect(computeAccess({ now, trialStartedAt: now - 5 * DAY, entitled: null }).status).toBe('trial')
  })
  test('no trial start recorded yet starts a fresh trial', () => {
    expect(computeAccess({ now, trialStartedAt: null, entitled: false })).toMatchObject({ status: 'trial', trialDaysLeft: 30 })
  })
})

describe('csv extras and report', () => {
  test('share, tags and transfer columns', () => {
    const csv = toCsv([tx({ my_share: 250, tags: 'goa,trip', transfer: 'AUTO' })])
    expect(csv.trim().split('\r\n')[1]).toMatch(/,No,250,"?goa,trip"?,Yes$/)
    const json = JSON.parse(toJson([tx({ my_share: 250, tags: 'goa,trip', transfer: 'USER' })]))
    expect(json.transactions[0]).toMatchObject({ yourShare: 250, tags: ['goa', 'trip'], transfer: true })
  })
  test('report card contains the numbers and escapes names', () => {
    const a = {
      total: 5000, deltaPct: 12, income: 20000, net: 15000, savingsRate: 75, avgPerDay: 166.6,
      categories: [{ name: '<b>Food</b>', amount: 3000, deltaPct: null }],
      top: [{ timestamp: Date.UTC(2026, 9, 5), merchant: 'Swiggy', category: 'Food & Dining', amount: 1200 }],
      movers: { up: [{ name: 'Dining', delta: 900 }], down: [] },
    }
    const html = buildReportHtml(a, 'October 2026')
    expect(html).toContain('₹5,000')
    expect(html).toContain('+12%')
    expect(html).toContain('(75%)')
    expect(html).toContain('&lt;b&gt;Food&lt;/b&gt;')
    expect(html).not.toContain('<b>Food</b>')
    expect(html).toContain('Biggest rise')
  })
})
