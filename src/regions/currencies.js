// Currencies the app can display and recognise in messages.
//   tokens : how the currency is written in SMS text (symbols and codes); first one is shown
//   scale  : roughly how many units of this currency match 1 rupee of everyday spending
//            (purchasing-power style, NOT an exchange rate). Used only to size thresholds
//            such as "small purchase" or "unusually large", so they make sense per country.
//   words  : spoken names for voice entry
export const CURRENCIES = {
  INR: { symbol: '₹', decimals: 2, scale: 1, tokens: ['₹', 'Rs.', 'Rs', 'INR'], words: ['rupee', 'rupees', 'rs'] },
  USD: { symbol: '$', decimals: 2, scale: 0.05, tokens: ['US$', 'USD', '$'], words: ['dollar', 'dollars', 'bucks'] },
  GBP: { symbol: '£', decimals: 2, scale: 0.04, tokens: ['£', 'GBP'], words: ['pound', 'pounds', 'quid'] },
  EUR: { symbol: '€', decimals: 2, scale: 0.05, tokens: ['€', 'EUR'], words: ['euro', 'euros'] },
  AED: { symbol: 'AED', decimals: 2, scale: 0.2, tokens: ['AED', 'Dhs', 'DH'], words: ['dirham', 'dirhams'] },
  SAR: { symbol: 'SAR', decimals: 2, scale: 0.2, tokens: ['SAR', 'SR'], words: ['riyal', 'riyals'] },
  SGD: { symbol: 'S$', decimals: 2, scale: 0.07, tokens: ['S$', 'SGD'], words: ['singapore dollar', 'singapore dollars'] },
  AUD: { symbol: 'A$', decimals: 2, scale: 0.075, tokens: ['A$', 'AUD'], words: ['australian dollar', 'australian dollars'] },
  CAD: { symbol: 'C$', decimals: 2, scale: 0.07, tokens: ['C$', 'CAD', 'CA$'], words: ['canadian dollar', 'canadian dollars'] },
  NZD: { symbol: 'NZ$', decimals: 2, scale: 0.08, tokens: ['NZ$', 'NZD'], words: ['new zealand dollar', 'new zealand dollars'] },
  JPY: { symbol: '¥', decimals: 0, scale: 5, tokens: ['JPY', '¥', '円'], words: ['yen'] },
  CNY: { symbol: 'CN¥', decimals: 2, scale: 0.25, tokens: ['CNY', 'RMB', 'CN¥'], words: ['yuan', 'renminbi'] },
  CHF: { symbol: 'CHF', decimals: 2, scale: 0.045, tokens: ['CHF'], words: ['franc', 'francs'] },
  ZAR: { symbol: 'R', decimals: 2, scale: 0.5, tokens: ['ZAR', 'R'], words: ['rand'] },
  NGN: { symbol: '₦', decimals: 2, scale: 15, tokens: ['₦', 'NGN'], words: ['naira'] },
  KES: { symbol: 'KSh', decimals: 2, scale: 1.5, tokens: ['KSh', 'KES'], words: ['shilling', 'shillings'] },
  LKR: { symbol: 'LKR', decimals: 2, scale: 3, tokens: ['LKR'], words: [] },
  NPR: { symbol: 'NPR', decimals: 2, scale: 1.6, tokens: ['NPR'], words: [] },
  BDT: { symbol: '৳', decimals: 2, scale: 1.2, tokens: ['৳', 'BDT', 'Tk'], words: ['taka'] },
  PKR: { symbol: 'PKR', decimals: 2, scale: 3.5, tokens: ['PKR'], words: [] },
  MYR: { symbol: 'RM', decimals: 2, scale: 0.12, tokens: ['RM', 'MYR'], words: ['ringgit'] },
  PHP: { symbol: '₱', decimals: 2, scale: 0.7, tokens: ['₱', 'PHP'], words: ['peso', 'pesos'] },
  IDR: { symbol: 'Rp', decimals: 0, scale: 190, tokens: ['Rp', 'IDR'], words: ['rupiah'] },
  THB: { symbol: '฿', decimals: 2, scale: 0.45, tokens: ['฿', 'THB'], words: ['baht'] },
}

export const currencyInfo = (code) => CURRENCIES[code] || { symbol: code || '', decimals: 2, scale: 1, tokens: [code], words: [] }
export const currencySymbol = (code) => currencyInfo(code).symbol
export const currencyList = () => Object.keys(CURRENCIES)

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Every token for every currency, longest first so "S$" wins over "$". */
export const ALL_TOKENS = (() => {
  const seen = new Map()
  for (const [code, c] of Object.entries(CURRENCIES)) for (const t of c.tokens) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), { token: t, code })
  return [...seen.values()].sort((a, b) => b.token.length - a.token.length)
})()

const TOKEN_TO_CODE = new Map(ALL_TOKENS.map(({ token, code }) => [token.toLowerCase().replace(/\.$/, ''), code]))

/**
 * Which currency does a token mean? A bare "$" (or "R", "Rs") is ambiguous, so the user's
 * home currency wins when it uses that token.
 */
export const tokenToCurrency = (token, homeCurrency) => {
  const key = token.toLowerCase().replace(/\.$/, '')
  const home = CURRENCIES[homeCurrency]
  if (home && home.tokens.some(t => t.toLowerCase().replace(/\.$/, '') === key)) return homeCurrency
  return TOKEN_TO_CODE.get(key) || homeCurrency
}

/** Regex source matching any currency token (escaped, longest first). Symbols need no word boundary. */
export const TOKEN_PATTERN = ALL_TOKENS.map(t => escapeRe(t.token)).join('|')
/** ISO-style codes only, for "20.00 USD" written after the number. */
export const CODE_PATTERN = Object.keys(CURRENCIES).join('|')
