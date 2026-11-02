// Detect money moving between your own accounts/cards, so it is not counted as spending.

const TRANSFER_TEXT = [
  /\b(?:credit\s*card|cc|card)\s*(?:bill|payment|dues?|outstanding)\b/i,
  /\bpayment\b.{0,40}\breceived\b.{0,40}\b(?:card|cc)\b/i,
  /\b(?:card|cc)\b.{0,40}\bpayment\b.{0,40}\breceived\b/i,
  /\bthank you for (?:your )?payment\b/i,
  /\b(?:self|own)[- ]?(?:account\s+)?transfer\b/i,
  /\bto self\b|\bown account\b/i,
  /\bcred\.club\b|@cred\b/i,
  /\b(?:add(?:ed)?|load(?:ed)?|top[- ]?up)\b.{0,20}\bwallet\b/i,
]

export const looksLikeTransfer = (text) => !!text && TRANSFER_TEXT.some(re => re.test(text))

const owner = (t) => t.account_id || t.card_id || null

export const TRANSFER_PAIR_WINDOW_MS = 12 * 60 * 60 * 1000

/**
 * Pair a debit from one of your accounts/cards with an equal credit into a different one
 * within 12 hours. Only rows nobody has judged yet (transfer == null) are considered.
 * Returns [{ debitId, creditId }].
 */
export const findTransferPairs = (txs, windowMs = TRANSFER_PAIR_WINDOW_MS) => {
  const pool = txs.filter(t => !t.is_deleted && !t.transfer && owner(t))
  const debits = pool.filter(t => t.type === 'DEBIT').sort((a, b) => a.timestamp - b.timestamp)
  const credits = pool.filter(t => t.type === 'CREDIT')
  const used = new Set()
  const pairs = []
  for (const d of debits) {
    let best = null
    for (const c of credits) {
      if (used.has(c.id) || c.amount !== d.amount || owner(c) === owner(d)) continue
      const gap = Math.abs(c.timestamp - d.timestamp)
      if (gap <= windowMs && (!best || gap < best.gap)) best = { c, gap }
    }
    if (best) {
      used.add(best.c.id)
      pairs.push({ debitId: d.id, creditId: best.c.id })
    }
  }
  return pairs
}
