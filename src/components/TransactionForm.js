import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Sheet, Chip, Field, Button, DateField } from './ui'
import { CATEGORIES } from '../constants/categories'
import { currencySymbolFor } from '../regions'
import { COLORS } from '../theme/designSystem'
import { col } from '../data/util'
import { parseAmount, parseDateInput, toDateInput } from '../utils/format'
import { tagsToString } from '../services/Planning'

/**
 * Add / edit / confirm a transaction. `initial` can pre-fill it (edit, or a voice
 * utterance awaiting confirmation). onSave receives validated values.
 */
export default function TransactionForm(props) {
  // Mounted only while open, so every open starts from fresh state.
  return props.visible ? <TransactionFormBody {...props} /> : null
}

function TransactionFormBody({ visible, onClose, onSave, initial = {}, title = 'Add transaction' }) {
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : '')
  const [merchant, setMerchant] = useState(initial.merchant && initial.merchant !== 'Unknown Vendor' ? initial.merchant : '')
  const [type, setType] = useState(initial.type === 'CREDIT' ? 'CREDIT' : 'DEBIT')
  const [category, setCategory] = useState(initial.category || null)
  const [date, setDate] = useState(() => toDateInput(initial.timestamp || Date.now()))
  const [notes, setNotes] = useState(initial.notes || '')
  const [tags, setTags] = useState(initial.tags || '')
  const [accountId, setAccountId] = useState(initial.account_id || null)
  const [cardId, setCardId] = useState(initial.card_id || null)
  const [accounts, setAccounts] = useState([])
  const [cards, setCards] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([col('accounts').query().fetch(), col('credit_cards').query().fetch()])
      .then(([a, c]) => { if (alive) { setAccounts(a); setCards(c) } })
    return () => { alive = false }
  }, [])

  const submit = () => {
    const amt = parseAmount(amount)
    if (!amt) return setError('Enter an amount greater than 0.')
    const ts = parseDateInput(date, initial.timestamp || Date.now())
    if (!ts) return setError('Date must be a real date like 2026-10-31.')
    if (ts > Date.now() + 86400000) return setError('Date cannot be in the future.')
    onSave({
      amount: amt,
      merchant: merchant.trim() || 'Unknown Vendor',
      type,
      category,
      timestamp: ts,
      notes: notes.trim() || null,
      tags: tagsToString(tags) || null,
      account_id: accountId,
      card_id: type === 'DEBIT' ? cardId : null,
    })
  }

  const setPreset = (daysAgo) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    setDate(toDateInput(d.getTime()))
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Chip label="Expense" selected={type === 'DEBIT'} color={COLORS.coral} onPress={() => setType('DEBIT')} />
        <Chip label="Income" selected={type === 'CREDIT'} onPress={() => { setType('CREDIT'); setCardId(null) }} />
      </View>
      <Field label={`Amount (${currencySymbolFor()})`} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0" style={{ marginBottom: 12 }} />
      <Field label="Merchant / person" value={merchant} onChangeText={setMerchant} placeholder="e.g. Swiggy" style={{ marginBottom: 12 }} />
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 6 }}>Category</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        {CATEGORIES.map(c => (
          <Chip key={c.name} label={c.name} color={c.color} selected={category === c.name} onPress={() => setCategory(category === c.name ? null : c.name)} />
        ))}
      </View>
      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} style={{ marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Chip label="Today" onPress={() => setPreset(0)} />
        <Chip label="Yesterday" onPress={() => setPreset(1)} />
      </View>
      {accounts.length > 0 || (cards.length > 0 && type === 'DEBIT') ? (
        <>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 6 }}>{type === 'DEBIT' ? 'Paid from' : 'Received in'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {accounts.map(a => (
              <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => { setAccountId(accountId === a.id ? null : a.id); setCardId(null) }} />
            ))}
            {type === 'DEBIT' && cards.map(c => (
              <Chip key={c.id} label={c.name} selected={cardId === c.id} onPress={() => { setCardId(cardId === c.id ? null : c.id); setAccountId(null) }} />
            ))}
          </View>
        </>
      ) : null}
      <Field label="Tags (optional, comma separated)" value={tags} onChangeText={setTags} placeholder="trip, work" autoCapitalize="none" style={{ marginBottom: 12 }} />
      <Field label="Item / what you bought (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. phone charger" style={{ marginBottom: 12 }} />
      {error ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{error}</Text> : null}
      <Button title="Save" onPress={submit} />
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}
