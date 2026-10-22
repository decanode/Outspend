import { smsExternalId } from '../utils/hash'

// Indian bank/merchant sender ids look like VM-HDFCBK, AX-SBIUPI-S, JD-ICICIT-S.
// A "-P" suffix marks promotional traffic, which is never a transaction.
export const TRAI_SENDER_REGEX = /^[A-Za-z]{2}-[A-Za-z0-9&]{3,9}(-[A-Za-z])?$/

const isPromoSender = (sender) => /-P$/i.test(sender)

const REJECT_PATTERNS = [
  /\b(?:otp|one[- ]time password|verification code|passcode)\b/i,
  /\bdo not share\b/i,
  /\b(?:offer|congratulations|pre-?approved|apply now|lowest interest|click here|kyc|upgrade your|limited period|t&c apply|tc apply)\b/i,
  /\b(?:failed|declined|unsuccessful|not processed|could not be processed|insufficient)\b/i,
  /\b(?:will be debited|is due|payment due|minimum amount due|due date|due on|has requested|requested money|collect request|autopay.*(?:scheduled|registered))\b/i,
  /\b(?:statement for|e-?statement|reminder)\b/i,
]

const BALANCE_CLAUSE = /(?:avl|avail(?:able)?|total|closing|clear)\.?\s*(?:bal(?:ance)?)\.?\s*(?:is|:|-)?\s*(?:Rs\.?|INR|₹)\s?(\d[\d,]*(?:\.\d{1,2})?)/i
const AMOUNT = /(?:Rs\.?|INR|₹)\s?(\d[\d,]*(?:\.\d{1,2})?)/i
const AMOUNT_FALLBACK = /(?:debited|credited|spent|paid|sent|received|withdrawn)\s+(?:by|with|for|of)?\s*(\d[\d,]*(?:\.\d{1,2})?)/i

const DEBIT_KEYWORDS = /\b(?:debited|spent|paid|sent|withdrawn|purchase|purchased|payment of|txn of|transaction of|used for|transferred|trf)\b/i
const CREDIT_KEYWORDS = /\b(?:credited|received|deposited|added to)\b/i
const REFUND_KEYWORDS = /\b(?:refund(?:ed)?|reversal|reversed|cashback)\b/i

const VPA = /([a-z0-9._-]{2,}@[a-z][a-z0-9]{1,})/i

const toNumber = (s) => parseFloat(s.replace(/,/g, ''))

export const extractVpa = (text) => {
  const m = (text || '').match(VPA)
  return m ? m[1] : null
}

const extractLast4 = (body) => {
  const m = body.match(/(?:a\/c|ac(?:ct)?|account|card)[^0-9]{0,18}?(\d{4})\b/i)
  return m ? m[1] : null
}

const detectPaymentMode = (body) => {
  if (/\bupi\b/i.test(body) || VPA.test(body)) return 'UPI'
  if (/\batm\b|\bcash withdrawal\b/i.test(body)) return 'ATM'
  if (/\bcard\b/i.test(body)) return 'CARD'
  if (/\bneft\b/i.test(body)) return 'NEFT'
  if (/\bimps\b/i.test(body)) return 'IMPS'
  if (/\brtgs\b/i.test(body)) return 'RTGS'
  return null
}

const CLEAN_STOP = '(?=\\s+(?:on|via|ref|refno|upi|txn|using|from|for|dated|date|info|avl|bal|if|call|not)\\b|\\s*[(.,;:]|\\s+-\\s|$)'
const NAME = "([A-Za-z0-9][A-Za-z0-9 &'_@\\-*/]{1,40}?)"
const OWN_ACCOUNT = /^(?:a\/c|ac|acct|account|your|card|xx|x{2,}|bank|the)\b/i

const titleCase = (s) =>
  s === s.toUpperCase() && /[A-Z]/.test(s)
    ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
    : s

const cleanMerchant = (raw) => {
  let m = raw.replace(/^vpa\s+/i, '').replace(/\s+/g, ' ').trim().replace(/[-_/:*]+$/, '').trim()
  if (!m || m.length < 2 || /^\d+$/.test(m)) return null
  if (OWN_ACCOUNT.test(m) || /^(?:rs|inr|₹)\b/i.test(m)) return null
  return titleCase(m)
}

export const extractMerchant = (body, type) => {
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
      const cleaned = cleanMerchant(m[1])
      if (cleaned) return cleaned
    }
  }
  return null
}

export const isTransactionalSender = (sender) =>
  !!sender && TRAI_SENDER_REGEX.test(sender) && !isPromoSender(sender)

/**
 * Parse a bank/merchant SMS into a transaction draft, or null when the message
 * is not a completed money movement (OTP, promo, reminder, failure, chatter).
 */
export const parseSmsTransaction = (sender, body, timestamp) => {
  if (!isTransactionalSender(sender) || !body) return null
  if (REJECT_PATTERNS.some(re => re.test(body))) return null

  // Pull the balance clause out first so "Avl Bal Rs 5,000" is never read as the amount.
  const withoutBalance = body.replace(BALANCE_CLAUSE, ' ')
  const amountMatch = withoutBalance.match(AMOUNT) || withoutBalance.match(AMOUNT_FALLBACK)
  if (!amountMatch) return null
  const amount = toNumber(amountMatch[1])
  if (!(amount > 0)) return null

  const debitIdx = withoutBalance.search(DEBIT_KEYWORDS)
  const creditIdx = withoutBalance.search(CREDIT_KEYWORDS)
  const hasRefundWord = REFUND_KEYWORDS.test(withoutBalance)

  let type = null
  if (hasRefundWord && (creditIdx !== -1 || /refund|reversal|reversed/i.test(withoutBalance))) {
    type = 'REFUND'
  } else if (debitIdx !== -1 && (creditIdx === -1 || debitIdx < creditIdx)) {
    type = 'DEBIT'
  } else if (creditIdx !== -1) {
    type = 'CREDIT'
  }
  if (!type) return null

  const merchant = extractMerchant(withoutBalance, type)
  const vpa = extractVpa(withoutBalance)

  return {
    amount,
    merchant: merchant || 'Unknown Vendor',
    type,
    timestamp,
    source: 'SMS',
    raw_text: body,
    needs_review: !merchant,
    external_id: smsExternalId(sender, timestamp, body),
    last4: extractLast4(withoutBalance),
    payment_mode: detectPaymentMode(withoutBalance),
    vpa,
  }
}
