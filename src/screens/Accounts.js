import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { Q } from '@nozbe/watermelondb'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { accountBalance, cardSpend, utilisation, utilisationLevel, formatMoney } from '../services/Analytics'
import { detectSubscriptions } from '../services/SubscriptionDetector'
import { scheduleSubscriptionReminder, cancelSubscriptionReminder, initNotifications } from '../services/NotificationService'
import { getSettings, updateSettings } from '../services/Settings'
import { createAccount, updateAccount, reconcileAccount, deleteAccount, createCard, updateCard, deleteCard } from '../data/accounts'
import { createSubscription, updateSubscription, deleteSubscription, fetchSubscriptions } from '../data/subscriptions'
import { fetchLiveTransactions } from '../data/transactions'
import { col, toPlain, watch } from '../data/util'
import { Button, Field, EmptyState, SectionTitle, screenStyles } from '../components/ui'
import { AccountForm, CardForm, SubscriptionForm } from '../components/AccountForms'
import { formatDate, parseSignedAmount } from '../utils/format'

const LEVEL_COLOR = { ok: COLORS.emerald, warning: COLORS.amber, critical: COLORS.coral }

const AccountCard = ({ account, balance, onEdit }) => {
  const [input, setInput] = useState('')
  const adjust = () => {
    const value = parseSignedAmount(input)
    if (!Number.isFinite(value)) return Alert.alert('Enter a number', 'Type the balance shown by your bank.')
    Alert.alert('Reconcile balance', `Set ${account.name} to ${formatMoney(value)}? Future transactions will be counted from now.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Update', onPress: async () => { await reconcileAccount(account, value); setInput('') } },
    ])
  }
  return (
    <View style={[GLASS_STYLES.card, styles.card]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{account.name}{account.last4 ? `  ••${account.last4}` : ''}</Text>
        <Text style={styles.link} onPress={onEdit}>Edit</Text>
      </View>
      <Text style={styles.balance}>App balance: {balance < 0 ? '-' : ''}{formatMoney(balance)}</Text>
      <View style={styles.inputRow}>
        <Field placeholder="Actual balance" keyboardType="decimal-pad" value={input} onChangeText={setInput} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Adjust" onPress={adjust} />
      </View>
    </View>
  )
}

const CardTile = ({ card, spend, onEdit }) => {
  const ratio = utilisation(spend, card.limit)
  const level = utilisationLevel(ratio)
  return (
    <View style={[GLASS_STYLES.card, styles.card]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{card.name}{card.last4 ? `  ••${card.last4}` : ''}</Text>
        <Text style={styles.link} onPress={onEdit}>Edit</Text>
      </View>
      <Text style={[styles.balance, level !== 'ok' && { color: LEVEL_COLOR[level] }]}>
        {formatMoney(spend)} / {formatMoney(card.limit)} this cycle{level === 'critical' ? ' · limit almost reached' : ''}
      </Text>
      <View style={styles.progressBar}>
        <View style={{ height: '100%', width: `${Math.round(ratio * 100)}%`, backgroundColor: LEVEL_COLOR[level] }} />
      </View>
    </View>
  )
}

const Accounts = ({ accounts, cards, subscriptions, movements }) => {
  const [accountForm, setAccountForm] = useState(null) // null | {} (new) | model
  const [cardForm, setCardForm] = useState(null)
  const [subForm, setSubForm] = useState(null)
  const [suggestions, setSuggestions] = useState([])

  const { balances, spends, netWorth } = useMemo(() => {
    const txs = movements.map(toPlain)
    const bal = new Map(accounts.map(a => [a.id, accountBalance(toPlain(a), txs)]))
    const sp = new Map(cards.map(c => [c.id, cardSpend(toPlain(c), txs)]))
    const total = [...bal.values()].reduce((s, v) => s + v, 0) - [...sp.values()].reduce((s, v) => s + v, 0)
    return { balances: bal, spends: sp, netWorth: total }
  }, [accounts, cards, movements])

  const [suggestionTick, setSuggestionTick] = useState(0)
  const refreshSuggestions = useCallback(() => setSuggestionTick(t => t + 1), [])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [txs, settings] = await Promise.all([fetchLiveTransactions(), getSettings()])
      const existing = (await fetchSubscriptions()).map(toPlain)
      const found = detectSubscriptions(txs, { existing, dismissed: settings.dismissedSubscriptions })
      if (alive) setSuggestions(found)
    })()
    return () => { alive = false }
  }, [subscriptions.length, suggestionTick])

  const withReminder = async (sub) => {
    if (await initNotifications()) await scheduleSubscriptionReminder(sub)
  }

  const trackSuggestion = async (s) => {
    const sub = await createSubscription({
      name: s.merchant, merchant: s.merchant, amount: s.amount, billing_cycle: s.cycle,
      next_billing_date: s.nextDate, detected_from_tx_id: s.txId,
    })
    await withReminder(sub)
  }

  const dismissSuggestion = async (s) => {
    const settings = await getSettings()
    await updateSettings({ dismissedSubscriptions: [...settings.dismissedSubscriptions, s.key] })
    refreshSuggestions()
  }

  const confirmDelete = (title, onConfirm) =>
    Alert.alert(title, 'This cannot be undone. Your transactions are not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ])

  const saveSub = async (values) => {
    const editing = subForm && subForm.id ? subForm : null
    setSubForm(null)
    if (editing) {
      await updateSubscription(editing, { ...values, merchant: values.name })
      await withReminder(editing)
    } else {
      await withReminder(await createSubscription({ ...values, merchant: values.name }))
    }
  }

  const toggleSub = async (sub) => {
    await updateSubscription(sub, { is_active: !sub.is_active })
    await scheduleSubscriptionReminder(sub)
  }

  return (
    <View style={screenStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={screenStyles.header}>Net worth & reconciliation</Text>
        <Text style={styles.netWorth}>{netWorth < 0 ? '-' : ''}{formatMoney(netWorth)}</Text>
        <Text style={styles.netHint}>Accounts minus credit-card spend this cycle</Text>

        <SectionTitle right={<Text style={styles.link} onPress={() => setAccountForm({})}>+ Add</Text>}>Accounts</SectionTitle>
        {accounts.length === 0
          ? <EmptyState title="No accounts yet" hint="Add your bank account with its current balance. Add the last 4 digits so SMS alerts are matched automatically." />
          : accounts.map(a => <AccountCard key={a.id} account={a} balance={balances.get(a.id) || 0} onEdit={() => setAccountForm(a)} />)}

        <SectionTitle right={<Text style={styles.link} onPress={() => setCardForm({})}>+ Add</Text>}>Credit cards</SectionTitle>
        {cards.length === 0
          ? <EmptyState title="No cards yet" hint="Track limit usage and get alerts at 80% and 95%." />
          : cards.map(c => <CardTile key={c.id} card={c} spend={spends.get(c.id) || 0} onEdit={() => setCardForm(c)} />)}

        <SectionTitle right={<Text style={styles.link} onPress={() => setSubForm({})}>+ Add</Text>}>Subscriptions</SectionTitle>
        {suggestions.map(s => (
          <View key={s.key} style={[GLASS_STYLES.card, styles.card]}>
            <Text style={styles.cardTitle}>{s.merchant} · {formatMoney(s.amount)} {s.cycle.toLowerCase()}</Text>
            <Text style={styles.balance}>Looks like a recurring charge. Track it and get a reminder before it renews?</Text>
            <View style={{ flexDirection: 'row' }}>
              <Button title="Track" onPress={() => trackSuggestion(s)} style={{ marginRight: 8 }} />
              <Button title="Dismiss" variant="ghost" onPress={() => dismissSuggestion(s)} />
            </View>
          </View>
        ))}
        {subscriptions.length === 0 && suggestions.length === 0
          ? <EmptyState title="No subscriptions" hint="Recurring charges are detected automatically, or add one yourself." />
          : subscriptions.map(sub => (
            <View key={sub.id} style={[GLASS_STYLES.card, styles.card, !sub.is_active && { opacity: 0.6 }]}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{sub.name} · {formatMoney(sub.amount)}</Text>
                <Text style={styles.link} onPress={() => setSubForm(sub)}>Edit</Text>
              </View>
              <Text style={styles.balance}>
                {sub.is_active ? `Renews ${formatDate(sub.next_billing_date)} (${sub.billing_cycle.toLowerCase()})` : 'Paused'}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <Button title={sub.is_active ? 'Pause' : 'Resume'} variant="ghost" onPress={() => toggleSub(sub)} />
                <Button title="Delete" variant="ghost" onPress={() => confirmDelete('Delete subscription?', async () => { await cancelSubscriptionReminder(sub); await deleteSubscription(sub) })} />
              </View>
            </View>
          ))}
      </ScrollView>

      <AccountForm visible={!!accountForm} account={accountForm && accountForm.id ? accountForm : null} onClose={() => setAccountForm(null)}
        onDelete={() => { const a = accountForm; setAccountForm(null); confirmDelete('Delete account?', () => deleteAccount(a)) }}
        onSave={async (v) => {
          const editing = accountForm && accountForm.id ? accountForm : null
          setAccountForm(null)
          if (editing) await updateAccount(editing, { name: v.name.trim(), type: v.type, last4: v.last4 })
          else await createAccount(v)
        }} />
      <CardForm visible={!!cardForm} card={cardForm && cardForm.id ? cardForm : null} onClose={() => setCardForm(null)}
        onDelete={() => { const c = cardForm; setCardForm(null); confirmDelete('Delete card?', () => deleteCard(c)) }}
        onSave={async (v) => {
          const editing = cardForm && cardForm.id ? cardForm : null
          setCardForm(null)
          if (editing) await updateCard(editing, { ...v, name: v.name.trim() })
          else await createCard(v)
        }} />
      <SubscriptionForm visible={!!subForm} subscription={subForm && subForm.id ? subForm : null} onClose={() => setSubForm(null)} onSave={saveSub} />
    </View>
  )
}

const styles = StyleSheet.create({
  netWorth: { color: COLORS.emerald, fontSize: 32, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  netHint: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 24 },
  card: { marginBottom: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 6, flexShrink: 1 },
  link: { color: COLORS.emerald, fontWeight: '600' },
  balance: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
})

export default withObservables([], () => ({
  accounts: watch(col('accounts').query()),
  cards: watch(col('credit_cards').query()),
  subscriptions: watch(col('subscriptions').query()),
  movements: watch(col('transactions').query(
    Q.where('is_deleted', false),
    Q.or(Q.where('account_id', Q.notEq(null)), Q.where('card_id', Q.notEq(null)))
  )),
}))(Accounts)
