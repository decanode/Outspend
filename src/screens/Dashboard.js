import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Alert } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { Q } from '@nozbe/watermelondb'
import { BarChart } from 'react-native-gifted-charts'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { VoiceService } from '../services/VoiceService'
import { parseVoiceExpense } from '../services/VoiceParser'
import { aggregateSpend, accountBalance, dailySpend, monthBounds, formatINR } from '../services/Analytics'
import { keywordCategory, suggestPattern } from '../services/RuleEngine'
import { observeNeedsReview, observeRecentTransactions, createTransaction, updateTransaction } from '../data/transactions'
import { createRule } from '../data/rules'
import { toPlain, col } from '../data/util'
import { Field, Button, Chip, EmptyState, SectionTitle, screenStyles } from '../components/ui'
import CategoryPicker from '../components/CategoryPicker'
import TransactionForm from '../components/TransactionForm'
import TransactionDetail from '../components/TransactionDetail'
import useDeleteWithUndo from '../components/useDeleteWithUndo'
import { formatDate } from '../utils/format'

const NeedsAttentionCard = ({ transaction: tx }) => {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(null)
  const [picking, setPicking] = useState(false)

  const save = async () => {
    const merchant = name.trim()
    if (!merchant) return Alert.alert('Enter a name', 'Who was this payment to?')
    const cat = category || keywordCategory(merchant)
    const pattern = suggestPattern(tx)
    if (pattern) {
      const { updated } = await createRule({ pattern, mapped_merchant: merchant, category: cat })
      if (updated > 1) Alert.alert('Rule saved', `${updated} matching transactions updated.`)
    } else {
      await updateTransaction(tx, { merchant, category: cat, needs_review: false })
    }
  }

  const mode = tx.payment_mode ? ` via ${tx.payment_mode}` : ''
  const verb = tx.type === 'CREDIT' || tx.type === 'REFUND' ? 'received' : 'paid'
  return (
    <View style={[GLASS_STYLES.card, styles.carouselCard]}>
      <Text style={styles.carouselText}>{formatINR(tx.amount)} {verb}{mode}. Who was this {verb === 'paid' ? 'to' : 'from'}?</Text>
      {tx.raw_text ? <Text style={styles.snippet} numberOfLines={2}>{tx.raw_text}</Text> : null}
      <Field placeholder="Merchant name" value={name} onChangeText={setName} style={{ marginBottom: 8 }} />
      <Chip label={category || 'Category (optional)'} selected={!!category} onPress={() => setPicking(true)} />
      <View style={{ flexDirection: 'row' }}>
        <Button title="Save rule" onPress={save} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Dismiss" variant="ghost" onPress={() => updateTransaction(tx, { needs_review: false })} />
      </View>
      <CategoryPicker visible={picking} onClose={() => setPicking(false)} offerApplyAll={false}
        current={category} onSelect={(c) => { setCategory(c); setPicking(false) }} />
    </View>
  )
}

const Dashboard = ({ accounts, balanceTxs, windowTxs, needsReview, recent }) => {
  const [listening, setListening] = useState(false)
  const [voiceDraft, setVoiceDraft] = useState(null)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState(null)
  const [requestDelete, undoBar] = useDeleteWithUndo()
  const voice = useRef(null)

  useEffect(() => {
    const service = new VoiceService({
      onResult: (text) => setVoiceDraft({ ...parseVoiceExpense(text), raw_text: text, source: 'VOICE' }),
      onEnd: () => setListening(false),
      onError: (code) => {
        setListening(false)
        if (code === 'not-allowed') Alert.alert('Microphone needed', 'Allow microphone access to log expenses by voice.')
        else if (code !== 'aborted' && code !== 'no-speech') Alert.alert('Voice input failed', `Please try again (${code}).`)
      },
    })
    voice.current = service
    return () => service.destroy()
  }, [])

  const toggleVoice = async () => {
    if (listening) return voice.current.stop()
    setListening(true)
    const started = await voice.current.start()
    if (!started) setListening(false)
  }

  const saveEntry = async (values, source) => {
    await createTransaction({ ...values, source, raw_text: voiceDraft && voiceDraft.raw_text })
    setVoiceDraft(null)
    setAdding(false)
  }

  const { balance, hasAccounts, monthSpend, week } = useMemo(() => {
    const now = new Date()
    const { start, end } = monthBounds(now.getFullYear(), now.getMonth())
    const accs = accounts.map(toPlain)
    const bTx = balanceTxs.map(toPlain)
    const wTx = windowTxs.map(toPlain)
    return {
      hasAccounts: accs.length > 0,
      balance: accs.reduce((sum, a) => sum + accountBalance(a, bTx), 0),
      monthSpend: aggregateSpend(wTx, start, end).total,
      week: dailySpend(wTx),
    }
  }, [accounts, balanceTxs, windowTxs])

  const chartData = week.map(d => ({ value: d.amount, label: d.label, frontColor: COLORS.emerald }))

  return (
    <View style={screenStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={styles.header}>
          <Text style={styles.balanceLabel}>{hasAccounts ? 'Current balance' : 'Balance'}</Text>
          {hasAccounts ? (
            <Text style={[styles.balanceValue, balance < 0 && { color: COLORS.coral }]}>{balance < 0 ? '-' : ''}{formatINR(balance)}</Text>
          ) : (
            <Text style={styles.noAccounts}>Add an account in the Accounts tab to see your balance.</Text>
          )}
          <Text style={styles.monthSpend}>Spent this month: {formatINR(monthSpend)}</Text>
        </View>

        {needsReview.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Needs attention</SectionTitle>
            <FlatList
              horizontal
              data={needsReview}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <NeedsAttentionCard transaction={item} />}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle>Last 7 days</SectionTitle>
          <View style={[GLASS_STYLES.card, { paddingHorizontal: 8 }]}>
            <BarChart
              data={chartData}
              barWidth={22}
              spacing={14}
              roundedTop
              hideRules
              noOfSections={3}
              yAxisThickness={0}
              xAxisThickness={0}
              yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: COLORS.textSecondary, fontSize: 11 }}
              height={110}
              isAnimated={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle>Recent activity</SectionTitle>
          {recent.length === 0 ? (
            <EmptyState title="No transactions yet" hint="Bank SMS are picked up automatically. You can also add one with the + button or your voice." />
          ) : recent.map(item => (
            <TouchableOpacity key={item.id} onPress={() => setSelected(item)} style={[GLASS_STYLES.card, styles.transactionCard]}>
              <View style={{ flex: 1 }}>
                <Text style={screenStyles.rowTitle}>{item.merchant}</Text>
                <Text style={screenStyles.rowSub}>{formatDate(item.timestamp)}{item.category ? ` · ${item.category}` : ''}</Text>
              </View>
              <Text style={[screenStyles.amount, { color: item.type === 'DEBIT' ? COLORS.coral : COLORS.emerald }]}>
                {item.type === 'DEBIT' ? '-' : '+'}{formatINR(item.amount)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={[screenStyles.fab, { bottom: 92, backgroundColor: COLORS.blue }]} onPress={() => setAdding(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={[screenStyles.fab, { bottom: 24 }, listening && { backgroundColor: COLORS.coral }]} onPress={toggleVoice}>
        <Ionicons name={listening ? 'stop' : 'mic'} size={24} color="#fff" />
      </TouchableOpacity>
      {listening ? <Text style={styles.listening}>Listening… say e.g. “spent 250 on coffee at Starbucks”</Text> : null}

      <TransactionForm visible={adding} onClose={() => setAdding(false)} onSave={(v) => saveEntry(v, 'MANUAL')} />
      <TransactionForm visible={!!voiceDraft} onClose={() => setVoiceDraft(null)} onSave={(v) => saveEntry(v, 'VOICE')}
        initial={voiceDraft || {}} title="Confirm voice entry" />
      {selected ? <TransactionDetail transaction={selected} onClose={() => setSelected(null)} onDelete={requestDelete} /> : null}
      {undoBar}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { marginBottom: 24, marginTop: 40 },
  balanceLabel: { color: COLORS.textSecondary, fontSize: 16, marginBottom: 8 },
  balanceValue: { color: COLORS.emerald, fontSize: 36, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  noAccounts: { color: COLORS.textPrimary, fontSize: 14 },
  monthSpend: { color: COLORS.textSecondary, marginTop: 8 },
  section: { marginBottom: 24 },
  carouselCard: { width: 290, marginRight: 12 },
  carouselText: { color: COLORS.textPrimary, marginBottom: 8 },
  snippet: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 10 },
  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listening: { position: 'absolute', right: 90, bottom: 40, color: COLORS.textSecondary, maxWidth: 220, textAlign: 'right', fontSize: 12 },
})

// Collections are queried with a rolling window so the screen stays fast on large histories.
const enhance = withObservables([], () => {
  const now = new Date()
  const monthStart = monthBounds(now.getFullYear(), now.getMonth()).start
  const windowStart = Math.min(monthStart, Date.now() - 8 * 86400000)
  const live = Q.where('is_deleted', false)
  return {
    accounts: col('accounts').query(),
    balanceTxs: col('transactions').query(live, Q.where('account_id', Q.notEq(null))),
    windowTxs: col('transactions').query(live, Q.where('timestamp', Q.gte(windowStart))),
    needsReview: observeNeedsReview(),
    recent: observeRecentTransactions(5),
  }
})

export default enhance(Dashboard)
