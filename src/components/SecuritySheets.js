import React, { useState } from 'react'
import { Text } from 'react-native'
import { Sheet, Field, Button } from './ui'
import { COLORS } from '../theme/designSystem'
import { MIN_PASSPHRASE } from '../services/BackupService'

const Err = ({ text }) => (text ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{text}</Text> : null)

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
