import { dateLocale, parseNumber } from '../regions'

const pad = (n) => String(n).padStart(2, '0')

export const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }

export const formatDate = (ts) =>
  new Date(ts).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })

export const formatDateTime = (ts) =>
  new Date(ts).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export const dayLabel = (ts, now = Date.now()) => {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return new Date(ts).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export const toDateInput = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse YYYY-MM-DD at the time-of-day of `base`. Returns null when invalid. */
export const parseDateInput = (str, base = Date.now()) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((str || '').trim())
  if (!m) return null
  const [, y, mo, da] = m.map(Number)
  const t = new Date(base)
  const d = new Date(y, mo - 1, da, t.getHours(), t.getMinutes(), 0, 0)
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null
  return d.getTime()
}

/** Amount typed by the user, in the region's number style. Currency symbols and spaces are ignored. */
export const parseAmount = (str) => {
  const n = parseSignedAmount(str)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** Like parseAmount but allows zero and negatives (account balances). NaN when it is not a number. */
export const parseSignedAmount = (str) => {
  const cleaned = String(str || '').replace(/[^\d.,-]/g, '')
  if (!/\d/.test(cleaned)) return NaN
  const negative = cleaned.startsWith('-')
  const n = parseNumber(cleaned.replace(/-/g, ''))
  return negative ? -n : n
}

export const SOURCE_LABELS = {
  SMS: 'SMS', VERIFIED_SMS: 'SMS (verified)', MANUAL: 'Manual', VOICE: 'Voice', GMAIL: 'Email',
}
