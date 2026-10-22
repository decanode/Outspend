const AMOUNT = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:rupees?|rs\.?|inr|bucks)?/i
const CREDIT_WORDS = /\b(?:received|got|earned|salary|credited|refund(?:ed)?|income)\b/i

const clean = (s) => {
  const t = s.replace(/\s+/g, ' ').replace(/[.,]+$/, '').trim()
  return t ? t.replace(/\b[a-z]/g, c => c.toUpperCase()) : null
}

/**
 * Parse a spoken expense such as "spent 250 on coffee at Starbucks" or
 * "paid 1,200 rupees to Ramesh". Returns { amount, merchant, type, note };
 * amount is null when no number could be heard.
 */
export const parseVoiceExpense = (utterance) => {
  const text = (utterance || '').trim()
  const m = text.match(AMOUNT)
  const amount = m ? parseFloat(m[1].replace(/,/g, '')) : null
  const type = CREDIT_WORDS.test(text) ? 'CREDIT' : 'DEBIT'

  const rest = m ? (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)) : text
  const stop = '(?=\\s+(?:on|at|to|for|from|using|via|with|yesterday|today)\\b|[.,]|$)'
  const grab = (kw) => {
    const r = rest.match(new RegExp(`\\b${kw}\\s+(?:a\\s+|an\\s+|the\\s+)?([A-Za-z][A-Za-z0-9 &'-]{1,30}?)${stop}`, 'i'))
    return r ? clean(r[1]) : null
  }

  const atTo = grab('at') || grab('to') || grab('from')
  const onFor = grab('on') || grab('for')
  return {
    amount,
    merchant: atTo || onFor,
    note: atTo && onFor ? onFor : null,
    type,
  }
}
