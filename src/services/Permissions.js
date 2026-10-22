import { PermissionsAndroid, Platform, Linking } from 'react-native'
import { updateSettings } from './Settings'

const SMS_PERMS = [PermissionsAndroid.PERMISSIONS.READ_SMS, PermissionsAndroid.PERMISSIONS.RECEIVE_SMS]

export const hasSmsPermission = async () => {
  if (Platform.OS !== 'android') return false
  const results = await Promise.all(SMS_PERMS.map(p => PermissionsAndroid.check(p)))
  return results.every(Boolean)
}

/** @returns {Promise<'granted'|'denied'|'blocked'>} blocked = "never ask again" */
export const requestSmsPermission = async () => {
  if (Platform.OS !== 'android') return 'denied'
  const result = await PermissionsAndroid.requestMultiple(SMS_PERMS)
  const values = SMS_PERMS.map(p => result[p])
  let status = 'denied'
  if (values.every(v => v === PermissionsAndroid.RESULTS.GRANTED)) status = 'granted'
  else if (values.some(v => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) status = 'blocked'
  await updateSettings({ smsPermission: status === 'granted' })
  return status
}

export const openAppSettings = () => Linking.openSettings()
