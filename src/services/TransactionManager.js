import { Q } from '@nozbe/watermelondb'
import { database } from '../db'
import { parseSmsTransaction, parseBankMessage } from './RegexEngine'

export const processIncomingSms = async (sender, body, timestamp) => {
  return saveParsedTransaction(parseSmsTransaction(sender, body, timestamp), timestamp)
}

// iOS Shortcut / URL scheme entry: no sender ID available, text is already decoded.
export const processSharedMessage = async (body, timestamp = Date.now()) => {
  return saveParsedTransaction(parseBankMessage(body, timestamp, 'SHARE'), timestamp)
}

const saveParsedTransaction = async (parsedTx, timestamp) => {
  if (!parsedTx) return null

  const twoHoursMs = 2 * 60 * 60 * 1000
  const timeLowerBound = timestamp - twoHoursMs
  const timeUpperBound = timestamp + twoHoursMs

  const txCollection = database.collections.get('transactions')

  // Candidates: same amount and type inside the window, from any source
  const candidates = await txCollection.query(
    Q.where('amount', parsedTx.amount),
    Q.where('type', parsedTx.type),
    Q.where('timestamp', Q.between(timeLowerBound, timeUpperBound))
  ).fetch()

  // Already-captured message (same text or same bank reference): skip entirely
  const alreadyCaptured = candidates.some(tx =>
    tx.source !== 'MANUAL' && tx.source !== 'VOICE' && (
      (tx.raw_text && tx.raw_text === parsedTx.raw_text) ||
      (parsedTx.external_id && tx.external_id === parsedTx.external_id)
    )
  )
  if (alreadyCaptured) return null

  // Manual/voice entry for the same amount: merge instead of duplicating
  const duplicates = candidates.filter(tx => tx.source === 'MANUAL' || tx.source === 'VOICE')

  await database.write(async () => {
    if (duplicates.length > 0) {
      // Smart Merge: Upgrade the source of the manual entry to VERIFIED_SMS
      const manualTx = duplicates[0]
      await manualTx.update(tx => {
        tx.source = 'VERIFIED_SMS'
        tx.raw_text = parsedTx.raw_text
        tx.external_id = parsedTx.external_id
        if (parsedTx.merchant !== 'Unknown Vendor') {
          tx.merchant = parsedTx.merchant // Better merchant extraction from SMS
        }
      })
    } else {
      // Create new transaction
      await txCollection.create(tx => {
        tx.amount = parsedTx.amount
        tx.merchant = parsedTx.merchant
        tx.type = parsedTx.type
        tx.timestamp = parsedTx.timestamp
        tx.source = parsedTx.source
        tx.raw_text = parsedTx.raw_text
        tx.external_id = parsedTx.external_id
        tx.needs_review = parsedTx.needs_review
      })
    }
  })
}
