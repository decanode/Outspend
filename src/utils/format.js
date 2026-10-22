const pad = (n) => String(n).padStart(2, '0')

export const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }

export const formatDate = (ts) =>
  new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatDateTime = (ts) =>
  new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export const dayLabel = (ts, now = Date.now()) => {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
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

export const parseAmount = (str) => {
  const n = parseFloat(String(str || '').replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

export const SOURCE_LABELS = {
  SMS: 'SMS', VERIFIED_SMS: 'SMS (verified)', MANUAL: 'Manual', VOICE: 'Voice', GMAIL: 'Email',
}
