import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../theme/designSystem'
import { Button } from './ui'
import { authenticate } from '../services/AppLock'

/** Shown while the app is locked. The system prompt does the checking (fingerprint, face, or the phone's PIN/pattern). */
export default function LockScreen({ onUnlock }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const handle = useCallback((r) => {
    setBusy(false)
    if (r.ok || r.unenforceable) return onUnlock() // no screen lock on this phone: nothing to enforce
    if (r.error !== 'user_cancel' && r.error !== 'system_cancel' && r.error !== 'app_cancel') setMessage('Could not verify it is you. Try again.')
  }, [onUnlock])

  const unlock = () => {
    setBusy(true)
    setMessage('')
    authenticate('Unlock Outspend').then(handle)
  }

  // Ask straight away when the lock screen appears.
  useEffect(() => {
    authenticate('Unlock Outspend').then(handle)
  }, [handle])

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={44} color={COLORS.emerald} />
      <Text style={styles.title}>Outspend is locked</Text>
      <Text style={styles.sub}>Use your fingerprint, face, or your phone&apos;s screen lock.</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button title="Unlock" onPress={unlock} disabled={busy} style={styles.button} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 16 },
  sub: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  message: { color: COLORS.coral, marginBottom: 16 },
  button: { width: 200 },
})
