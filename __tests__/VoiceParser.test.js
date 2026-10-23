import { parseVoiceExpense } from '../src/services/VoiceParser'

describe('parseVoiceExpense', () => {
  test.each([
    ['spent 250 on coffee at Starbucks', { amount: 250, merchant: 'Starbucks', note: 'Coffee', type: 'DEBIT' }],
    ['paid 1,200 rupees to Ramesh', { amount: 1200, merchant: 'Ramesh', type: 'DEBIT' }],
    ['₹80 for auto', { amount: 80, merchant: 'Auto', type: 'DEBIT' }],
    ['spent 99.50 at the bakery', { amount: 99.5, merchant: 'Bakery' }],
    ['received 5000 from Anil', { amount: 5000, merchant: 'Anil', type: 'CREDIT' }],
    ['lunch 150 rs', { amount: 150, type: 'DEBIT' }],
  ])('%s', (text, expected) => expect(parseVoiceExpense(text)).toMatchObject(expected))

  test('no number heard', () => {
    expect(parseVoiceExpense('bought some coffee').amount).toBeNull()
    expect(parseVoiceExpense('').amount).toBeNull()
  })
})
