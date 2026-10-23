import RNFS from 'react-native-fs'
import { shareAsync } from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { getRandomBytes } from 'expo-crypto'
import { encryptText, decryptText, BackupError } from './BackupCrypto'
import { buildBackupObject, restoreBackupObject, backupCounts } from './Backup'
import { updateSettings } from './Settings'

export const MIN_PASSPHRASE = 8

/** Encrypt everything on the device with the passphrase and offer the file to the share sheet. */
export const createEncryptedBackup = async (passphrase) => {
  if ((passphrase || '').length < MIN_PASSPHRASE) throw new BackupError(`Use at least ${MIN_PASSPHRASE} characters.`)
  const obj = await buildBackupObject()
  const blob = await encryptText(JSON.stringify(obj), passphrase, { randomBytes: getRandomBytes })
  const day = new Date().toISOString().slice(0, 10)
  const path = `${RNFS.CachesDirectoryPath}/Outspend_backup_${day}.outspend`
  await RNFS.writeFile(path, blob, 'utf8')
  await shareAsync(`file://${path}`, { mimeType: 'application/octet-stream', dialogTitle: 'Save your backup somewhere safe' })
  return backupCounts(obj)
}

/** Let the user choose a backup file. Returns its text, or null if they cancelled. */
export const pickBackupFile = async () => {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
  if (res.canceled || !res.assets || !res.assets[0]) return null
  return RNFS.readFile(decodeURIComponent(res.assets[0].uri.replace(/^file:\/\//, '')), 'utf8')
}

/** Decrypt and restore. Replaces all data on the device. */
export const restoreEncryptedBackup = async (fileText, passphrase) => {
  const obj = JSON.parse(await decryptText(fileText, passphrase))
  const counts = await restoreBackupObject(obj)
  await updateSettings({ ...obj.settings, isOnboarded: true })
  return counts
}
