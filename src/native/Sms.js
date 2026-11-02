import { NativeModules, Platform } from 'react-native'

const { SmsModule } = NativeModules

export const isSmsAvailable = Platform.OS === 'android' && !!SmsModule

/**
 * @typedef {{ sender: string, body: string, timestamp: number }} RawSms
 */

/** Oldest-first inbox page: messages dated >= sinceMs, at most `limit`. */
export const getInboxPage = async (sinceMs, limit = 500) => {
  if (!isSmsAvailable) return []
  return SmsModule.getInboxSince(sinceMs, limit)
}

// Live messages are not delivered here: the manifest-declared SmsReceiver wakes the app and
// runs the "SmsReceivedTask" headless task (see index.js and SmsHeadlessTask.js).
