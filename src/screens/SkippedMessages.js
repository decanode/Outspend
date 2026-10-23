import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Modal, FlatList } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { Button, EmptyState } from '../components/ui'
import TransactionForm from '../components/TransactionForm'
import { loadSkipped, dismissSkipped, REASON_LABELS } from '../services/SkippedLog'
import { createTransaction } from '../data/transactions'
import { afterChange } from '../services/PostChange'
import { formatMoney } from '../services/Analytics'
import { formatDateTime } from '../utils/format'

/**
 * Bank-style messages that mention money but did not become a transaction, with the reason.
 * If one was real, "Add as transaction" records it by hand; "Dismiss" hides it for good.
 */
export default function SkippedMessages({ onClose, onChanged }) {
  const [entries, setEntries] = useState([])
  const [adding, setAdding] = useState(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let alive = true
    loadSkipped().then(s => { if (alive) setEntries(s.entries) })
    return () => { alive = false }
  }, [tick])

  const dismiss = async (id) => { await dismissSkipped(id); reload(); if (onChanged) onChanged() }

  const save = async (values) => {
    const entry = adding
    setAdding(null)
    await createTransaction({ ...values, source: 'MANUAL', raw_text: entry.body, external_id: entry.id })
    await dismissSkipped(entry.id)
    reload()
    if (onChanged) onChanged()
    afterChange().catch(() => {})
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.header}>Skipped messages</Text>
          <Text style={styles.link} onPress={onClose}>Close</Text>
        </View>
        <Text style={styles.hint}>
          These came from a bank-like sender and mention an amount, but were not recorded. If one is a real payment, add it. One-time codes and messages without an amount are not listed.
        </Text>
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          ListEmptyComponent={<EmptyState title="Nothing was skipped" hint="Everything that looked like a payment has been recorded." />}
          renderItem={({ item }) => (
            <View style={[GLASS_STYLES.card, styles.card]}>
              <Text style={styles.reason}>{REASON_LABELS[item.reason] || item.reason}</Text>
              <Text style={styles.meta}>{item.sender} · {formatDateTime(item.timestamp)} · {formatMoney(item.amount, item.currency)}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Add as transaction" onPress={() => setAdding(item)} style={{ marginRight: 8 }} />
                <Button title="Dismiss" variant="ghost" onPress={() => dismiss(item.id)} />
              </View>
            </View>
          )}
        />
        <TransactionForm
          visible={!!adding}
          title="Add from message"
          initial={adding ? { amount: adding.amount, type: 'DEBIT', timestamp: adding.timestamp } : {}}
          onClose={() => setAdding(null)}
          onSave={save}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16, paddingBottom: 24 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 8 },
  header: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold' },
  link: { color: COLORS.emerald, fontWeight: '600' },
  hint: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 },
  card: { marginBottom: 10 },
  reason: { color: COLORS.amber, fontSize: 12, fontWeight: '600' },
  meta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  body: { color: COLORS.textPrimary, fontSize: 13, marginTop: 8 },
})
