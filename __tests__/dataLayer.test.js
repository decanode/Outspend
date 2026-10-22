import { makeDatabase } from './dbHarness'

jest.mock('../src/db', () => ({ database: require('./dbHarness').makeDatabase() }))

import { database } from '../src/db'
import { ingestMessages, processIncomingSms } from '../src/services/TransactionManager'
import { createTransaction, applyRuleToExisting, softDeleteTransaction, fetchLiveTransactions, wipeAllData } from '../src/data/transactions'
import { createRule } from '../src/data/rules'
import { createAccount, reconcileAccount, createCard, updateAccount } from '../src/data/accounts'
import { accountBalance, cardSpend } from '../src/services/Analytics'
import { toPlain } from '../src/data/util'
import { nameUnknownTransaction, nameTransactionById } from '../src/data/naming'

const T0 = Date.now() - 3600 * 1000
const sms = (body, ts = T0, sender = 'VM-HDFCBK') => ({ sender, body, timestamp: ts })
const all = () => database.collections.get('transactions').query().fetch()

beforeEach(async () => { await wipeAllData() })

test('makeDatabase sanity', () => expect(makeDatabase()).toBeDefined())

describe('ingestMessages', () => {
  test('stores parsed SMS with category and ignores junk', async () => {
    const r = await ingestMessages([sms('Paid Rs.100 to Swiggy on 1-1-26'), sms('Your OTP is 1234')])
    expect(r).toMatchObject({ created: 1, skipped: 1 })
    const [tx] = await all()
    expect(tx).toMatchObject({ amount: 100, merchant: 'Swiggy', category: 'Food & Dining', source: 'SMS', is_deleted: false, needs_review: false })
  })

  test('is idempotent across repeated imports', async () => {
    const m = sms('Paid Rs.100 to Swiggy on 1-1-26')
    await ingestMessages([m])
    await ingestMessages([m])
    await processIncomingSms(m.sender, m.body, m.timestamp)
    expect(await all()).toHaveLength(1)
  })

  test('a deleted transaction is not resurrected by re-import', async () => {
    const m = sms('Paid Rs.100 to Swiggy on 1-1-26')
    await ingestMessages([m])
    await softDeleteTransaction((await all())[0])
    await ingestMessages([m])
    expect(await all()).toHaveLength(1)
    expect(await fetchLiveTransactions()).toHaveLength(0)
  })

  test('merges into a manual entry', async () => {
    await createTransaction({ amount: 100, merchant: 'coffee', type: 'DEBIT', timestamp: T0 - 600000, source: 'MANUAL' })
    const r = await ingestMessages([sms('Paid Rs.100 to Starbucks on 1-1-26')])
    expect(r).toMatchObject({ created: 0, merged: 1 })
    const txs = await all()
    expect(txs).toHaveLength(1)
    expect(txs[0]).toMatchObject({ source: 'VERIFIED_SMS', merchant: 'Starbucks' })
    expect(txs[0].raw_text).toContain('Starbucks')
  })

  test('links a refund to the debit from the same batch and from storage', async () => {
    await ingestMessages([
      sms('Spent Rs.1,499.00 On HDFC Bank Card 4321 At AMAZON PAY INDIA On 2026-10-09', T0 - 86400000),
    ])
    await ingestMessages([sms('Refund of Rs.1,499.00 from AMAZON PAY INDIA credited to your Card XX4321', T0)])
    const txs = await all()
    const debit = txs.find(t => t.type === 'DEBIT')
    const refund = txs.find(t => t.type === 'REFUND')
    expect(refund.linked_transaction_id).toBe(debit.id)
  })

  test('attributes to a card and account by last4', async () => {
    const card = await createCard({ name: 'HDFC Card', limit: 50000, last4: '4321', billing_day: 1 })
    const acc = await createAccount({ name: 'HDFC Savings', type: 'SAVINGS', balance: 1000, last4: '1234' })
    await ingestMessages([
      sms('Spent Rs.500 On HDFC Bank Card 4321 At SHOP On 2026-10-09', T0),
      sms('Rs.40 debited from A/c XX1234 to Metro on 1-1-26', T0 + 1000),
    ])
    const txs = (await all()).map(toPlain)
    expect(txs.find(t => t.amount === 500).card_id).toBe(card.id)
    expect(txs.find(t => t.amount === 40).account_id).toBe(acc.id)
    expect(cardSpend(toPlain(card), txs, T0 + 5000)).toBe(500)
    expect(accountBalance({ ...toPlain(acc), last_reconciled_at: T0 - 1000 }, txs)).toBe(960)
  })

  test('imports a large batch in chunks', async () => {
    const msgs = Array.from({ length: 900 }, (_, i) => sms(`Paid Rs.${i + 1} to Shop${i} on 1-1-26`, T0 - i * 1000))
    const r = await ingestMessages(msgs)
    expect(r.created).toBe(900)
    expect(await all()).toHaveLength(900)
  })
})

describe('rules', () => {
  test('creating a rule retro-applies to matching transactions and clears review', async () => {
    await ingestMessages([sms('Rs.20 debited from A/c XX1234 on 1-1-26. Ref VPA chaiwala@ybl', T0)])
    expect((await all())[0].needs_review).toBe(true)
    const { updated } = await createRule({ pattern: 'chaiwala@ybl', mapped_merchant: 'Chai Point', category: 'Food & Dining' })
    expect(updated).toBe(1)
    expect((await all())[0]).toMatchObject({ merchant: 'Chai Point', category: 'Food & Dining', needs_review: false })
  })

  test('future SMS from the same VPA use the rule', async () => {
    await createRule({ pattern: 'chaiwala@ybl', mapped_merchant: 'Chai Point', category: 'Food & Dining' })
    await ingestMessages([sms('Rs.30 debited from A/c XX1234 on 2-1-26. Ref VPA chaiwala@ybl', T0)])
    expect((await all())[0]).toMatchObject({ merchant: 'Chai Point', needs_review: false })
  })

  test('applyRuleToExisting ignores non-matching rows', async () => {
    await createTransaction({ amount: 5, merchant: 'Other', type: 'DEBIT', timestamp: T0 })
    const rule = await database.write(() => database.collections.get('merchant_rules').create(r => { r.pattern = 'zzz'; r.mapped_merchant = 'Z'; r.category = null }))
    expect(await applyRuleToExisting(rule)).toBe(0)
  })
})

describe('accounts', () => {
  test('reconcile resets the baseline', async () => {
    const acc = await createAccount({ name: 'Cash', type: 'CASH', balance: 500 })
    await updateAccount(acc, { last_reconciled_at: Date.now() - 10000 })
    await createTransaction({ amount: 100, merchant: 'x', type: 'DEBIT', timestamp: Date.now() - 5000, account_id: acc.id })
    const txs = (await all()).map(toPlain)
    expect(accountBalance(toPlain(acc), txs)).toBe(400)
    await reconcileAccount(acc, 1000)
    expect(accountBalance(toPlain(acc), txs)).toBe(1000)
  })
})

describe('unknown vendors', () => {
  const UNKNOWN = 'Rs.20 debited from A/c XX1234 on 1-1-26. Ref VPA chaiwala@ybl'

  test('ingest reports new transactions that need a name', async () => {
    const r = await ingestMessages([sms(UNKNOWN), sms('Paid Rs.100 to Swiggy on 1-1-26', T0 + 1000)])
    expect(r.created).toBe(2)
    expect(r.needsReview).toHaveLength(1)
    const [item] = r.needsReview
    expect(item).toMatchObject({ amount: 20, type: 'DEBIT' })
    expect((await database.collections.get('transactions').find(item.id)).needs_review).toBe(true)
  })

  test('naming from a notification reply saves a rule and fixes the transaction', async () => {
    const { needsReview } = await ingestMessages([sms(UNKNOWN)])
    expect(await nameTransactionById(needsReview[0].id, '  Chai Point ')).toBe(1)
    expect((await all())[0]).toMatchObject({ merchant: 'Chai Point', needs_review: false })
    const rules = await database.collections.get('merchant_rules').query().fetch()
    expect(rules).toHaveLength(1)
    // the next payment to the same VPA is recognised with no prompt
    const next = await ingestMessages([sms('Rs.30 debited from A/c XX1234 on 2-1-26. Ref VPA chaiwala@ybl', T0 + 5000)])
    expect(next.needsReview).toHaveLength(0)
  })

  test('without a VPA only that transaction is renamed', async () => {
    const tx = await createTransaction({ amount: 50, merchant: 'Unknown Vendor', type: 'DEBIT', needs_review: true })
    expect(await nameUnknownTransaction(tx, 'Ramesh')).toBe(1)
    expect(await database.collections.get('merchant_rules').query().fetch()).toHaveLength(0)
    expect((await all())[0]).toMatchObject({ merchant: 'Ramesh', needs_review: false })
  })

  test('empty name or deleted transaction is a no-op', async () => {
    const tx = await createTransaction({ amount: 50, merchant: 'Unknown Vendor', type: 'DEBIT', needs_review: true })
    expect(await nameUnknownTransaction(tx, '   ')).toBe(0)
    expect(await nameTransactionById('does-not-exist', 'X')).toBe(0)
  })
})
