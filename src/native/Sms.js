import { NativeModules, DeviceEventEmitter, Platform } from 'react-native'

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

/** Subscribe to live incoming SMS. Returns an unsubscribe function. */
export const subscribeToSms = (callback) => {
  if (!isSmsAvailable) return () => {}
  const sub = DeviceEventEmitter.addListener('onSmsReceived', callback)
  return () => sub.remove()
}
