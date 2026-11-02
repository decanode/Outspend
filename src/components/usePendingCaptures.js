import { useEffect } from 'react'
import { AppState } from 'react-native'
import { drainPendingCaptures } from '../services/PendingCaptures'

/** Add messages queued by the iPhone background action, at launch and whenever the app returns. */
export default function usePendingCaptures(enabled) {
  useEffect(() => {
    if (!enabled) return undefined
    const run = () => drainPendingCaptures().catch(e => console.error('Queued capture failed', e))
    run()
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run() })
    return () => sub.remove()
  }, [enabled])
}
