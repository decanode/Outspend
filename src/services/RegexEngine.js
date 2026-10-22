import { smsExternalId } from '../utils/hash'
import { getRegion, tokenToCurrency, parseNumber, numberPattern } from '../regions'
import { ALL_TOKENS, CURRENCIES, CODE_PATTERN } from '../regions/currencies'

// What counts as a money movement is decided by the region's SMS profile (sender format,
// payment modes, extra words) plus English keywords shared by every country. Add a country
// in src/regions/profiles.js; this file should not need to change.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const BASE = {
  debit: ['debited', 'spent', 'paid', 'sent', 'withdrawn', 'purchase', 'purchased', 'payment of', 'txn of', 'transaction of', 'used for', 'transferred', 'trf'],
  credit: ['credited', 'received', 'deposited', 'added to'],
  refund: ['refund', 'refunded', 'reversal', 'reversed', 'cashback'],
}

const REJECT_PATTERNS = [
  /\b(?:otp|one[- ]time password|verification code|passcode)\b/i,
  /\bdo not share\b/i,
  /\b(?:offer|congratulations|pre-?approved|apply now|lowest interest|click here|kyc|upgrade your|limited period|t&c apply|tc apply)\b/i,
  /\b(?:failed|declined|unsuccessful|not processed|could not be processed|insufficient)\b/i,
  /\b(?:will be debited|is due|payment due|minimum amount due|due date|due on|has requested|requested money|collect request|autopay.*(?:scheduled|registered))\b/i,
  /\b(?:statement for|e-?statement|reminder)\b/i,
]

const wordsRe = (words) => new RegExp(`\\b(?:${words.map(escapeRe).join('|')})\\b`, 'i')

const compiled = new Map()

/** Build (and cache) every regex a region needs. */
const compile = (region) => {
  const key = `${region.id}|${region.currency}|${region.decimal}`
  if (compiled.has(key)) return compiled.get(key)

  const homeTokens = new Set((CURRENCIES[region.currency] || { tokens: [] }).tokens)
  // Symbols (£ € $ S$ ...) and ISO codes are recognised everywhere. Letter abbreviations like
  // "Rs", "R", "RM" are only trusted for the home currency, to avoid reading "Ref R12" as money.
  const tokens = ALL_TOKENS.filter(({ token, code }) => !/^[A-Za-z.]+$/.test(token) || token === code || homeTokens.has(token))
  const tokenPattern = tokens.map(t => escapeRe(t.token)).join('|')
  const num = numberPattern(region.decimal)
  const profile = region.sms
  const extras = profile.extraKeywords || {}

  const c = {
    tokenPattern,
    prefix: new RegExp(`(?<![A-Za-z0-9])(${tokenPattern})\\s?(${num})`, 'i'),
    suffix: new RegExp(`(${num})\\s?(${CODE_PATTERN})\\b`, 'i'),
    balance: new RegExp(`(?:avl|avail(?:able)?|total|closing|clear|current|ledger)\\.?\\s*(?:bal(?:ance)?)\\.?\\s*(?:is|:|-)?\\s*(?:(?:${tokenPattern})\\s?)?(?:${num})(?:\\s?(?:${CODE_PATTERN})\\b)?`, 'i'),
    bare: new RegExp(`(?:debited|credited|spent|paid|sent|received|withdrawn)\\s+(?:by|with|for|of)?\\s*(${num})`, 'i'),
    currencyStart: new RegExp(`^(?:${tokenPattern})(?![A-Za-z])`, 'i'),
    debit: wordsRe([...BASE.debit, ...(extras.debit || [])]),
    credit: wordsRe([...BASE.credit, ...(extras.credit || [])]),
    refund: wordsRe(BASE.refund),
    reject: [...REJECT_PATTERNS, ...(extras.reject || []).map(w => wordsRe([w]))],
  }
  compiled.set(key, c)
  return c
}

const VPA = /([a-z0-9._-]{2,}@[a-z][a-z0-9]{1,})/i

export const extractVpa = (text, region = getRegion()) => {
  if (!region.sms.vpa) return null
  const m = (text || '').match(VPA)
  return m ? m[1] : null
}

const extractLast4 = (body) => {
  const m = body.match(/(?:a\/c|ac(?:ct)?|account|card)[^0-9]{0,18}?(\d{4})\b/i)
  return m ? m[1] : null
}

const detectPaymentMode = (body, region) => {
  const p = region.sms
  if (p.vpa && VPA.test(body)) return p.paymentModes.some(m => m.name === 'UPI') ? 'UPI' : null
  const hit = p.paymentModes.find(m => m.re.test(body))
  return hit ? hit.name : null
}

const CLEAN_STOP = '(?=\\s+(?:on|via|ref|refno|upi|txn|using|from|for|dated|date|info|avl|bal|if|call|not|with|ending)\\b|\\s*[(.,;:]|\\s+-\\s|$)'
const NAME = "([A-Za-z0-9][A-Za-z0-9 &'_@\\-*/]{1,40}?)"
const OWN_ACCOUNT = /^(?:a\/c|ac|acct|account|your|card|xx|x{2,}|bank|the)\b/i

const titleCase = (s) =>
  s === s.toUpperCase() && /[A-Z]/.test(s)
    ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
    : s

const cleanMerchant = (raw, c) => {
  let m = raw.replace(/^vpa\s+/i, '').replace(/\s+/g, ' ').trim().replace(/[-_/:*]+$/, '').trim()
  if (!m || m.length < 2 || /^\d+$/.test(m)) return null
  if (OWN_ACCOUNT.test(m) || c.currencyStart.test(m)) return null
  return titleCase(m)
}

export const extractMerchant = (body, type, region = getRegion()) => {
  const c = compile(region)
  const patterns = type === 'DEBIT'
    ? [
        new RegExp(`\\bat\\s+${NAME}${CLEAN_STOP}`, 'i'),
        new RegExp(`\\b(?:to|towards|trf to)\\s+(?:vpa\\s+)?${NAME}${CLEAN_STOP}`, 'i'),
        new RegExp(`\\bon\\s+([A-Za-z][A-Za-z0-9 &'_\\-]{2,30}?)${CLEAN_STOP}`, 'i'),
      ]
    : [
        new RegExp(`\\bfrom\\s+(?:vpa\\s+)?${NAME}${CLEAN_STOP}`, 'ig'),
        new RegExp(`\\bby\\s+(?:vpa\\s+)?${NAME}${CLEAN_STOP}`, 'ig'),
        new RegExp(`\\bat\\s+${NAME}${CLEAN_STOP}`, 'ig'),
      ]
  for (const re of patterns) {
    // Scan every occurrence: the first "by"/"to" is often "by Rs.500" or "to your a/c".
    for (const m of body.matchAll(new RegExp(re.source, 'ig'))) {
      const cleaned = cleanMerchant(m[1], c)
      if (cleaned) return cleaned
    }
  }
  return null
}

export const isTransactionalSender = (sender, region = getRegion()) => {
  const p = region.sms
  return !!sender && p.senderPattern.test(sender) && !(p.promoSender && p.promoSender.test(sender))
}

/** Find the transaction amount and its currency; the balance clause is removed beforehand. */
const matchAmount = (text, c, region) => {
  let m = text.match(c.prefix)
  if (m) return { amount: parseNumber(m[2], region.decimal), currency: tokenToCurrency(m[1], region.currency) }
  m = text.match(c.suffix)
  if (m) return { amount: parseNumber(m[1], region.decimal), currency: m[2].toUpperCase() }
  m = text.match(c.bare)
  if (m) return { amount: parseNumber(m[1], region.decimal), currency: region.currency }
  return null
}

/**
 * Parse a bank/merchant SMS into a transaction draft, or null when the message is not a
 * completed money movement (OTP, promo, reminder, failure, chatter, a person's number).
 */
export const parseSmsTransaction = (sender, body, timestamp, region = getRegion()) => {
  if (!isTransactionalSender(sender, region) || !body) return null
  const c = compile(region)
  if (c.reject.some(re => re.test(body))) return null

  // Pull the balance clause out first so "Avl Bal Rs 5,000" is never read as the amount.
  const withoutBalance = body.replace(c.balance, ' ')
  const found = matchAmount(withoutBalance, c, region)
  if (!found || !(found.amount > 0)) return null

  const debitIdx = withoutBalance.search(c.debit)
  const creditIdx = withoutBalance.search(c.credit)
  const hasRefundWord = c.refund.test(withoutBalance)

  let type = null
  if (hasRefundWord && (creditIdx !== -1 || /refund|reversal|reversed/i.test(withoutBalance))) {
    type = 'REFUND'
  } else if (debitIdx !== -1 && (creditIdx === -1 || debitIdx < creditIdx)) {
    type = 'DEBIT'
  } else if (creditIdx !== -1) {
    type = 'CREDIT'
  }
  if (!type) return null

  const merchant = extractMerchant(withoutBalance, type, region)

  return {
    amount: found.amount,
    currency: found.currency,
    merchant: merchant || 'Unknown Vendor',
    type,
    timestamp,
    source: 'SMS',
    raw_text: body,
    needs_review: !merchant,
    external_id: smsExternalId(sender, timestamp, body),
    last4: extractLast4(withoutBalance),
    payment_mode: detectPaymentMode(withoutBalance, region),
    vpa: extractVpa(withoutBalance, region),
  }
}
