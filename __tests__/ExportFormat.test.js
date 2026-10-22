import { csvField, toCsv, toJson, escapeHtml, buildBillHtml } from '../src/services/ExportFormat'

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
    expect(lines[0]).toBe('Date,Merchant,Amount,Type,Category,Source,Account,Notes,Has receipt')
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
