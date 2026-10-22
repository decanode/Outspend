import { currencyInfo } from './currencies'
import { REGIONS, SMS_PROFILES, regionById, guessRegionId } from './profiles'

export { REGIONS, SMS_PROFILES, regionById, guessRegionId }
export { currencyList, currencySymbol, currencyInfo, tokenToCurrency, CURRENCIES } from './currencies'

// The app has ONE home currency at a time. Amounts are stored as plain numbers; a transaction
// whose message used a different currency carries its own `currency` code and is kept out of
// home-currency totals.

let active = null
let groupingOverride = null // null = follow the region; 'lakh' | 'standard'

const build = (regionId, currencyOverride) => {
  const region = regionById(regionId) || regionById('IN')
  const currency = region.customCurrency && currencyOverride ? currencyOverride : region.currency
  return { ...region, currency, sms: SMS_PROFILES[region.smsProfile], info: currencyInfo(currency) }
}

/** Choose the active country. currencyOverride only applies to the "Other" region. */
export const setRegion = (regionId, currencyOverride = null) => {
  active = build(regionId, currencyOverride)
  return active
}

export const setGroupingOverride = (value) => { groupingOverride = value === 'lakh' || value === 'standard' ? value : null }

/** The active region (India until something else is chosen, which keeps older installs unchanged). */
export const getRegion = () => active || setRegion('IN')
export const homeCurrency = () => getRegion().currency
export const currencyScale = () => getRegion().info.scale
/** Scale a rupee-sized threshold to the active currency (e.g. "small purchase = 200"). */
export const scaled = (inrAmount) => {
  const v = inrAmount * currencyScale()
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))))
  const step = mag >= 10 ? mag / 2 : mag
  return Math.max(1, Math.round(v / step) * step) // round to a "friendly" number
}

const groupingLocale = () => {
  const r = getRegion()
  if ((groupingOverride || r.grouping) === 'lakh') return 'en-IN' // 12,34,567
  return r.locale === 'en-IN' ? 'en-US' : r.locale // 1,234,567
}

export const currencySymbolFor = (code) => currencyInfo(code || homeCurrency()).symbol

/** Format a money amount (sign is the caller's job). `code` defaults to the home currency. */
export const formatMoney = (amount, code = null) => {
  const c = code || homeCurrency()
  const info = currencyInfo(c)
  const whole = Number.isInteger(amount) || info.decimals === 0
  const digits = Math.abs(amount).toLocaleString(groupingLocale(), {
    maximumFractionDigits: info.decimals,
    minimumFractionDigits: whole ? 0 : info.decimals,
  })
  return `${info.symbol}${/^[A-Z]{3}$/.test(info.symbol) ? ' ' : ''}${digits}`
}

/** True when a transaction is in some other currency than the home one. */
export const isForeignCurrency = (t) => !!t.currency && t.currency !== homeCurrency()

/** Parse a number written in the region's style ("1,234.50" or "1.234,50"). */
export const parseNumber = (text, decimal = getRegion().decimal) => {
  const cleaned = String(text).replace(/[\s']/g, '')
  const normal = decimal === ',' ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '')
  return parseFloat(normal)
}

/** Regex source for a number in the region's style (no sign, optional decimals). */
export const numberPattern = (decimal = getRegion().decimal) =>
  decimal === ','
    ? '\\d+(?:\\.\\d{3})*(?:,\\d{1,2})?'
    : '\\d+(?:,\\d{2,3})*(?:\\.\\d{1,2})?'

export const dateLocale = () => getRegion().locale

/** Settings store 'AUTO' | 'IN' | 'INTL' for the digit grouping; map it to the override. */
export const groupingFromStyle = (style) => (style === 'IN' ? 'lakh' : style === 'INTL' ? 'standard' : null)

/** Apply persisted preferences (call at startup and whenever they change). */
export const applyRegionSettings = ({ region, currency, numberStyle }) => {
  setRegion(region || 'IN', currency || null)
  setGroupingOverride(groupingFromStyle(numberStyle))
  return getRegion()
}
