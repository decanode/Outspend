import { parseCaptureUrl, previewSharedText } from '../src/services/SharedCapture'
import { planIngest } from '../src/services/IngestPlanner'
import { analyzeSms } from '../src/services/RegexEngine'
import { setRegion } from '../src/regions'

afterEach(() => setRegion('IN'))

const enc = encodeURIComponent
const BODY = 'Rs.250.00 debited from A/c XX1234 to SWIGGY on 12-10-26 UPI Ref 628374655'

describe('capture links', () => {
  test('decodes the shared text', () => {
    expect(parseCaptureUrl(`outspend://capture?text=${enc(BODY)}`)).toBe(BODY)
  })
  test('plus signs mean spaces, as Shortcuts and browsers write them', () => {
    expect(parseCaptureUrl('outspend://capture?text=Rs.100+debited+from+A%2Fc')).toBe('Rs.100 debited from A/c')
  })
  test('scheme is case-insensitive and other parameters are ignored', () => {
    expect(parseCaptureUrl(`OUTSPEND://capture?source=sc&text=${enc('Paid Rs.5 to X')}&x=1`)).toBe('Paid Rs.5 to X')
  })
  test.each([
    ['https://evil.example/capture?text=Rs.5 debited'],
    ['outspend://other?text=hello'],
    ['outspend://capture'],
    ['outspend://capture?text='],
    ['outspend://capture?text=%20%20'],
    ['outspend://capture?txt=hello'],
    ['outspend://capture?text=%E0%A4%A'], // broken percent-encoding
    [null], [undefined], [42],
  ])('ignores %s', (url) => expect(parseCaptureUrl(url)).toBeNull())
  test('refuses absurdly long text', () => {
    expect(parseCaptureUrl(`outspend://capture?text=${'a'.repeat(2001)}`)).toBeNull()
    expect(parseCaptureUrl(`outspend://capture?text=${'a'.repeat(2000)}`)).not.toBeNull()
  })
})

describe('what the user is asked to confirm', () => {
  test('a bank message is understood without any sender', () => {
    const p = previewSharedText(BODY)
    expect(p.ok).toBe(true)
    expect(p.tx).toMatchObject({ amount: 250, type: 'DEBIT', merchant: 'Swiggy', currency: 'INR' })
  })
  test('messages that are not completed payments are not offered for adding', () => {
    expect(previewSharedText('Your OTP is 123456, do not share')).toMatchObject({ ok: false, reason: 'otp' })
    expect(previewSharedText('Txn of Rs.800 at AMAZON failed')).toMatchObject({ ok: false, reason: 'failed', amount: 800 })
    expect(previewSharedText('hello there')).toMatchObject({ ok: false, reason: 'no_amount' })
  })
  test('other countries work the same way', () => {
    setRegion('US')
    expect(previewSharedText('Chase: You made a $45.67 debit card purchase at STARBUCKS on 10/05.').tx).toMatchObject({ amount: 45.67, currency: 'USD' })
  })
  test('the sender check is only skipped for shared text', () => {
    expect(analyzeSms('9876543210', BODY, 1).reject).toBe('not_bank_sender')
    expect(analyzeSms('SHARED', BODY, 1, undefined, { shared: true }).tx).toBeDefined()
  })
})

describe('planning shared messages', () => {
  const shared = (body, ts) => ({ sender: 'SHARED', body, timestamp: ts, shared: true })
  test('sharing the same message on two different days adds it once', () => {
    const t = Date.UTC(2026, 9, 12)
    const first = planIngest([shared(BODY, t)], {})
    expect(first.creates).toHaveLength(1)
    const again = planIngest([shared(BODY, t + 3 * 86400000)], { existing: [{ id: 'x', external_id: first.creates[0].external_id, type: 'DEBIT', timestamp: t }] })
    expect(again.creates).toHaveLength(0)
  })
  test('a shared message uses the share time as its date', () => {
    const t = Date.UTC(2026, 9, 20)
    expect(planIngest([shared(BODY, t)], {}).creates[0].timestamp).toBe(t)
  })
  test('shared messages go through the same categorisation and transfer rules', () => {
    const plan = planIngest([shared('Rs.5,000 debited from A/c XX1234 towards your credit card bill payment', Date.UTC(2026, 9, 5))], {})
    expect(plan.creates[0].transfer).toBe('AUTO')
  })
  test('a shared message that cannot be read is reported for review, keyed by its text', () => {
    const plan = planIngest([shared('Rs.500 is the fee for your account', 1000), shared('Rs.500 is the fee for your account', 99999)], {})
    expect(plan.skippedDetails.map(d => d.reason)).toEqual(['no_direction', 'no_direction'])
    expect(plan.skippedDetails[0].id).toBe(plan.skippedDetails[1].id) // the log merges them into one entry
  })
})
