import { useEffect } from 'react'
import { Alert, Linking } from 'react-native'
import { parseCaptureUrl, previewSharedText } from '../services/SharedCapture'
import { handleSharedText } from '../services/SmsIngest'
import { formatMoney } from '../services/Analytics'

let initialHandled = false // getInitialURL keeps returning the launch link; handle it once

const describe = (tx) => {
  const money = formatMoney(tx.amount, tx.currency)
  const where = tx.merchant && tx.merchant !== 'Unknown Vendor' ? (tx.type === 'DEBIT' ? ` at ${tx.merchant}` : ` from ${tx.merchant}`) : ''
  return tx.type === 'DEBIT' ? `Expense of ${money}${where}` : tx.type === 'REFUND' ? `Refund of ${money}${where}` : `Income of ${money}${where}`
}

const handle = async (url) => {
  const text = parseCaptureUrl(url)
  if (!text) return
  const preview = previewSharedText(text)
  if (!preview.ok) {
    Alert.alert(
      'Could not read this message',
      preview.amount
        ? 'It mentions an amount but does not look like a completed payment. It has been saved under Settings > Review skipped messages so you can add it by hand.'
        : 'It does not look like a bank transaction message.'
    )
    // Still log it for review when it mentions money.
    if (preview.amount) await handleSharedText(text)
    return
  }
  // Any app or web page can open this link, so ask before adding anything.
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

/** Handle outspend://capture links (iPhone share-sheet Shortcut), once the app is ready and unlocked. */
export default function useCaptureLink(enabled) {
  useEffect(() => {
    if (!enabled) return undefined
    if (!initialHandled) {
      initialHandled = true
      Linking.getInitialURL().then(url => { if (url) handle(url) })
    }
    const sub = Linking.addEventListener('url', ({ url }) => handle(url))
    return () => sub.remove()
  }, [enabled])
}
