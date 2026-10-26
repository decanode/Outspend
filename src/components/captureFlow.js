import { Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { cleanSharedText, previewSharedText } from '../services/SharedCapture'
import { handleSharedText } from '../services/SmsIngest'
import { formatMoney } from '../services/Analytics'

// The user-facing half of iPhone capture: show what was understood and ask before adding it.
// Used by both ways in: pasting a copied bank message, and the outspend://capture link.

const describe = (tx) => {
  const money = formatMoney(tx.amount, tx.currency)
  const where = tx.merchant && tx.merchant !== 'Unknown Vendor' ? (tx.type === 'DEBIT' ? ` at ${tx.merchant}` : ` from ${tx.merchant}`) : ''
  return tx.type === 'DEBIT' ? `Expense of ${money}${where}` : tx.type === 'REFUND' ? `Refund of ${money}${where}` : `Income of ${money}${where}`
}

/** Show what the text means and add it if the user agrees. */
export const offerToAdd = async (rawText) => {
  const text = cleanSharedText(rawText)
  if (!text) return
  const preview = previewSharedText(text)
  if (!preview.ok) {
    Alert.alert(
      'Could not read this message',
      preview.amount
        ? 'It mentions an amount but does not look like a completed payment. It has been saved under Settings > Review skipped messages so you can add it by hand.'
        : 'It does not look like a bank transaction message.'
    )
    if (preview.amount) await handleSharedText(text) // logs it for review
    return
  }
  // Ask first: a link from another app can open this, and a paste may be the wrong text.
  Alert.alert('Add this transaction?', describe(preview.tx), [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Add',
      onPress: async () => {
        const r = await handleSharedText(text)
        if (r && r.created === 0 && r.merged === 0) Alert.alert('Already added', 'This message is already in your ledger.')
        else if (r && r.needsReview.length) Alert.alert('Added', 'The payee was not clear. Name it from the Needs attention card on Home.')
      },
    },
  ])
}

/** Read the clipboard (iOS shows its own "Allow Paste" prompt) and offer to add what is there. */
export const pasteAndOffer = async () => {
  let text = null
  try { text = cleanSharedText(await Clipboard.getStringAsync()) } catch { /* denied or unavailable */ }
  if (!text) {
    Alert.alert('Nothing to paste', 'Open the bank message in Messages, touch and hold it, tap Copy, then come back and tap Paste.')
    return
  }
  await offerToAdd(text)
}
