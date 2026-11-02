import { decodeCaptureText, getCapturedMessage } from '../src/utils/captureText'
import { parseBankMessage } from '../src/services/RegexEngine'

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
    expect(msg.length).toBeGreaterThan(76)
    expect(decodeCaptureText(b64(msg))).toBe(msg)
  })

  it('restores "+" turned into spaces and missing padding', () => {
    const msg = '??>>~~ ₹ ok'
    const mangled = b64(msg).replace(/=+$/, '').replace(/\+/g, ' ')
    expect(decodeCaptureText(mangled)).toBe(msg)
  })

  it('falls back to raw text when not Base64', () => {
    const plain = 'Rs. 500 debited to Swiggy'
    expect(decodeCaptureText(plain)).toBe(plain)
  })
})

describe('getCapturedMessage', () => {
  it('decodes the text param of a capture URL', () => {
    expect(getCapturedMessage(`outspend://capture?text=${encodeURIComponent(b64(INDUSIND))}`)).toBe(INDUSIND)
    expect(getCapturedMessage(`outspend://capture?text=${b64(INDUSIND)}`)).toBe(INDUSIND)
  })

  it('ignores other URLs', () => {
    expect(getCapturedMessage('https://example.com')).toBeNull()
  })
})

describe('IndusInd message', () => {
  it('parses as a debit of 60.00 after decoding', () => {
    const tx = parseBankMessage(decodeCaptureText(b64(INDUSIND)), 1, 'SHARE')
    expect(tx).toMatchObject({ amount: 60, type: 'DEBIT' })
  })
})

describe('extractReference', () => {
  const { extractReference } = require('../src/services/RegexEngine')
  it('finds UTR and UPI refs', () => {
    expect(extractReference('credited via NEFT. UTR Ref. BNPAH26303EAVN62')).toBe('BNPAH26303EAVN62')
    expect(extractReference(INDUSIND)).toBe('629869524079')
  })
})
