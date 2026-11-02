// How a country's phone messages and conventions look. To support a new country:
//   1. add a row to REGIONS (currency, locale, number format, which SMS profile to use);
//   2. if its bank messages differ a lot, add an SMS profile; otherwise reuse GLOBAL;
//   3. add real (anonymised) sample messages to __tests__/fixtures and run the tests.

/**
 * SMS profiles drive the parser.
 *  senderPattern : which sender ids can be a bank/merchant (personal phone numbers must not match)
 *  promoSender   : sender ids that are marketing traffic
 *  paymentModes  : [{ name, re }] first match wins
 *  vpa           : the country has UPI-style payment addresses (name@bank)
 *  extraKeywords : country-specific words, merged with the shared English ones
 *  keywordCategories : [[merchant keyword, category]] on top of the shared global list
 */
export const SMS_PROFILES = {
  // India: DLT-registered sender ids such as VM-HDFCBK, AX-SBIUPI-S. A "-P" suffix is promotional.
  IN: {
    // Dashed ids (VM-HDFCBK, AX-SBIUPI-S), plus bare ids (HDFCBK) and numeric short codes, which payroll
    // gateways and card networks sometimes use. Personal numbers (7+ digits, often with +91) never match.
    senderPattern: /^[A-Za-z]{2}-[A-Za-z0-9&]{3,9}(-[A-Za-z])?$|^(?=.*[A-Za-z])[A-Za-z0-9&]{3,11}$|^\d{3,6}$/,
    promoSender: /-P$/i,
    vpa: true,
    paymentModes: [
      { name: 'UPI', re: /\bupi\b/i },
      { name: 'ATM', re: /\batm\b|\bcash withdrawal\b/i },
      { name: 'CARD', re: /\bcard\b/i },
      { name: 'NEFT', re: /\bneft\b/i },
      { name: 'IMPS', re: /\bimps\b/i },
      { name: 'RTGS', re: /\brtgs\b/i },
    ],
    extraKeywords: { debit: [], credit: [], reject: [] },
    keywordCategories: [
      ['swiggy', 'Food & Dining'], ['zomato', 'Food & Dining'], ['dominos', 'Food & Dining'],
      ['bigbasket', 'Food & Dining'], ['blinkit', 'Food & Dining'], ['zepto', 'Food & Dining'], ['instamart', 'Food & Dining'],
      ['ola', 'Transport'], ['rapido', 'Transport'], ['irctc', 'Transport'], ['redbus', 'Transport'], ['fastag', 'Transport'],
      ['hotstar', 'Entertainment'], ['bookmyshow', 'Entertainment'],
      ['flipkart', 'Shopping'], ['myntra', 'Shopping'], ['ajio', 'Shopping'], ['meesho', 'Shopping'],
      ['airtel', 'Bills & Utilities'], ['jio', 'Bills & Utilities'], ['vodafone', 'Bills & Utilities'], ['bescom', 'Bills & Utilities'],
      ['apollo', 'Healthcare'], ['medplus', 'Healthcare'], ['1mg', 'Healthcare'], ['pharmeasy', 'Healthcare'],
    ],
  },

  // Everywhere else (English text): alphanumeric sender ids and 3-6 digit short codes are
  // businesses; ordinary phone numbers (7+ digits) are people and never parsed.
  GLOBAL: {
    senderPattern: /^(?=.*[A-Za-z])[A-Za-z0-9 _.&-]{2,15}$|^\d{3,6}$/,
    promoSender: null,
    vpa: false,
    paymentModes: [
      { name: 'ATM', re: /\batm\b|\bcash withdrawal\b/i },
      { name: 'CARD', re: /\bcard\b|\bvisa\b|\bmastercard\b|\bdebit\b.*\bpurchase\b|\bpos\b/i },
      { name: 'TRANSFER', re: /\b(?:ach|wire|transfer|zelle|venmo|faster payment|sepa|paynow|fps|interac|e-?transfer)\b/i },
    ],
    extraKeywords: { debit: ['charge', 'charged', 'withdrawal', 'deducted', 'pos', 'contactless'], credit: ['deposit', 'direct deposit', 'payroll'], reject: ['security code', '2fa', 'verification'] },
    keywordCategories: [
      ['walmart', 'Shopping'], ['target', 'Shopping'], ['costco', 'Shopping'], ['ikea', 'Shopping'], ['tesco', 'Food & Dining'],
      ['kroger', 'Food & Dining'], ['whole foods', 'Food & Dining'], ['doordash', 'Food & Dining'], ['deliveroo', 'Food & Dining'],
      ['grab', 'Transport'], ['lyft', 'Transport'], ['shell', 'Transport'], ['bp ', 'Transport'], ['tfl', 'Transport'],
      ['comcast', 'Bills & Utilities'], ['verizon', 'Bills & Utilities'], ['vodafone', 'Bills & Utilities'], ['o2 ', 'Bills & Utilities'],
      ['cvs', 'Healthcare'], ['walgreens', 'Healthcare'], ['boots', 'Healthcare'],
    ],
  },
}

/**
 * Country presets. `smsProfile` points into SMS_PROFILES. `decimal` is the decimal mark used in
 * messages. `grouping` is the default digit grouping: 'lakh' (12,34,567) or 'standard' (1,234,567).
 */
export const REGIONS = [
  { id: 'IN', name: 'India', currency: 'INR', locale: 'en-IN', speechLang: 'en-IN', smsProfile: 'IN', decimal: '.', grouping: 'lakh', importDays: 90 },
  { id: 'US', name: 'United States', currency: 'USD', locale: 'en-US', speechLang: 'en-US', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', speechLang: 'en-GB', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'AE', name: 'United Arab Emirates', currency: 'AED', locale: 'en-AE', speechLang: 'en-GB', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'SA', name: 'Saudi Arabia', currency: 'SAR', locale: 'en-US', speechLang: 'en-US', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'SG', name: 'Singapore', currency: 'SGD', locale: 'en-SG', speechLang: 'en-SG', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', speechLang: 'en-AU', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'NZ', name: 'New Zealand', currency: 'NZD', locale: 'en-NZ', speechLang: 'en-NZ', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'CA', name: 'Canada', currency: 'CAD', locale: 'en-CA', speechLang: 'en-CA', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'IE', name: 'Ireland', currency: 'EUR', locale: 'en-IE', speechLang: 'en-IE', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'ZA', name: 'South Africa', currency: 'ZAR', locale: 'en-ZA', speechLang: 'en-ZA', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'NG', name: 'Nigeria', currency: 'NGN', locale: 'en-NG', speechLang: 'en-NG', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'KE', name: 'Kenya', currency: 'KES', locale: 'en-KE', speechLang: 'en-KE', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'PH', name: 'Philippines', currency: 'PHP', locale: 'en-PH', speechLang: 'en-PH', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'MY', name: 'Malaysia', currency: 'MYR', locale: 'en-MY', speechLang: 'en-MY', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'LK', name: 'Sri Lanka', currency: 'LKR', locale: 'en-US', speechLang: 'en-US', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90 },
  { id: 'NP', name: 'Nepal', currency: 'NPR', locale: 'en-US', speechLang: 'en-US', smsProfile: 'GLOBAL', decimal: '.', grouping: 'lakh', importDays: 90 },
  { id: 'BD', name: 'Bangladesh', currency: 'BDT', locale: 'en-US', speechLang: 'en-US', smsProfile: 'GLOBAL', decimal: '.', grouping: 'lakh', importDays: 90 },
  { id: 'PK', name: 'Pakistan', currency: 'PKR', locale: 'en-PK', speechLang: 'en-PK', smsProfile: 'GLOBAL', decimal: '.', grouping: 'lakh', importDays: 90 },
  // Anywhere not listed: pick any supported currency; messages are read with the generic profile.
  { id: 'OTHER', name: 'Other country', currency: 'USD', locale: 'en-US', speechLang: 'en-US', smsProfile: 'GLOBAL', decimal: '.', grouping: 'standard', importDays: 90, customCurrency: true },
]

export const regionById = (id) => REGIONS.find(r => r.id === id) || null

/** Best guess from the phone's locale, e.g. "en-GB" -> GB, "hi-IN" -> IN. Falls back to OTHER. */
export const guessRegionId = (localeTag) => {
  const m = /[-_]([A-Za-z]{2})\b/.exec(localeTag || '')
  const code = m ? m[1].toUpperCase() : null
  return code && regionById(code) ? code : 'OTHER'
}
