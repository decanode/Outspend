import { useEffect } from 'react'
import { Linking } from 'react-native'
import { parseCaptureUrl } from '../services/SharedCapture'
import { offerToAdd } from './captureFlow'

let initialHandled = false // getInitialURL keeps returning the launch link; handle it once

const handle = (url) => {
  const text = parseCaptureUrl(url)
  if (text) offerToAdd(text)
}

/** Handle outspend://capture links (optional share-sheet Shortcut), once the app is ready and unlocked. */
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
