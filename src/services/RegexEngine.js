import { smsExternalId } from '../utils/hash'
import { getRegion, tokenToCurrency, parseNumber, numberPattern } from '../regions'
import { ALL_TOKENS, CURRENCIES, CODE_PATTERN } from '../regions/currencies'

// What counts as a money movement is decided by the region's SMS profile (sender format,
// payment modes, extra words) plus English keywords shared by every country. Add a country
// in src/regions/profiles.js; this file should not need to change.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "transferred", "trf" and "payment of" are deliberately NOT here: they can mean money out ("transferred
// to Ramesh") or in ("transferred to your account towards salary", "payment of Rs 500 received"), so they
// are resolved by direction below.
const BASE = {
  debit: ['debited', 'debit alert', 'debit of', 'spent', 'paid', 'sent', 'withdrawn', 'purchase', 'purchased', 'txn of', 'transaction of', 'used for'],
  credit: ['credited', 'credit alert', 'credit of', 'received', 'deposited', 'added to'],
  refund: ['refund', 'refunded', 'reversal', 'reversed', 'cashback'],
}

// Messages that look like money but are not a completed movement. Each carries the reason that is
// shown to the user when it is skipped. A "soft" pattern is boilerplate that also appears inside a
// genuine confirmation ("Autopay successful. Next due date 25 Oct"), so it only rejects when the
// message shows no sign that something was actually completed.
const REJECTS = [
  { reason: 'otp', re: /\b(?:otp|one[- ]time password|verification code|passcode)\b/i },
  { reason: 'otp', re: /\bdo not share\b/i },
  { reason: 'promo', re: /\b(?:offer|congratulations|pre-?approved|apply now|lowest interest|click here|kyc|upgrade your|limited period|t&c apply|tc apply)\b/i },
  { reason: 'failed', re: /\b(?:failed|declined|unsuccessful|not processed|could not be processed|insufficient)\b/i },
  { reason: 'reminder', re: /\b(?:will be debited|has requested|requested money|collect request|statement for|e-?statement|reminder)\b/i },
  { reason: 'reminder', soft: true, re: /\b(?:is due|payment due|minimum amount due|due date|due on|autopay.*(?:scheduled|registered))\b/i },
]

const COMPLETED = /\b(?:successful(?:ly)?|received|paid|debited|credited|processed|thank you|has been (?:paid|credited|debited))\b/i

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
    reject: [...REJECTS, ...(extras.reject || []).map(w => ({ reason: 'promo', re: wordsRe([w]) }))],
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

const SALARY_INFLOW = /\b(?:salary|payroll|neft credit|imps credit|(?:transferred|trf)\s+(?:to|into|in)\s+(?:your|ur|the)\b|(?:to|in|into)\s+your\s+(?:a\/c|ac|account))/i

/**
 * Work out what a message is. Returns { tx } for a completed money movement, or
 * { reject, amount?, currency? } with a reason code when it is not:
 *   not_bank_sender | otp | promo | failed | reminder | no_amount | no_direction
 * `amount` is the figure found in a rejected message (when there is one), so the user can review
 * and add it by hand.
 *
 * options.shared: the text was handed over by the user (iPhone share sheet) and has no sender. The
 * sender check is skipped, and the id depends only on the text, so sharing it twice adds it once.
 */
export const analyzeSms = (sender, body, timestamp, region = getRegion(), options = {}) => {
  if (!options.shared && !isTransactionalSender(sender, region)) return { reject: 'not_bank_sender' }
  if (!body) return { reject: 'no_amount' }
  const c = compile(region)

  // Pull the balance clause out first so "Avl Bal Rs 5,000" is never read as the amount.
  const withoutBalance = body.replace(c.balance, ' ')
  const found = matchAmount(withoutBalance, c, region)
  const hint = found && found.amount > 0 ? { amount: found.amount, currency: found.currency } : {}

  const completed = COMPLETED.test(body.replace(/will be debited/gi, ' '))
  for (const r of c.reject) {
    if (r.re.test(body) && !(r.soft && completed)) return { reject: r.reason, ...hint }
  }
  if (!found || !(found.amount > 0)) return { reject: 'no_amount' }

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
  } else if (/\b(?:transferred|trf|salary|payroll|payment of|auto-?pay|auto[- ]?debit|e-?mandate|standing instruction)\b/i.test(withoutBalance)) {
    // No explicit debit/credit word. "Transferred to your account ... salary" is money in; a transfer to
    // anyone else, a payment, or an autopay is money out.
    type = SALARY_INFLOW.test(withoutBalance) ? 'CREDIT' : 'DEBIT'
  }
  if (!type) return { reject: 'no_direction', ...hint }

  const merchant = extractMerchant(withoutBalance, type, region)

  return {
    tx: {
      amount: found.amount,
      currency: found.currency,
      merchant: merchant || 'Unknown Vendor',
      type,
      timestamp,
      source: 'SMS',
      raw_text: body,
      needs_review: !merchant,
      external_id: options.shared ? smsExternalId('SHARED', 0, body) : smsExternalId(sender, timestamp, body),
      last4: extractLast4(withoutBalance),
      payment_mode: detectPaymentMode(withoutBalance, region),
      vpa: extractVpa(withoutBalance, region),
    },
  }
}

/** The transaction draft, or null when the message is not a completed money movement. */
export const parseSmsTransaction = (sender, body, timestamp, region = getRegion()) =>
  analyzeSms(sender, body, timestamp, region).tx || null
