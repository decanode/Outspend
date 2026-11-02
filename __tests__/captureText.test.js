import { decodeCaptureText } from '../src/utils/captureText'
import { parseCaptureUrl, previewSharedText } from '../src/services/SharedCapture'

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

const INDUSIND =
  'IndusInd A/C **0062 Debited; INR 60.00 Ref-UPI/629869524079/DR/MEES/INDB/Q112104876@ybl/Pay. Bal INR 1,963.55. Dispute-Call 18602677777-IndusInd Bank'

describe('decodeCaptureText', () => {
  it('round-trips special characters', () => {
    const msg = 'a/b; user@ybl ** paid ₹500'
    expect(decodeCaptureText(b64(msg))).toBe(msg)
  })
  it('handles long messages over 76 chars', () => {
    const msg = 'Rs. 1,250.00 debited from A/C XX1234 on 01-Nov-26 to Swiggy. '.repeat(3)
    expect(decodeCaptureText(b64(msg))).toBe(msg)
  })
  it('restores "+" turned into spaces and missing padding', () => {
    const msg = '??>>~~ ₹ ok'
    expect(decodeCaptureText(b64(msg).replace(/=+$/, '').replace(/\+/g, ' '))).toBe(msg)
  })
  it('falls back to raw text when not Base64', () => {
    expect(decodeCaptureText('Rs. 500 debited to Swiggy')).toBe('Rs. 500 debited to Swiggy')
  })
})

describe('capture URL', () => {
  it('decodes a Base64 text param', () => {
    expect(parseCaptureUrl(`outspend://capture?text=${encodeURIComponent(b64(INDUSIND))}`)).toBe(INDUSIND)
    expect(parseCaptureUrl(`outspend://capture?text=${b64(INDUSIND)}`)).toBe(INDUSIND)
  })
})

describe('IndusInd message', () => {
  it('parses as a debit of 60.00 after decoding', () => {
    const r = previewSharedText(parseCaptureUrl(`outspend://capture?text=${b64(INDUSIND)}`))
    expect(r).toMatchObject({ ok: true })
    expect(r.tx).toMatchObject({ amount: 60, type: 'DEBIT' })
  })
})
