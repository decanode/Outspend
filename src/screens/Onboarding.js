import React, { useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { Button, Chip } from '../components/ui'
import { requestSmsPermission, openAppSettings } from '../services/Permissions'
import { initNotifications } from '../services/NotificationService'
import { updateSettings, DEFAULT_IMPORT_DAYS } from '../services/Settings'
import { importHistory } from '../services/SmsIngest'
import { ensureTrialStarted } from '../services/BillingService'
import { pickBackupFile, restoreEncryptedBackup } from '../services/BackupService'
import { PassphraseSheet } from '../components/SecuritySheets'
import RegionPicker from '../components/RegionPicker'
import HowToCapture from './HowToCapture'
import { SHORTCUT_URL } from '../config'
import { applyRegionSettings, getRegion, regionById, currencySymbol } from '../regions'

const RANGES = [[30, '30 days'], [90, '90 days'], [180, '6 months'], [365, '1 year']]

// Gmail receipt sync is deferred, so onboarding has three steps for now.
export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1)
  const [smsStatus, setSmsStatus] = useState(null) // granted | denied | blocked
  const [days, setDays] = useState(DEFAULT_IMPORT_DAYS)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [restoreText, setRestoreText] = useState(null)
  const [pickRegion, setPickRegion] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [region, setRegionState] = useState(() => getRegion())

  const askSms = async () => {
    const status = await requestSmsPermission()
    setSmsStatus(status)
    await initNotifications().catch(() => {}) // best effort; reminders are optional
    if (status === 'granted') setStep(3)
  }

  const finish = async () => {
    setImporting(true)
    const startDate = Date.now() - days * 86400000
    await updateSettings({ onboardingStartDate: startDate, isOnboarded: true, region: region.id, currency: region.customCurrency ? region.currency : null })
    await ensureTrialStarted()
    try {
      await importHistory({ onProgress: setProgress })
    } catch (e) {
      console.error('History import failed', e) // user can re-run from Settings
    }
    onComplete()
  }

  if (importing) {
    return (
      <View style={styles.container}>
        <View style={[GLASS_STYLES.card, styles.card]}>
          <ActivityIndicator size="large" color={COLORS.emerald} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Reading your bank messages…</Text>
          <Text style={styles.subtitle}>
            {progress ? `${progress.created} transactions found from ${progress.scanned} messages` : 'This only takes a moment.'}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[GLASS_STYLES.card, styles.card]}>
        {step === 1 && (
          <>
            <Text style={styles.title}>100% private.</Text>
            <Text style={styles.subtitle}>Outspend never sends your data to any server. All processing happens right here on your phone.</Text>
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>
              Country: {region.name} ({currencySymbol(region.currency)} {region.currency})
            </Text>
            <Button title="Change country or currency" variant="ghost" onPress={() => setPickRegion(true)} style={styles.full} />
            <Button title="Next" onPress={() => setStep(2)} style={styles.full} />
            <Button title="Restore from a backup" variant="ghost" style={styles.full}
              onPress={async () => { try { const t = await pickBackupFile(); if (t) setRestoreText(t) } catch { /* picker cancelled or unreadable */ } }} />
          </>
        )}
        {step === 2 && Platform.OS === 'ios' && (
          <>
            <Text style={styles.title}>Add bank messages</Text>
            <Text style={styles.subtitle}>
              iPhone does not let any app read your messages. Instead, you share a bank message to Outspend with one tap and it is added. Nothing leaves your phone.
            </Text>
            <Button title="Show me how" onPress={() => setShowHelp(true)} style={styles.full} />
            {SHORTCUT_URL ? <Button title="Install the shortcut" variant="ghost" onPress={() => Linking.openURL(SHORTCUT_URL)} style={styles.full} /> : null}
            <Button title="Next" onPress={async () => { await initNotifications().catch(() => {}); setStep(3) }} style={styles.full} />
          </>
        )}
        {step === 2 && Platform.OS !== 'ios' && (
          <>
            <Text style={styles.title}>Read SMS</Text>
            <Text style={styles.subtitle}>
              Outspend reads bank and UPI alerts to log your expenses automatically. Personal conversations are ignored, and nothing leaves your device.
            </Text>
            {smsStatus && smsStatus !== 'granted' ? (
              <Text style={styles.warn}>
                {smsStatus === 'blocked'
                  ? 'SMS access is blocked. Enable it in app settings to log expenses automatically.'
                  : 'Without SMS access, you will need to add expenses by hand.'}
              </Text>
            ) : null}
            <Button title="Allow SMS access" onPress={askSms} style={styles.full} />
            {smsStatus === 'blocked' ? <Button title="Open app settings" variant="ghost" onPress={openAppSettings} style={styles.full} /> : null}
            <Button title="Skip for now" variant="ghost" onPress={() => setStep(3)} style={styles.full} />
          </>
        )}
        {step === 3 && Platform.OS === 'ios' && (
          <>
            <Text style={styles.title}>You are set</Text>
            <Text style={styles.subtitle}>Share your first bank message to see it appear. You can also add expenses by hand or by voice.</Text>
            <Button title="Let's go" onPress={finish} style={styles.full} />
          </>
        )}
        {step === 3 && Platform.OS !== 'ios' && (
          <>
            <Text style={styles.title}>When to start?</Text>
            <Text style={styles.subtitle}>Choose how far back to read your transaction history. You can change this later in Settings.</Text>
            <View style={styles.chips}>
              {RANGES.map(([d, label]) => <Chip key={d} label={label} selected={days === d} onPress={() => setDays(d)} />)}
            </View>
            <Button title="Let's go" onPress={finish} style={styles.full} />
          </>
        )}
      </View>
      {showHelp ? <HowToCapture onClose={() => setShowHelp(false)} /> : null}
      <RegionPicker visible={pickRegion} initialRegion={region.id} initialCurrency={region.currency} onClose={() => setPickRegion(false)}
        onSave={async (id, currency) => {
          const next = applyRegionSettings({ region: id, currency, numberStyle: 'AUTO' })
          await updateSettings({ region: id, currency, numberStyle: 'AUTO' })
          setRegionState(next)
          setDays(regionById(id).importDays)
          setPickRegion(false)
        }} />
      {restoreText ? (
        <PassphraseSheet mode="restore" onClose={() => setRestoreText(null)}
          onSubmit={async (pass) => { await restoreEncryptedBackup(restoreText, pass); await ensureTrialStarted(); onComplete() }} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { padding: 32, alignItems: 'center', width: '100%' },
  title: { color: COLORS.emerald, fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  subtitle: { color: COLORS.textPrimary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  warn: { color: COLORS.amber, textAlign: 'center', marginBottom: 16, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 },
  full: { width: '100%', marginBottom: 8 },
})
