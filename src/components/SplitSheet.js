import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Sheet, Field, Button, Chip } from './ui'
import { COLORS } from '../theme/designSystem'
import { formatINR } from '../services/Analytics'
import { myShareAfterSplit } from '../services/Planning'
import { fetchSplitsFor, setSplits, clearSplits } from '../data/splits'
import { parseAmount } from '../utils/format'

/**
 * Record who else a payment was for. Their parts are tracked as money owed to you, and
 * Analytics counts only your own share.
 */
export default function SplitSheet({ transaction: tx, onClose, onChanged }) {
  const [rows, setRows] = useState([{ person: '', amount: '' }])
  const [settledTotal, setSettledTotal] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchSplitsFor(tx.id).then(existing => {
      if (!alive) return
      const open = existing.filter(s => !s.is_settled)
      setSettledTotal(existing.filter(s => s.is_settled).reduce((s, x) => s + x.amount, 0))
      if (open.length) setRows(open.map(s => ({ person: s.person, amount: String(s.amount) })))
    })
    return () => { alive = false }
  }, [tx.id])

  const parsed = rows.map(r => parseAmount(r.amount))
  const filled = rows.filter((r, i) => r.person.trim() && parsed[i])
  const share = myShareAfterSplit(tx.amount, [...filled.map(r => parseAmount(r.amount)), ...(settledTotal > 0 ? [settledTotal] : [])])

  const update = (i, patch) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  const splitEqually = () => {
    const people = rows.filter(r => r.person.trim())
    if (!people.length) return setError('Add at least one name first.')
    const each = Math.floor((tx.amount / (people.length + 1)) * 100) / 100
    setRows(rows.map(r => (r.person.trim() ? { ...r, amount: String(each) } : r)))
    setError('')
  }

  const save = async () => {
    if (!filled.length) return setError('Add a name and an amount for at least one person.')
    if (share === null) return setError(`Their parts can't add up to more than ${formatINR(tx.amount)}.`)
    const ok = await setSplits(tx, filled.map(r => ({ person: r.person, amount: parseAmount(r.amount) })))
    if (!ok) return setError('Those amounts do not fit this payment.')
    if (onChanged) onChanged()
    onClose()
  }

  const clear = async () => {
    await clearSplits(tx)
    if (onChanged) onChanged()
    onClose()
  }

  return (
    <Sheet visible onClose={onClose} title={`Split ${formatINR(tx.amount)}`}>
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 }}>
        Add the people who owe you a part of this payment.
      </Text>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
          <Field placeholder="Name" value={r.person} onChangeText={(v) => update(i, { person: v })} style={{ flex: 2, marginRight: 8 }} />
          <Field placeholder="₹" keyboardType="decimal-pad" value={r.amount} onChangeText={(v) => update(i, { amount: v })} style={{ flex: 1 }} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="+ Add person" onPress={() => setRows([...rows, { person: '', amount: '' }])} />
        <Chip label="Split equally" onPress={splitEqually} />
      </View>
      <Text style={{ color: share === null ? COLORS.coral : COLORS.emerald, marginVertical: 10 }}>
        {share === null ? 'Parts are more than the payment.' : `Your share: ${formatINR(share)}`}
      </Text>
      {error ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{error}</Text> : null}
      <Button title="Save split" onPress={save} />
      {tx.my_share !== null && tx.my_share !== undefined ? <Button title="Remove split" variant="danger" onPress={clear} style={{ marginTop: 8 }} /> : null}
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}
