import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Sheet, Field, Button, Chip } from './ui'
import { currencySymbolFor } from '../regions'
import { COLORS } from '../theme/designSystem'
import { parseAmount, parseSignedAmount, parseDateInput, toDateInput } from '../utils/format'

const ACCOUNT_TYPES = [['SAVINGS', 'Savings'], ['WALLET', 'Wallet'], ['CASH', 'Cash']]

const validLast4 = (v) => !v || /^\d{4}$/.test(v)

export const AccountForm = (props) => (props.visible ? <AccountFormBody {...props} /> : null)

function AccountFormBody({ visible, onClose, onSave, onDelete, account }) {
  const [name, setName] = useState(account ? account.name : '')
  const [type, setType] = useState(account ? account.type : 'SAVINGS')
  const [balance, setBalance] = useState(account ? String(account.balance) : '')
  const [last4, setLast4] = useState(account && account.last4 ? account.last4 : '')
  const [error, setError] = useState('')

  const submit = () => {
    if (!name.trim()) return setError('Give the account a name.')
    const bal = balance.trim() === '' ? 0 : parseSignedAmount(balance)
    if (!Number.isFinite(bal)) return setError('Balance must be a number.')
    if (!validLast4(last4)) return setError('Last 4 digits must be exactly 4 numbers.')
    onSave({ name, type, balance: bal, last4: last4 || null })
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={account ? 'Edit account' : 'Add account'}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="HDFC Savings" style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {ACCOUNT_TYPES.map(([k, l]) => <Chip key={k} label={l} selected={type === k} onPress={() => setType(k)} />)}
      </View>
      {!account && <Field label={`Opening balance (${currencySymbolFor()})`} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0" style={{ marginBottom: 12 }} />}
      <Field label="Last 4 digits (matches bank SMS to this account)" value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} style={{ marginBottom: 12 }} />
      {error ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{error}</Text> : null}
      <Button title="Save" onPress={submit} />
      {account && onDelete ? <Button title="Delete account" variant="danger" onPress={onDelete} style={{ marginTop: 8 }} /> : null}
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}

export const CardForm = (props) => (props.visible ? <CardFormBody {...props} /> : null)

function CardFormBody({ visible, onClose, onSave, onDelete, card }) {
  const [name, setName] = useState(card ? card.name : '')
  const [limit, setLimit] = useState(card ? String(card.limit) : '')
  const [last4, setLast4] = useState(card && card.last4 ? card.last4 : '')
  const [day, setDay] = useState(card && card.billing_day ? String(card.billing_day) : '1')
  const [error, setError] = useState('')

  const submit = () => {
    const lim = parseAmount(limit)
    const d = parseInt(day, 10)
    if (!name.trim()) return setError('Give the card a name.')
    if (!lim) return setError('Enter the credit limit.')
    if (!(d >= 1 && d <= 28)) return setError('Billing day must be between 1 and 28.')
    if (!validLast4(last4)) return setError('Last 4 digits must be exactly 4 numbers.')
    onSave({ name, limit: lim, last4: last4 || null, billing_day: d })
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={card ? 'Edit card' : 'Add credit card'}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="SBI Cashback" style={{ marginBottom: 12 }} />
      <Field label={`Credit limit (${currencySymbolFor()})`} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" style={{ marginBottom: 12 }} />
      <Field label="Last 4 digits" value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} style={{ marginBottom: 12 }} />
      <Field label="Billing cycle starts on day (1-28)" value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} style={{ marginBottom: 12 }} />
      {error ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{error}</Text> : null}
      <Button title="Save" onPress={submit} />
      {card && onDelete ? <Button title="Delete card" variant="danger" onPress={onDelete} style={{ marginTop: 8 }} /> : null}
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}

export const SubscriptionForm = (props) => (props.visible ? <SubscriptionFormBody {...props} /> : null)

function SubscriptionFormBody({ visible, onClose, onSave, subscription }) {
  const [name, setName] = useState(subscription ? subscription.name : '')
  const [amount, setAmount] = useState(subscription ? String(subscription.amount) : '')
  const [cycle, setCycle] = useState(subscription ? subscription.billing_cycle : 'MONTHLY')
  const [date, setDate] = useState(() => toDateInput(subscription ? subscription.next_billing_date : Date.now() + 30 * 86400000))
  const [error, setError] = useState('')

  const submit = () => {
    const amt = parseAmount(amount)
    const when = parseDateInput(date, new Date().setHours(12, 0, 0, 0))
    if (!name.trim()) return setError('Give the subscription a name.')
    if (!amt) return setError('Enter the amount.')
    if (!when) return setError('Date must be a real date like 2026-11-05.')
    onSave({ name, amount: amt, billing_cycle: cycle, next_billing_date: when })
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={subscription ? 'Edit subscription' : 'Add subscription'}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Netflix" style={{ marginBottom: 12 }} />
      <Field label={`Amount (${currencySymbolFor()})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Chip label="Monthly" selected={cycle === 'MONTHLY'} onPress={() => setCycle('MONTHLY')} />
        <Chip label="Yearly" selected={cycle === 'YEARLY'} onPress={() => setCycle('YEARLY')} />
      </View>
      <Field label="Next billing date (YYYY-MM-DD)" value={date} onChangeText={setDate} style={{ marginBottom: 12 }} />
      {error ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{error}</Text> : null}
      <Button title="Save" onPress={submit} />
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}
