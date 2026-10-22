import { planIngest, findRefundTarget, DEDUPE_WINDOW_MS } from '../src/services/IngestPlanner'

const T0 = 1760000000000
const sms = (body, ts = T0, sender = 'VM-HDFCBK') => ({ sender, body, timestamp: ts })

describe('planIngest', () => {
  test('creates a transaction and skips junk', () => {
    const plan = planIngest([sms('Paid Rs.100 to Swiggy on 1-1-26'), sms('Your OTP is 1234')], {})
    expect(plan.creates).toHaveLength(1)
    expect(plan.skipped).toBe(1)
    expect(plan.creates[0]).toMatchObject({ amount: 100, category: 'Food & Dining', source: 'SMS', needs_review: false })
  })

  test('same SMS twice (live + import) yields one row', () => {
    const m = sms('Paid Rs.100 to Swiggy on 1-1-26')
    expect(planIngest([m, m], {}).creates).toHaveLength(1)
  })

  test('skips messages already stored by external_id', () => {
    const first = planIngest([sms('Paid Rs.100 to Swiggy on 1-1-26')], {}).creates[0]
    const again = planIngest([sms('Paid Rs.100 to Swiggy on 1-1-26')], { existing: [{ id: 'a', external_id: first.external_id, type: 'DEBIT', timestamp: T0 }] })
    expect(again.creates).toHaveLength(0)
  })

  test('manual entry within window is upgraded to VERIFIED_SMS', () => {
    const existing = [{ id: 'm1', source: 'MANUAL', type: 'DEBIT', amount: 100, timestamp: T0 - DEDUPE_WINDOW_MS + 1000, merchant: 'coffee' }]
    const plan = planIngest([sms('Paid Rs.100 to Starbucks on 1-1-26')], { existing })
    expect(plan.creates).toHaveLength(0)
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({ id: 'm1', patch: { source: 'VERIFIED_SMS', merchant: 'Starbucks' } })
  })

  test('manual entry outside window or with different amount is not merged', () => {
    const far = [{ id: 'm1', source: 'MANUAL', type: 'DEBIT', amount: 100, timestamp: T0 - DEDUPE_WINDOW_MS - 1000 }]
    const diff = [{ id: 'm2', source: 'VOICE', type: 'DEBIT', amount: 101, timestamp: T0 }]
    expect(planIngest([sms('Paid Rs.100 to Starbucks')], { existing: far }).creates).toHaveLength(1)
    expect(planIngest([sms('Paid Rs.100 to Starbucks')], { existing: diff }).creates).toHaveLength(1)
  })

  test('one manual entry merges with only one SMS', () => {
    const existing = [{ id: 'm1', source: 'MANUAL', type: 'DEBIT', amount: 100, timestamp: T0 }]
    const plan = planIngest([sms('Paid Rs.100 to A on 1', T0), sms('Paid Rs.100 to B on 1', T0 + 5000)], { existing })
    expect(plan.updates).toHaveLength(1)
    expect(plan.creates).toHaveLength(1)
  })

  test('user rule recategorises and clears review', () => {
    const rules = [{ id: 'r1', pattern: 'chaiwala@ybl', mapped_merchant: 'Chai Point', category: 'Food & Dining' }]
    const plan = planIngest([sms('Rs.20 debited from A/c XX1234 and credited to VPA chaiwala@ybl on 1-1-26')], { rules })
    expect(plan.creates[0]).toMatchObject({ merchant: 'Chai Point', needs_review: false, merchant_rule_id: 'r1' })
  })

  test('attributes to card/account by last4', () => {
    const cards = [{ id: 'c1', last4: '4321' }]
    const accounts = [{ id: 'a1', last4: '1234' }]
    const plan = planIngest([
      sms('Spent Rs.500 On HDFC Bank Card 4321 At SHOP On 2026-10-09'),
      sms('Rs.40 debited from A/c XX1234 to Metro on 1-1-26', T0 + 1),
    ], { cards, accounts })
    expect(plan.creates[0].card_id).toBe('c1')
    expect(plan.creates[1].account_id).toBe('a1')
  })

  test('refund links to the original debit, even within one batch', () => {
    const plan = planIngest([
      sms('Spent Rs.1,499.00 On HDFC Bank Card 4321 At AMAZON PAY INDIA On 2026-10-09', T0),
      sms('Refund of Rs.1,499.00 from AMAZON PAY INDIA credited to your Card XX4321', T0 + 86400000),
    ], {})
    const [debit, refund] = plan.creates
    expect(refund.type).toBe('REFUND')
    expect(refund.linked_transaction_id).toBe(debit.tempId)
    expect(refund.category).toBe(debit.category)
  })

  test('refund links to a stored debit', () => {
    const existing = [{ id: 'd1', type: 'DEBIT', amount: 2350, merchant: 'Starbucks', timestamp: T0 - 86400000, category: 'Food & Dining' }]
    const plan = planIngest([sms('Rs.2,350.00 reversed to your SBI Credit Card ending 8899 by STARBUCKS', T0, 'AX-SBICRD')], { existing })
    expect(plan.creates[0].linked_transaction_id).toBe('d1')
  })
})

describe('findRefundTarget', () => {
  const debit = (o) => ({ id: 'd', type: 'DEBIT', amount: 100, merchant: 'Shop', timestamp: T0 - 1000, ...o })
  test('ignores debits older than 30 days, smaller amounts, deleted rows', () => {
    const refund = { amount: 100, merchant: 'Shop', timestamp: T0 }
    expect(findRefundTarget(refund, [debit({ timestamp: T0 - 31 * 86400000 })])).toBeNull()
    expect(findRefundTarget(refund, [debit({ amount: 50 })])).toBeNull()
    expect(findRefundTarget(refund, [debit({ is_deleted: true })])).toBeNull()
    expect(findRefundTarget(refund, [debit({})])).not.toBeNull()
  })
  test('unknown merchant needs an exact amount match', () => {
    const refund = { amount: 100, merchant: 'Unknown Vendor', timestamp: T0 }
    expect(findRefundTarget(refund, [debit({ amount: 150 })])).toBeNull()
    expect(findRefundTarget(refund, [debit({})])).not.toBeNull()
  })
})
