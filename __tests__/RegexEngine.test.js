import { parseSmsTransaction, analyzeSms, isTransactionalSender, extractVpa } from '../src/services/RegexEngine'
import { SMS_FIXTURES } from './fixtures/sms'

describe('sender filtering', () => {
  test.each([
    ['VM-HDFCBK', true], ['AX-SBIUPI-S', true], ['JD-ICICIT-S', true], ['AD-PAYTMB', true],
    ['VM-HDFCBK-P', false], ['+919876543210', false], ['9876543210', false], ['', false], [null, false],
    ['HDFCBK', true], ['56767', true], ['ICICIB', true], ['12', false], ['AB', false],
  ])('%s -> %s', (sender, ok) => expect(isTransactionalSender(sender)).toBe(ok))
})

describe('parseSmsTransaction fixtures', () => {
  SMS_FIXTURES.forEach((f, i) => {
    test(`#${i} ${f.body.slice(0, 50) || '(empty)'}`, () => {
      const out = parseSmsTransaction(f.sender, f.body, 1700000000000)
      if (f.expect === null) {
        expect(out).toBeNull()
      } else {
        expect(out).not.toBeNull()
        expect(out).toMatchObject(f.expect)
      }
    })
  })
})

describe('parse output', () => {
  test('is deterministic and unique per message', () => {
    const a = parseSmsTransaction('VM-HDFCBK', 'Paid Rs.45 to Metro on 11-10-26', 1)
    const b = parseSmsTransaction('VM-HDFCBK', 'Paid Rs.45 to Metro on 11-10-26', 1)
    const c = parseSmsTransaction('VM-HDFCBK', 'Paid Rs.45 to Metro on 11-10-26', 2)
    expect(a.external_id).toBe(b.external_id)
    expect(a.external_id).not.toBe(c.external_id)
  })
  test('balance is not mistaken for amount', () => {
    const out = parseSmsTransaction('VM-HDFCBK', 'Avl Bal Rs.9,999.00. Rs.100 debited from A/c XX1234 to Shop', 1)
    expect(out.amount).toBe(100)
  })
  test('extractVpa', () => {
    expect(extractVpa('credited to VPA chaiwala@ybl on')).toBe('chaiwala@ybl')
    expect(extractVpa('no vpa here')).toBeNull()
  })
})

describe('analyzeSms explains why a message was skipped', () => {
  const why = (sender, body) => analyzeSms(sender, body, 1700000000000)
  test.each([
    ['VM-HDFCBK', 'Your OTP is 123456. Do not share it.', 'otp'],
    ['VM-HDFCBK', 'Get a pre-approved loan of Rs.5,00,000 today', 'promo'],
    ['VM-HDFCBK', 'Txn of Rs.800 at AMAZON failed due to insufficient funds', 'failed'],
    ['VM-HDFCBK', 'Reminder: Rs.5,000 will be debited from A/c XX1234 on 15-10-26', 'reminder'],
    ['VM-HDFCBK', 'Minimum amount due Rs.617. Due date 20-10-26.', 'reminder'],
    ['VM-HDFCBK', 'Your a/c balance is good. Thank you for banking with us', 'no_amount'],
    ['VM-HDFCBK', 'Rs.500 is the fee for your account', 'no_direction'],
    ['9876543210', 'I paid Rs.500 to the plumber', 'not_bank_sender'],
  ])('%s -> %s', (sender, body, reason) => {
    expect(why(sender, body).reject).toBe(reason)
  })

  test('a rejected message that contains money carries the figure for manual review', () => {
    expect(why('VM-HDFCBK', 'Txn of Rs.1,800 at AMAZON failed')).toMatchObject({ reject: 'failed', amount: 1800, currency: 'INR' })
    expect(why('VM-HDFCBK', 'Rs.500 is the fee for your account')).toMatchObject({ reject: 'no_direction', amount: 500 })
    expect(why('VM-HDFCBK', 'Your OTP is 123456').amount).toBeUndefined()
  })

  test('accepted messages return the transaction and no rejection', () => {
    const r = why('VM-HDFCBK', 'Paid Rs.250 to Swiggy on 1-1-26')
    expect(r.reject).toBeUndefined()
    expect(r.tx).toMatchObject({ amount: 250, type: 'DEBIT' })
  })

  test('"transferred" is direction-aware: into your account is money in, to someone else is money out', () => {
    expect(why('VM-HDFCBK', 'Rs.50,000 transferred to your account XX1234 towards salary').tx.type).toBe('CREDIT')
    expect(why('VM-HDFCBK', 'Rs.50,000 transferred to Ramesh from A/c XX1234').tx.type).toBe('DEBIT')
    expect(why('VM-HDFCBK', 'Rs.700 trf to Anil Ref 123').tx.type).toBe('DEBIT')
  })
  test('completed-payment confirmations survive "due date" boilerplate; pure reminders do not', () => {
    expect(why('VM-HDFCBK', 'Rs.5,000 paid for your card via autopay. Next due date 25-10-26.').tx).toBeDefined()
    expect(why('VM-HDFCBK', 'Rs.5,000 is due on 25-10-26 for your card.').reject).toBe('reminder')
  })
})
