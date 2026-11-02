import { getRegion, currencyInfo, numberPattern, parseNumber, CURRENCIES } from '../regions'

const CREDIT_WORDS = /\b(?:received|got|earned|salary|credited|refund(?:ed)?|income)\b/i
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Currency words/symbols for the amount: the home currency's, plus every ISO code and symbol. */
const currencyWords = (region) => {
  const home = currencyInfo(region.currency)
  const symbols = Object.values(CURRENCIES).flatMap(c => [c.symbol, ...c.tokens].filter(t => !/^[A-Za-z]{1,2}$/.test(t) || home.tokens.includes(t)))
  return [...new Set([...home.words, ...home.tokens, ...symbols])].sort((a, b) => b.length - a.length).map(escapeRe).join('|')
}

const clean = (s) => {
  const t = s.replace(/\s+/g, ' ').replace(/[.,]+$/, '').trim()
  return t ? t.replace(/\b[a-z]/g, c => c.toUpperCase()) : null
}

/**
 * Parse a spoken expense such as "spent 250 on coffee at Starbucks" or "paid 1,200 to Ramesh".
 * Returns { amount, merchant, type, note }; amount is null when no number could be heard.
 * Currency words come from the active region ("rupees", "dollars", "pounds" ...).
 */
export const parseVoiceExpense = (utterance, region = getRegion()) => {
  const text = (utterance || '').trim()
  const words = currencyWords(region)
  const re = new RegExp(`(?:(?:${words})\\s?)?(${numberPattern(region.decimal)})(?:\\s?(?:${words})\\b)?`, 'i')
  const m = text.match(re)
  const amount = m ? parseNumber(m[1], region.decimal) : null
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
