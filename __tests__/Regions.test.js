import {
  setRegion, getRegion, formatMoney, scaled, homeCurrency, isForeignCurrency, parseNumber, numberPattern,
  guessRegionId, REGIONS, regionById, setGroupingOverride, applyRegionSettings, tokenToCurrency, currencyList, currencySymbol,
} from '../src/regions'
import { CURRENCIES } from '../src/regions/currencies'
import { parseSmsTransaction, isTransactionalSender, extractVpa } from '../src/services/RegexEngine'
import { parseVoiceExpense } from '../src/services/VoiceParser'
import { keywordCategory } from '../src/services/RuleEngine'
import { aggregateSpend, incomeTotal, accountBalance, cardSpend } from '../src/services/Analytics'
import { analyzePeriod, makePeriod } from '../src/services/Insights'
import { detectAnomalies } from '../src/services/Anomaly'
import { detectSalary } from '../src/services/Planning'
import { planIngest } from '../src/services/IngestPlanner'
import { toCsv } from '../src/services/ExportFormat'
import { formatDate, parseAmount, parseSignedAmount } from '../src/utils/format'

afterEach(() => { setRegion('IN'); setGroupingOverride(null) })

const T = Date.UTC(2026, 9, 5, 12)

describe('region presets', () => {
  test('every preset points at a real SMS profile and currency', () => {
    for (const r of REGIONS) {
      expect(['IN', 'GLOBAL']).toContain(r.smsProfile)
      expect(CURRENCIES[r.currency]).toBeDefined()
      expect(['.', ',']).toContain(r.decimal)
    }
    expect(new Set(REGIONS.map(r => r.id)).size).toBe(REGIONS.length)
  })
  test('India stays the default so older installs do not change', () => {
    expect(getRegion().id).toBe('IN')
    expect(homeCurrency()).toBe('INR')
  })
  test('guess the country from the phone locale', () => {
    expect(guessRegionId('en-GB')).toBe('GB')
    expect(guessRegionId('hi-IN')).toBe('IN')
    expect(guessRegionId('fr-FR')).toBe('OTHER')
    expect(guessRegionId('en')).toBe('OTHER')
    expect(guessRegionId(undefined)).toBe('OTHER')
  })
  test('"Other country" takes any supported currency, presets ignore the override', () => {
    expect(setRegion('OTHER', 'JPY').currency).toBe('JPY')
    expect(setRegion('US', 'JPY').currency).toBe('USD')
  })
  test('applyRegionSettings wires region, currency and grouping', () => {
    applyRegionSettings({ region: 'GB', currency: null, numberStyle: 'AUTO' })
    expect(formatMoney(1234567.5)).toBe('£1,234,567.50')
    applyRegionSettings({ region: 'GB', numberStyle: 'IN' })
    expect(formatMoney(1234567)).toBe('£12,34,567')
  })
})

describe('formatMoney', () => {
  test.each([
    ['IN', 1234567, '₹12,34,567'],
    ['US', 1234567.5, '$1,234,567.50'],
    ['GB', 99, '£99'],
    ['AE', 1500, 'AED 1,500'],
    ['SG', 12.3, 'S$12.30'],
    ['AU', 5, 'A$5'],
    ['IE', 2500.75, '€2,500.75'],
    ['NP', 1234567, 'NPR 12,34,567'],
  ])('%s %s', (id, n, expected) => {
    setRegion(id)
    expect(formatMoney(n)).toBe(expected)
  })
  test('zero-decimal and foreign currencies', () => {
    setRegion('OTHER', 'JPY')
    expect(formatMoney(1234.5)).toBe('¥1,235')
    setRegion('US')
    expect(formatMoney(20, 'EUR')).toBe('€20')
    expect(formatMoney(1500, 'INR')).toBe('₹1,500')
  })
  test('sign is the caller\'s job', () => {
    expect(formatMoney(-50)).toBe('₹50')
  })
  test('symbols exist for every listed currency', () => {
    for (const c of currencyList()) expect(currencySymbol(c).length).toBeGreaterThan(0)
  })
})

describe('thresholds scale with the currency', () => {
  test.each([['IN', 200, 200], ['US', 200, 10], ['GB', 200, 8], ['AE', 200, 40], ['IN', 5000, 5000], ['US', 5000, 250]])('%s scaled(%s)', (id, v, expected) => {
    setRegion(id)
    expect(scaled(v)).toBe(expected)
  })
  test('never below 1', () => {
    setRegion('OTHER', 'IDR')
    expect(scaled(1)).toBeGreaterThanOrEqual(1)
  })
})

describe('number parsing', () => {
  test('dot and comma decimal styles', () => {
    expect(parseNumber('1,234.50', '.')).toBe(1234.5)
    expect(parseNumber('1.234,50', ',')).toBe(1234.5)
    expect(parseNumber('1,00,000', '.')).toBe(100000)
    expect(new RegExp(`^(?:${numberPattern('.')})$`).test('1,234.56')).toBe(true)
    expect(new RegExp(`^(?:${numberPattern(',')})$`).test('1.234,56')).toBe(true)
  })
  test('user input ignores symbols and keeps the sign', () => {
    expect(parseAmount('$1,250.50')).toBe(1250.5)
    expect(parseAmount('£ 20')).toBe(20)
    expect(parseAmount('abc')).toBeNull()
    expect(parseSignedAmount('-1,500')).toBe(-1500)
    expect(Number.isNaN(parseSignedAmount('x'))).toBe(true)
    setRegion('IE')
    expect(parseAmount('€ 1250.5')).toBe(1250.5)
  })
  test('dates follow the region locale', () => {
    setRegion('US')
    expect(formatDate(T)).toBe('Oct 5, 2026')
    setRegion('GB')
    expect(formatDate(T)).toBe('5 Oct 2026')
  })
})

describe('currency tokens', () => {
  test('bare "$" means the home currency where it applies', () => {
    expect(tokenToCurrency('$', 'SGD')).toBe('USD') // SGD writes S$, so "$" alone is USD
    expect(tokenToCurrency('$', 'USD')).toBe('USD')
    expect(tokenToCurrency('Rs.', 'INR')).toBe('INR')
    expect(tokenToCurrency('€', 'INR')).toBe('EUR')
    expect(tokenToCurrency('S$', 'SGD')).toBe('SGD')
  })
})

describe('parsing messages outside India (generic English profile)', () => {
  const cases = [
    ['US', 'CHASE', 'Chase: You made a $45.67 debit card purchase at STARBUCKS on 10/05. Avail bal $1,203.44', { amount: 45.67, currency: 'USD', type: 'DEBIT', merchant: 'Starbucks' }],
    ['US', '227898', 'BofA: Debit card purchase of $1,250.00 at WALMART. Available balance: $3,400.00', { amount: 1250, type: 'DEBIT', merchant: 'Walmart' }],
    ['US', 'WELLSFARGO', 'Wells Fargo: Direct deposit of $2,150.25 received. Available balance $5,000.00', { amount: 2150.25, type: 'CREDIT' }],
    ['GB', 'BARCLAYS', 'Barclays: £32.10 spent at TESCO on your card ending 4321.', { amount: 32.1, currency: 'GBP', type: 'DEBIT', merchant: 'Tesco', last4: '4321' }],
    ['GB', 'MONZO', 'You received £250.00 from John Smith', { amount: 250, type: 'CREDIT', merchant: 'John Smith' }],
    ['AE', 'ENBD', 'AED 120.50 was spent on your Card ending 1234 at CARREFOUR. Avl Bal AED 4,000.00', { amount: 120.5, currency: 'AED', type: 'DEBIT', merchant: 'Carrefour' }],
    ['SG', 'DBSBANK', 'Card transaction of SGD 18.40 made at GRAB on 05/10. Available balance S$900', { amount: 18.4, currency: 'SGD', type: 'DEBIT', merchant: 'Grab' }],
    ['AU', 'CBA', 'You spent A$64.20 at WOOLWORTHS with your debit card.', { amount: 64.2, currency: 'AUD', type: 'DEBIT', merchant: 'Woolworths' }],
    ['IE', 'AIB', 'A payment of €85.00 was made to ESB Networks', { amount: 85, currency: 'EUR', type: 'DEBIT' }],
    ['US', 'AMEX', 'Amex: A charge of $210.00 was made at DELTA AIR on your card ending 1005.', { amount: 210, type: 'DEBIT', last4: '1005' }],
  ]
  test.each(cases)('%s %s', (id, sender, body, expected) => {
    setRegion(id)
    expect(parseSmsTransaction(sender, body, T)).toMatchObject(expected)
  })

  test('comma-decimal style (e.g. a euro country using 1.234,56)', () => {
    const region = { ...getRegion(), ...regionById('IE'), decimal: ',', currency: 'EUR', sms: regionById('IE') && getRegion().sms }
    setRegion('IE')
    const eu = { ...getRegion(), decimal: ',' }
    expect(parseSmsTransaction('N26', 'Du hast 1.234,56 EUR ausgegeben. Purchase at EDEKA', T, eu)).toMatchObject({ amount: 1234.56, currency: 'EUR' })
    expect(region.decimal).toBe(',')
  })

  test('suffix style "20.00 USD"', () => {
    setRegion('US')
    expect(parseSmsTransaction('CHASE', 'Purchase of 20.00 USD at NETFLIX', T)).toMatchObject({ amount: 20, currency: 'USD' })
  })

  test('personal phone numbers are never parsed, short codes and alphanumeric ids are', () => {
    setRegion('US')
    expect(isTransactionalSender('+15551234567')).toBe(false)
    expect(isTransactionalSender('5551234567')).toBe(false)
    expect(isTransactionalSender('227898')).toBe(true)
    expect(isTransactionalSender('CHASE')).toBe(true)
    expect(parseSmsTransaction('+15551234567', 'I paid $20 to the plumber, you owe me', T)).toBeNull()
  })

  test('one-time codes, promos, failures and reminders are rejected anywhere', () => {
    setRegion('GB')
    for (const body of [
      'Your verification code is 123456. Never share it.',
      'Barclays offer: apply now and get £50 cashback',
      'Your card payment of £20.00 at TESCO was declined',
      'Reminder: your bill of £45.00 is due on 12 Oct',
      'Your security code is 99 and a payment of £10 is pending',
    ]) expect(parseSmsTransaction('BARCLAYS', body, T)).toBeNull()
  })

  test('UPI-style addresses and India-only modes are not assumed elsewhere', () => {
    setRegion('US')
    expect(extractVpa('paid to john@okbank')).toBeNull()
    expect(parseSmsTransaction('CHASE', 'You paid $20 to john@okbank via Zelle', T).payment_mode).toBe('TRANSFER')
  })

  test('amounts in another currency are labelled, not mistaken for home currency', () => {
    setRegion('IN')
    const t = parseSmsTransaction('VM-HDFCBK', 'Spent USD 20.00 On HDFC Bank Card 4321 At OPENAI On 2026-10-09', T)
    expect(t).toMatchObject({ amount: 20, currency: 'USD', merchant: 'Openai' })
    const home = parseSmsTransaction('VM-HDFCBK', 'Spent Rs.500 On HDFC Bank Card 4321 At SHOP On 2026-10-09', T)
    expect(home.currency).toBe('INR')
  })

  test('letter abbreviations are only trusted for the home currency', () => {
    setRegion('US')
    expect(parseSmsTransaction('CHASE', 'Ref R12 paid at SHOP', T)).toBeNull() // "R12" is not rand
    setRegion('ZA')
    expect(parseSmsTransaction('FNB', 'R250.00 spent at WOOLWORTHS on card', T)).toMatchObject({ amount: 250, currency: 'ZAR' })
  })

  test('merchant keywords: shared + the region\'s own', () => {
    setRegion('US')
    expect(keywordCategory('WALMART SUPERCENTER')).toBe('Shopping')
    expect(keywordCategory('Netflix')).toBe('Entertainment')
    expect(keywordCategory('Swiggy')).toBeNull() // India-only merchant
    expect(keywordCategory('Las Vegas parking')).toBeNull() // "gas" must not match inside "vegas"
    expect(keywordCategory('TFL travel')).toBe('Transport')
    setRegion('IN')
    expect(keywordCategory('Swiggy')).toBe('Food & Dining')
    expect(keywordCategory('Netflix')).toBe('Entertainment')
  })
})

describe('foreign-currency transactions stay out of home totals', () => {
  const start = Date.UTC(2026, 9, 1), end = Date.UTC(2026, 10, 1)
  const tx = (o) => ({ id: Math.random().toString(36), type: 'DEBIT', amount: 100, merchant: 'Shop', category: 'Shopping', timestamp: Date.UTC(2026, 9, 5), ...o })
  test('analytics, income, balances and cards ignore them', () => {
    const txs = [tx({ amount: 500 }), tx({ amount: 20, currency: 'USD' }), tx({ type: 'CREDIT', amount: 9000 }), tx({ type: 'CREDIT', amount: 100, currency: 'EUR' })]
    expect(isForeignCurrency(txs[1])).toBe(true)
    expect(isForeignCurrency(txs[0])).toBe(false)
    expect(aggregateSpend(txs, start, end).total).toBe(500)
    expect(incomeTotal(txs, start, end)).toBe(9000)
    const withAcc = txs.map(t => ({ ...t, account_id: 'a', card_id: 'c' }))
    expect(accountBalance({ id: 'a', balance: 1000, last_reconciled_at: 0 }, withAcc)).toBe(1000 - 500 - 20 * 0 + 9000)
    expect(cardSpend({ id: 'c', billing_day: 1 }, withAcc, Date.UTC(2026, 9, 20))).toBe(500)
  })
  test('the period analysis reports how many were left out', () => {
    const txs = [tx({ amount: 500 }), tx({ amount: 20, currency: 'USD' }), tx({ amount: 30, currency: 'USD' })]
    const a = analyzePeriod(txs, makePeriod('MONTH', Date.UTC(2026, 9, 10)), Date.UTC(2026, 9, 12))
    expect(a.foreign).toBe(2)
    expect(a.total).toBe(500)
  })
  test('the planner stores a currency only when it differs from home', () => {
    const plan = planIngest([
      { sender: 'VM-HDFCBK', body: 'Spent USD 20.00 On HDFC Bank Card 4321 At OPENAI On 2026-10-09', timestamp: T },
      { sender: 'VM-HDFCBK', body: 'Paid Rs.100 to Swiggy on 1-1-26', timestamp: T + 1000 },
    ], {})
    expect(plan.creates.map(c => c.currency)).toEqual(['USD', null])
  })
  test('export writes the currency column', () => {
    const csv = toCsv([tx({ currency: 'USD', amount: 20 }), tx({ amount: 10 })])
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toContain('Amount,Currency,Type')
    expect(lines[1]).toContain(',20,USD,')
    expect(lines[2]).toContain(',10,INR,')
  })
})

describe('thresholds in other currencies', () => {
  const tx = (o) => ({ id: Math.random().toString(36), type: 'DEBIT', amount: 100, merchant: 'Shop', category: 'Shopping', timestamp: Date.UTC(2026, 9, 5), ...o })
  test('"small purchase" is sized for the currency', () => {
    setRegion('US')
    const a = analyzePeriod([tx({ amount: 4 }), tx({ amount: 9 }), tx({ amount: 40 })], makePeriod('MONTH', Date.UTC(2026, 9, 10)), Date.UTC(2026, 9, 12))
    expect(a.patterns.small).toMatchObject({ count: 2, total: 13, threshold: 10 })
  })
  test('unusual-spend floor scales: $150 over a usual $20 is flagged, ₹150 over a usual ₹20 is not', () => {
    const hist = [18, 20, 22, 19].map((a, i) => tx({ id: 'h' + i, amount: a, merchant: 'Cafe', timestamp: Date.UTC(2026, 8, 1 + i * 3) }))
    const big = tx({ id: 'n', amount: 150, merchant: 'Cafe', timestamp: Date.UTC(2026, 9, 5) })
    setRegion('US')
    expect(detectAnomalies(big, hist)[0].message).toContain('$150')
    setRegion('IN')
    expect(detectAnomalies(big, hist)).toEqual([])
  })
  test('salary minimum scales with the currency', () => {
    const pay = (m) => tx({ type: 'CREDIT', amount: 300, merchant: 'Acme', timestamp: Date.UTC(2026, m, 1) })
    const now = Date.UTC(2026, 9, 20)
    setRegion('IN')
    expect(detectSalary([pay(8), pay(9)], now)).toBeNull() // 300 is small in rupees
    setRegion('US')
    expect(detectSalary([pay(8), pay(9)], now)).not.toBeNull() // 300 clears the US floor of 250
    const tiny = (m) => tx({ type: 'CREDIT', amount: 100, merchant: 'Acme', timestamp: Date.UTC(2026, m, 1) })
    expect(detectSalary([tiny(8), tiny(9)], now)).toBeNull()
  })
})

describe('voice entry in other currencies', () => {
  test.each([
    ['US', 'spent 25 dollars at Starbucks', { amount: 25, merchant: 'Starbucks', type: 'DEBIT' }],
    ['US', 'paid $1,200 to Maria', { amount: 1200, merchant: 'Maria' }],
    ['GB', 'spent 12.50 pounds on lunch', { amount: 12.5, merchant: 'Lunch' }],
    ['GB', 'received £500 from Anna', { amount: 500, type: 'CREDIT', merchant: 'Anna' }],
    ['AE', 'paid 40 dirhams to Carrefour', { amount: 40, merchant: 'Carrefour' }],
    ['IN', 'spent 250 rupees at Chaayos', { amount: 250, merchant: 'Chaayos' }],
  ])('%s: %s', (id, text, expected) => {
    setRegion(id)
    expect(parseVoiceExpense(text)).toMatchObject(expected)
  })
})
