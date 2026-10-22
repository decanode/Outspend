import React, { useState } from 'react'
import { Text } from 'react-native'
import { Sheet, Field, Button } from './ui'
import { COLORS } from '../theme/designSystem'
import { isValidPin } from '../services/PinLogic'
import { MIN_PASSPHRASE } from '../services/BackupService'

const Err = ({ text }) => (text ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{text}</Text> : null)

/** Choose a new PIN (enter twice). */
export const PinSetupSheet = ({ onClose, onSave }) => {
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    if (!isValidPin(pin)) return setError('Use 4 to 6 digits.')
    if (pin !== again) return setError('The two PINs do not match.')
    await onSave(pin)
  }
  return (
    <Sheet visible onClose={onClose} title="Set an app PIN">
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 }}>
        The PIN is required when you open the app or return after 30 seconds. If you forget it, the only way back in is clearing the app&apos;s data, which erases your transactions, so keep a backup.
      </Text>
      <Field label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} style={{ marginBottom: 12 }} />
      <Field label="Repeat PIN" value={again} onChangeText={setAgain} keyboardType="number-pad" secureTextEntry maxLength={6} style={{ marginBottom: 12 }} />
      <Err text={error} />
      <Button title="Turn on lock" onPress={submit} />
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}

/** Ask for the current PIN before turning the lock off. */
export const PinConfirmSheet = ({ onClose, onVerify, title = 'Enter your PIN' }) => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    const ok = await onVerify(pin)
    if (!ok) { setPin(''); setError('Wrong PIN, or too many tries. Wait a moment and retry.') }
  }
  return (
    <Sheet visible onClose={onClose} title={title}>
      <Field label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} style={{ marginBottom: 12 }} />
      <Err text={error} />
      <Button title="Confirm" onPress={submit} />
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}

/** Passphrase for creating (asks twice) or restoring (once) a backup. */
export const PassphraseSheet = ({ mode, onClose, onSubmit }) => {
  const creating = mode === 'create'
  const [pass, setPass] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (creating) {
      if (pass.length < MIN_PASSPHRASE) return setError(`Use at least ${MIN_PASSPHRASE} characters.`)
      if (pass !== again) return setError('The two passphrases do not match.')
    } else if (!pass) {
      return setError('Enter the passphrase used for this backup.')
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit(pass)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <Sheet visible onClose={busy ? () => {} : onClose} title={creating ? 'Encrypt your backup' : 'Restore backup'}>
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 }}>
        {creating
          ? 'Your data is encrypted on this phone with this passphrase before it is saved. Nobody, including us, can open the file without it, and it cannot be recovered if you forget it.'
          : 'Enter the passphrase you chose when you made the backup. Restoring replaces everything currently in the app.'}
      </Text>
      <Field label="Passphrase" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" style={{ marginBottom: 12 }} />
      {creating ? <Field label="Repeat passphrase" value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" style={{ marginBottom: 12 }} /> : null}
      <Err text={error} />
      <Button title={busy ? 'Working… this can take a few seconds' : creating ? 'Create backup' : 'Restore'} onPress={submit} disabled={busy} />
      <Button title="Cancel" variant="ghost" onPress={onClose} disabled={busy} style={{ marginTop: 4 }} />
    </Sheet>
  )
}
