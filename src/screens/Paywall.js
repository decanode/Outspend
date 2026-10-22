import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { exportTransactionsToCSV } from '../services/ExportService'
import { loadOffer, subscribe, restore, startPurchaseListeners } from '../services/BillingService'
import { Button } from '../components/ui'
import { useApp } from '../AppContext'

export default function Paywall() {
  const { refreshAccess } = useApp()
  const [offer, setOffer] = useState({ price: null, offerToken: null })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadOffer().then(setOffer)
    return startPurchaseListeners({
      onPurchased: async () => { setBusy(false); await refreshAccess() },
      onError: (err) => { setBusy(false); Alert.alert('Purchase failed', (err && err.message) || 'Please try again.') },
    })
  }, [refreshAccess])

  const handleSubscribe = async () => {
    setBusy(true)
    try {
      await subscribe(offer.offerToken)
      // The result arrives through the purchase listener.
    } catch (err) {
      setBusy(false)
      Alert.alert('Could not start purchase', (err && err.message) || 'Please try again.')
    }
  }

  const handleRestore = async () => {
    setBusy(true)
    try {
      const access = await restore()
      if (!access.hasAccess || access.status !== 'subscribed') Alert.alert('Nothing to restore', 'No active subscription was found for this Google account.')
      await refreshAccess()
    } catch {
      Alert.alert('Restore failed', 'Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    try {
      await exportTransactionsToCSV()
    } catch {
      Alert.alert('Error', 'Could not export data.')
    }
  }

  return (
    <View style={styles.container}>
      <View style={[GLASS_STYLES.card, styles.card]}>
        <Text style={styles.title}>Total financial clarity.{'\n'}Zero data tracking.</Text>
        <Text style={styles.subtitle}>
          Your trial has ended. To keep your data strictly on your device, subscribe{offer.price ? ` for ${offer.price}` : ''}.
        </Text>
        {busy ? <ActivityIndicator color={COLORS.emerald} style={{ marginBottom: 16 }} /> : null}
        <Button title="Subscribe via Google Play" onPress={handleSubscribe} disabled={busy} style={styles.full} />
        <Button title="Restore purchase" variant="ghost" onPress={handleRestore} disabled={busy} style={styles.full} />
        <Button title="Export data & exit" variant="ghost" onPress={handleExport} style={styles.full} />
        <Text style={styles.note}>Your data stays on this device and is never deleted if you do not subscribe.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { padding: 32, alignItems: 'center', width: '100%' },
  title: { color: COLORS.emerald, fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  subtitle: { color: COLORS.textPrimary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  full: { width: '100%', marginBottom: 8 },
  note: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 8 },
})
