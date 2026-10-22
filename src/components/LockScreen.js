import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../theme/designSystem'
import { verifyPin, unlockWithBiometrics } from '../services/AppLock'
import { getSettings } from '../services/Settings'
import { PIN_MAX, PIN_MIN } from '../services/PinLogic'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del']

/** Full-screen PIN pad shown over the app while it is locked. */
export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [bio, setBio] = useState(false)
  const [countdown, setCountdown] = useState(0) // seconds until the next try is allowed

  const tryBiometrics = useCallback(async () => {
    if (await unlockWithBiometrics()) onUnlock()
  }, [onUnlock])

  useEffect(() => {
    let alive = true
    getSettings().then(s => {
      if (!alive) return
      setBio(!!s.lockBiometric)
      if (s.lockBiometric) tryBiometrics()
    })
    return () => { alive = false }
  }, [tryBiometrics])

  useEffect(() => {
    if (countdown <= 0) return undefined
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const submit = async (value) => {
    setBusy(true)
    const r = await verifyPin(value)
    setBusy(false)
    setPin('')
    if (r.ok) return onUnlock()
    if (r.retryInMs > 0) {
      setCountdown(Math.ceil(r.retryInMs / 1000))
      setMessage('Too many wrong tries.')
    } else {
      setMessage('Wrong PIN')
    }
  }

  const press = (k) => {
    if (busy || countdown > 0) return
    setMessage('')
    if (k === 'del') return setPin(pin.slice(0, -1))
    if (k === 'bio') return tryBiometrics()
    const next = pin + k
    setPin(next)
    // The PIN length is not stored, so confirm when the user stops at 4-6 digits via the check button.
    if (next.length === PIN_MAX) submit(next)
  }

  const seconds = countdown
  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={36} color={COLORS.emerald} />
      <Text style={styles.title}>Outspend is locked</Text>
      <View style={styles.dots}>
        {Array.from({ length: PIN_MAX }).map((_, i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.message}>{seconds > 0 ? `Try again in ${seconds}s` : message || ' '}</Text>
      <View style={styles.pad}>
        {KEYS.map(k => (
          <TouchableOpacity key={k} style={styles.key} onPress={() => press(k)} disabled={k === 'bio' && !bio}>
            {k === 'del' ? <Ionicons name="backspace-outline" size={24} color={COLORS.textPrimary} />
              : k === 'bio' ? (bio ? <Ionicons name="finger-print" size={28} color={COLORS.emerald} /> : null)
              : <Text style={styles.keyText}>{k}</Text>}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[styles.go, pin.length < PIN_MIN && { opacity: 0.3 }]} disabled={pin.length < PIN_MIN || busy} onPress={() => submit(pin)}>
        <Text style={styles.goText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 12, marginBottom: 20 },
  dots: { flexDirection: 'row', marginBottom: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: COLORS.textSecondary, marginHorizontal: 6 },
  dotOn: { backgroundColor: COLORS.emerald, borderColor: COLORS.emerald },
  message: { color: COLORS.coral, height: 20, marginBottom: 12 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 252 },
  key: { width: 72, height: 72, margin: 6, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardFill },
  keyText: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '500' },
  go: { marginTop: 16, backgroundColor: COLORS.emerald, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10 },
  goText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
