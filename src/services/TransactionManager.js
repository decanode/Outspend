import { Q } from '@nozbe/watermelondb'
import { database } from '../db'
import { parseSmsTransaction } from './RegexEngine'

export const processIncomingSms = async (sender, body, timestamp) => {
  const parsedTx = parseSmsTransaction(sender, body, timestamp)
  
  if (!parsedTx) return null

  const twoHoursMs = 2 * 60 * 60 * 1000
  const timeLowerBound = timestamp - twoHoursMs
  const timeUpperBound = timestamp + twoHoursMs

  const txCollection = database.collections.get('transactions')

  // Find duplicates within a 2-hour window with the same amount
  const duplicates = await txCollection.query(
    Q.where('amount', parsedTx.amount),
    Q.where('timestamp', Q.between(timeLowerBound, timeUpperBound)),
    Q.where('source', Q.oneOf(['MANUAL', 'VOICE']))
  ).fetch()

  await database.write(async () => {
    if (duplicates.length > 0) {
      // Smart Merge: Upgrade the source of the manual entry to VERIFIED_SMS
      const manualTx = duplicates[0]
      await manualTx.update(tx => {
        tx.source = 'VERIFIED_SMS'
        tx.raw_text = parsedTx.raw_text
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
        tx.needs_review = parsedTx.needs_review
      })
    }
  })
}
