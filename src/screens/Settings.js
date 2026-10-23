import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { CATEGORY_NAMES } from '../constants/categories'
import { exportTransactionsToCSV, exportTransactionsToJSON, exportGroupBillPdf } from '../services/ExportService'
import { getSettings, updateSettings, resetSettings } from '../services/Settings'
import { hasSmsPermission, requestSmsPermission, openAppSettings } from '../services/Permissions'
import { importHistory, importInboxSince } from '../services/SmsIngest'
import { wipeAllData } from '../data/transactions'
import { monthBounds } from '../services/Analytics'
import { applyRegionSettings, getRegion, currencySymbol } from '../regions'
import RegionPicker from '../components/RegionPicker'
import { col } from '../data/util'
import { clearSalarySource } from '../data/payCycle'
import { formatDateTime, formatDate } from '../utils/format'
import { Button, Chip, Sheet } from '../components/ui'
import { PassphraseSheet } from '../components/SecuritySheets'
import { enableLock, disableLock, authenticate } from '../services/AppLock'
import { createEncryptedBackup, pickBackupFile, restoreEncryptedBackup } from '../services/BackupService'
import MerchantRules from './MerchantRules'
import { useApp } from '../AppContext'

const RANGES = [[30, '30 days'], [90, '90 days'], [180, '6 months'], [365, '1 year']]

const Action = ({ title, onPress, danger }) => (
  <Button title={title} variant={danger ? 'danger' : 'primary'} onPress={onPress} style={styles.action} />
)

export default function Settings() {
  const { access, restartOnboarding, bumpPrefs } = useApp()
  const [settings, setSettings] = useState(null)
  const [smsOk, setSmsOk] = useState(false)
  const [busy, setBusy] = useState(null)
  const [showRules, setShowRules] = useState(false)
  const [showBill, setShowBill] = useState(false)
  const [showRange, setShowRange] = useState(false)
  const [billRange, setBillRange] = useState('MONTH')
  const [billCats, setBillCats] = useState([])
  const [passSheet, setPassSheet] = useState(null) // 'create' | 'restore'
  const [restoreText, setRestoreText] = useState(null)
  const [pickRegion, setPickRegion] = useState(false)
  const [hasData, setHasData] = useState(false)

  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [s, ok, n] = await Promise.all([getSettings(), hasSmsPermission(), col('transactions').query().fetchCount()])
      if (alive) { setSettings(s); setSmsOk(ok); setHasData(n > 0) }
    })()
    return () => { alive = false }
  }, [tick])

  const run = async (label, job) => {
    setBusy(label)
    try { return await job() } catch (e) { console.error(e); Alert.alert('Something went wrong', String(e.message || e)) } finally { setBusy(null); reload() }
  }

  const resync = () => run('Syncing', async () => {
    if (!(await hasSmsPermission()) && (await requestSmsPermission()) !== 'granted') {
      return Alert.alert('SMS access needed', 'Allow SMS access to sync bank messages.', [{ text: 'Open settings', onPress: openAppSettings }, { text: 'Cancel' }])
    }
    const s = await getSettings()
    const r = await importInboxSince(s.onboardingStartDate || Date.now() - 90 * 86400000)
    await updateSettings({ lastAuditAt: Date.now() })
    Alert.alert('Sync complete', `${r.created} new, ${r.merged} matched to your entries.`)
  })

  const changeStart = (days) => {
    setShowRange(false)
    run('Importing', async () => {
      await updateSettings({ onboardingStartDate: Date.now() - days * 86400000 })
      const r = await importHistory()
      Alert.alert('History imported', `${r.created} new transactions found.`)
    })
  }

  const exportBill = () => run('Exporting', async () => {
    const now = new Date()
    const { start: monthStart, end: monthEnd } = monthBounds(now.getFullYear(), now.getMonth())
    const range = billRange === 'MONTH' ? { start: monthStart, end: monthEnd, label: 'This month' }
      : billRange === '30D' ? { start: Date.now() - 30 * 86400000, end: Date.now() + 1, label: 'Last 30 days' }
      : { start: 0, end: Date.now() + 1, label: 'All time' }
    const res = await exportGroupBillPdf({
      start: range.start, end: range.end, categories: billCats.length ? billCats : null, rangeLabel: range.label,
    })
    setShowBill(false)
    if (!res.count) Alert.alert('Nothing to export', 'No expenses match that range and those categories.')
  })

  const wipe = async () => {
    if (settings && settings.lockEnabled) {
      const r = await authenticate('Confirm to delete all data')
      if (!r.ok && !r.unenforceable) return
    }
    Alert.alert('Delete all data?', 'Every transaction, account, card, rule and subscription on this device will be erased.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue', style: 'destructive', onPress: () =>
          Alert.alert('Are you absolutely sure?', 'This cannot be undone. Export your data first if you may need it.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete everything', style: 'destructive', onPress: () => run('Deleting', async () => { await wipeAllData(); await resetSettings(); await restartOnboarding() }) },
          ]),
      },
    ])
  }

  const toggle = async (key, value) => {
    setSettings(await updateSettings({ [key]: value }))
  }

  const toggleLock = async (on) => {
    if (on) {
      const r = await enableLock()
      if (r === 'no_device_lock') {
        Alert.alert('Set a screen lock first', "Outspend uses your phone's own screen lock. Set a PIN, pattern, password or fingerprint in your phone's Settings, then turn this on.")
      }
    } else if (!(await disableLock())) {
      Alert.alert('Still locked', 'Confirm with your phone lock to turn the app lock off.')
    }
    reload()
  }

  const applyPrefs = async (patch) => {
    const next = await updateSettings(patch)
    applyRegionSettings({ region: next.region || getRegion().id, currency: next.currency, numberStyle: next.numberStyle })
    setSettings(next)
    bumpPrefs()
  }
  const changeNumberStyle = (style) => applyPrefs({ numberStyle: style })
  const changeRegion = async (id, currency) => {
    setPickRegion(false)
    await applyPrefs({ region: id, currency })
  }

  const startRestore = () =>
    Alert.alert('Restore from backup?', 'This replaces everything currently in the app with the backup.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose file', onPress: async () => {
          try {
            const text = await pickBackupFile()
            if (text) { setRestoreText(text); setPassSheet('restore') }
          } catch { Alert.alert('Could not read that file', 'Pick the .outspend backup file.') }
        } },
    ])

  const subscription = access.status === 'subscribed' ? 'Subscribed'
    : access.status === 'trial' ? `Free trial (${access.trialDaysLeft} day${access.trialDaysLeft === 1 ? '' : 's'} left)`
    : 'Trial ended'

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.header}>Privacy & controls</Text>

        <View style={[GLASS_STYLES.card, styles.card]}>
          <Text style={styles.rowText}>Plan: {subscription}</Text>
          <Text style={styles.hint}>SMS access: {smsOk ? 'allowed' : 'not allowed'}{!smsOk ? '  (tap Sync to grant)' : ''}</Text>
          <Text style={styles.hint}>Last daily audit: {settings && settings.lastAuditAt ? formatDateTime(settings.lastAuditAt) : 'never'}</Text>
          <Text style={styles.hint}>History starts: {settings && settings.onboardingStartDate ? formatDate(settings.onboardingStartDate) : 'not set'}</Text>
        </View>

        {busy ? <View style={styles.busy}><ActivityIndicator color={COLORS.emerald} /><Text style={styles.hint}>  {busy}…</Text></View> : null}

        <Text style={styles.section}>Data</Text>
        <Action title="Sync SMS now" onPress={resync} />
        <Action title="Change history start date" onPress={() => setShowRange(true)} />
        <Action title="Manage merchant rules" onPress={() => setShowRules(true)} />

        <View style={[GLASS_STYLES.card, styles.card, { marginTop: 8 }]}>
          <Text style={styles.rowText}>Pay cycle</Text>
          {settings && settings.salarySource ? (
            <>
              <Text style={styles.hint}>Spending periods start on the day your salary from {settings.salarySource.merchant} arrives, so income and spending line up.</Text>
              <Button title="Go back to calendar months" variant="ghost" style={{ alignSelf: 'flex-start', marginTop: 4 }}
                onPress={async () => { await clearSalarySource(); reload(); bumpPrefs() }} />
            </>
          ) : (
            <>
              <Text style={styles.hint}>Using calendar months. When a recurring salary is detected, the Home tab asks you to confirm it.</Text>
              {settings && (settings.salaryDismissed || []).length > 0 ? (
                <Button title="Ask me about salary again" variant="ghost" style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  onPress={async () => { await updateSettings({ salaryDismissed: [] }); reload(); bumpPrefs() }} />
              ) : null}
            </>
          )}
        </View>

        <Text style={styles.section}>Export</Text>
        <Action title="Export data to CSV" onPress={() => run('Exporting', exportTransactionsToCSV)} />
        <Action title="Export data to JSON" onPress={() => run('Exporting', exportTransactionsToJSON)} />
        <Action title="Export group bill (PDF)" onPress={() => setShowBill(true)} />

        <Text style={styles.section}>Security</Text>
        <View style={[GLASS_STYLES.card, styles.card]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.rowText}>Lock the app</Text>
              <Text style={styles.hint}>Uses your phone&apos;s fingerprint, face or screen lock (PIN, pattern, password). Nothing new to remember. Asked when you open the app or return after 30 seconds.</Text>
            </View>
            <Switch value={!!(settings && settings.lockEnabled)} onValueChange={toggleLock} trackColor={{ true: COLORS.emerald }} />
          </View>
        </View>

        <Text style={styles.section}>Alerts</Text>
        <View style={[GLASS_STYLES.card, styles.card]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.rowText}>Unusual spend and duplicate charges</Text>
              <Text style={styles.hint}>A notification when a payment is far above normal, or charged twice.</Text>
            </View>
            <Switch value={!settings || settings.alertsAnomaly !== false} onValueChange={(v) => toggle('alertsAnomaly', v)} trackColor={{ true: COLORS.emerald }} />
          </View>
          <View style={[styles.switchRow, { marginTop: 12 }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.rowText}>Budget alerts</Text>
              <Text style={styles.hint}>At 80% and 100% of a monthly budget.</Text>
            </View>
            <Switch value={!settings || settings.alertsBudget !== false} onValueChange={(v) => toggle('alertsBudget', v)} trackColor={{ true: COLORS.emerald }} />
          </View>
        </View>

        <Text style={styles.section}>Country & display</Text>
        <View style={[GLASS_STYLES.card, styles.card]}>
          <Text style={styles.rowText}>{getRegion().name} · {currencySymbol(getRegion().currency)} {getRegion().currency}</Text>
          <Text style={styles.hint}>Sets your currency, date format and how bank messages are read.</Text>
          <Button title="Change country or currency" variant="ghost" onPress={() => setPickRegion(true)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          <Text style={[styles.rowText, { marginTop: 12 }]}>Number format</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            <Chip label="Follow country" selected={!settings || !settings.numberStyle || settings.numberStyle === 'AUTO'} onPress={() => changeNumberStyle('AUTO')} />
            <Chip label="12,34,567 (lakh)" selected={!!settings && settings.numberStyle === 'IN'} onPress={() => changeNumberStyle('IN')} />
            <Chip label="1,234,567" selected={!!settings && settings.numberStyle === 'INTL'} onPress={() => changeNumberStyle('INTL')} />
          </View>
        </View>

        <Text style={styles.section}>Backup</Text>
        <Text style={[styles.hint, { marginBottom: 8 }]}>Cloud backup is off to keep your data private. Save an encrypted copy yourself before changing phones.</Text>
        <Action title="Create encrypted backup" onPress={() => setPassSheet('create')} />
        <Action title="Restore from backup" onPress={startRestore} />

        <Text style={styles.section}>Danger zone</Text>
        <Action title="Delete all data" danger onPress={wipe} />
      </ScrollView>

      <Sheet visible={showRange} onClose={() => setShowRange(false)} title="Import how far back?">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {RANGES.map(([d, l]) => <Chip key={d} label={l} onPress={() => changeStart(d)} />)}
        </View>
        <Text style={styles.hint}>Messages already imported are never duplicated.</Text>
      </Sheet>

      <Sheet visible={showBill} onClose={() => setShowBill(false)} title="Group bill (PDF)">
        <Text style={styles.hint}>Period</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {[['MONTH', 'This month'], ['30D', 'Last 30 days'], ['ALL', 'All time']].map(([k, l]) => (
            <Chip key={k} label={l} selected={billRange === k} onPress={() => setBillRange(k)} color={COLORS.blue} />
          ))}
        </View>
        <Text style={styles.hint}>Categories (none selected = all)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {[...CATEGORY_NAMES, 'Uncategorized'].map(c => (
            <Chip key={c} label={c} selected={billCats.includes(c)} onPress={() => setBillCats(billCats.includes(c) ? billCats.filter(x => x !== c) : [...billCats, c])} />
          ))}
        </View>
        <Button title="Create PDF" onPress={exportBill} />
      </Sheet>

      <RegionPicker visible={pickRegion} title="Country & currency" initialRegion={getRegion().id} initialCurrency={getRegion().currency}
        warning={hasData ? 'Existing amounts keep their numbers and will be shown in the new currency; nothing is converted. Messages in another currency stay out of your totals.' : null}
        onClose={() => setPickRegion(false)} onSave={changeRegion} />
      {passSheet === 'create' ? (
        <PassphraseSheet mode="create" onClose={() => setPassSheet(null)}
          onSubmit={async (pass) => { const c = await createEncryptedBackup(pass); setPassSheet(null); Alert.alert('Backup created', `${c.transactions} transactions saved. Keep the file and your passphrase safe.`) }} />
      ) : null}
      {passSheet === 'restore' ? (
        <PassphraseSheet mode="restore" onClose={() => { setPassSheet(null); setRestoreText(null) }}
          onSubmit={async (pass) => {
            const c = await restoreEncryptedBackup(restoreText, pass)
            setPassSheet(null); setRestoreText(null); reload(); bumpPrefs()
            Alert.alert('Backup restored', `${c.transactions} transactions, ${c.accounts} accounts and your budgets, goals and rules are back.`)
          }} />
      ) : null}

      {showRules ? <MerchantRules onClose={() => setShowRules(false)} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  header: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', marginBottom: 24, marginTop: 40 },
  section: { color: COLORS.textSecondary, fontSize: 13, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  card: { marginBottom: 8 },
  rowText: { color: COLORS.textPrimary, marginBottom: 6 },
  hint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  action: { marginBottom: 8 },
  busy: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
