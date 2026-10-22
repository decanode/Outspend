import { parseSmsTransaction, isTransactionalSender, extractVpa } from '../src/services/RegexEngine'
import { SMS_FIXTURES } from './fixtures/sms'

describe('sender filtering', () => {
  test.each([
    ['VM-HDFCBK', true], ['AX-SBIUPI-S', true], ['JD-ICICIT-S', true], ['AD-PAYTMB', true],
    ['VM-HDFCBK-P', false], ['+919876543210', false], ['Mom', false], ['', false], [null, false],
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
