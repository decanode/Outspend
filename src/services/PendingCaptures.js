import { File, Paths } from 'expo-file-system'
import { Platform } from 'react-native'
import { handleSharedText } from './SmsIngest'
import { parsePendingLines } from './SharedCapture'

// The iPhone "Add transaction to Outspend" Shortcuts action (plugins/ios/OutspendCaptureIntent.swift) runs
// without opening the app and queues each bank message in this file, one JSON object per line.
const QUEUE = 'pending-captures.jsonl'
const WORKING = 'pending-captures.processing.jsonl'

/** Add everything queued by the background action. Returns how many messages were added. */
export const drainPendingCaptures = async () => {
  if (Platform.OS !== 'ios') return 0
  const queue = new File(Paths.document, QUEUE)
  const working = new File(Paths.document, WORKING)
  // Move first so messages queued while we work land in a fresh file instead of being lost.
  if (queue.exists) await queue.move(working, { overwrite: true })
  if (!working.exists) return 0
  let added = 0
  try {
    for (const { text, at } of parsePendingLines(await working.text())) {
      const r = await handleSharedText(text, at)
      if (r && (r.created || r.merged)) added++
    }
    working.delete()
  } catch (e) {
    console.error('Could not read queued messages', e) // working file is kept and retried next time
  }
  return added
}
