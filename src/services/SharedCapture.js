import { analyzeSms } from './RegexEngine'

// iPhone cannot read SMS in the background. Instead the user shares a bank message to a Shortcut, which
// opens  outspend://capture?text=<the message>  and the app adds it exactly as it would a received SMS.

export const CAPTURE_SCHEME = 'outspend://capture'

export const MAX_SHARED_LENGTH = 2000

/** Trim shared/pasted text; null when it is empty or too long to be a single bank message. */
export const cleanSharedText = (text) => {
  const t = typeof text === 'string' ? text.trim() : ''
  return t && t.length <= MAX_SHARED_LENGTH ? t : null
}

const decodeQueryValue = (v) => {
  try { return decodeURIComponent(v.replace(/\+/g, ' ')) } catch { return null }
}

/** The shared message text from a capture link, or null when the link is not one (or is empty/too long). */
export const parseCaptureUrl = (url) => {
  if (typeof url !== 'string' || !url.toLowerCase().startsWith(CAPTURE_SCHEME)) return null
  const query = url.slice(url.indexOf('?') + 1)
  if (url.indexOf('?') === -1) return null
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=')
    if (eq > -1 && pair.slice(0, eq) === 'text') {
      return cleanSharedText(decodeQueryValue(pair.slice(eq + 1)))
    }
  }
  return null
}

/**
 * What would happen if this text were added. Used to show the user a confirmation first: any app or
 * web page can open a link, so nothing is added without the user agreeing to what was understood.
 * @returns {{ ok: true, tx: object } | { ok: false, reason: string, amount?: number }}
 */
export const previewSharedText = (text, now = Date.now()) => {
  const r = analyzeSms('SHARED', text, now, undefined, { shared: true })
  return r.tx ? { ok: true, tx: r.tx } : { ok: false, reason: r.reject, amount: r.amount, currency: r.currency }
}
