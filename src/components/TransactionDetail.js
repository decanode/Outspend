import React, { useState } from 'react'
import { View, Text, Image, Modal, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { Sheet, Button } from './ui'
import TransactionForm from './TransactionForm'
import CategoryPicker from './CategoryPicker'
import CameraVault from '../screens/CameraVault'
import { COLORS } from '../theme/designSystem'
import { formatMoney, isTransfer } from '../services/Analytics'
import { homeCurrency } from '../regions'
import { formatDateTime, SOURCE_LABELS } from '../utils/format'
import { updateTransaction, attachReceipt } from '../data/transactions'
import { setTransferFlag } from '../data/transfers'
import { afterChange } from '../services/PostChange'
import SplitSheet from './SplitSheet'
import { createRule } from '../data/rules'
import { suggestPattern } from '../services/RuleEngine'

const Row = ({ label, value }) => value ? (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
) : null

function TransactionDetail({ transaction: tx, onClose, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [camera, setCamera] = useState(false)
  const [fullImage, setFullImage] = useState(false)
  const [splitting, setSplitting] = useState(false)

  const income = tx.type === 'CREDIT' || tx.type === 'REFUND'

  const saveEdit = async (values) => {
    await updateTransaction(tx, { ...values, needs_review: false })
    setEditing(false)
    afterChange().catch(() => {})
  }

  const chooseCategory = async (category, applyAll) => {
    setPicking(false)
    if (applyAll) {
      const pattern = suggestPattern(tx) || tx.merchant
      const { updated } = await createRule({ pattern, mapped_merchant: tx.merchant, category })
      Alert.alert('Rule saved', `${updated} transaction${updated === 1 ? '' : 's'} updated.`)
    } else {
      await updateTransaction(tx, { category })
    }
  }

  return (
    <Sheet visible onClose={onClose} title={tx.merchant}>
      <Text style={[styles.amount, { color: income ? COLORS.emerald : COLORS.coral }]}>
        {income ? '+' : '-'}{formatMoney(tx.amount, tx.currency)}
      </Text>
      <Row label="Date" value={formatDateTime(tx.timestamp)} />
      <Row label="Type" value={tx.type} />
      <Row label="Currency" value={tx.currency && tx.currency !== homeCurrency() ? `${tx.currency} (not counted in your ${homeCurrency()} totals)` : null} />
      <Row label="Category" value={tx.category || 'Uncategorised'} />
      <Row label="Source" value={SOURCE_LABELS[tx.source] || tx.source} />
      <Row label="Payment mode" value={tx.payment_mode} />
      <Row label="Account / card" value={tx.last4 ? `••${tx.last4}` : null} />
      <Row label="Tags" value={tx.tags ? tx.tags.split(',').map(t => `#${t}`).join(' ') : null} />
      <Row label="Your share" value={tx.my_share !== null && tx.my_share !== undefined ? formatMoney(tx.my_share) : null} />
      <Row label="Transfer" value={isTransfer(tx) ? (tx.transfer === 'USER' ? 'Yes (you marked it)' : 'Yes (detected), not counted as spending') : null} />
      <Row label="Notes" value={tx.notes} />
      {tx.raw_text ? (
        <View style={styles.raw}>
          <Text style={styles.label}>Original message</Text>
          <Text style={styles.rawText}>{tx.raw_text}</Text>
        </View>
      ) : null}
      {tx.receipt_path ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Receipt</Text>
          <TouchableOpacity onPress={() => setFullImage(true)}>
            <Image source={{ uri: tx.receipt_path }} style={styles.thumb} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Button title="Edit" onPress={() => setEditing(true)} />
        <Button title="Change category" onPress={() => setPicking(true)} style={{ marginTop: 8 }} />
        {tx.type === 'DEBIT' ? <Button title={tx.my_share !== null && tx.my_share !== undefined ? 'Edit split' : 'Split with others'} onPress={() => setSplitting(true)} style={{ marginTop: 8 }} /> : null}
        <Button
          title={isTransfer(tx) ? 'Not a transfer: count it' : 'Mark as transfer (not spending)'}
          onPress={async () => { await setTransferFlag(tx, !isTransfer(tx)); afterChange().catch(() => {}) }}
          style={{ marginTop: 8 }}
        />
        <Button title={tx.receipt_path ? 'Replace receipt' : 'Attach receipt'} onPress={() => setCamera(true)} style={{ marginTop: 8 }} />
        <Button title="Delete" variant="danger" onPress={() => { onDelete(tx); onClose() }} style={{ marginTop: 8 }} />
      </View>

      <TransactionForm visible={editing} onClose={() => setEditing(false)} onSave={saveEdit} initial={tx} title="Edit transaction" />
      {splitting ? <SplitSheet transaction={tx} onClose={() => setSplitting(false)} onChanged={() => afterChange().catch(() => {})} /> : null}
      <CategoryPicker visible={picking} onClose={() => setPicking(false)} onSelect={chooseCategory} current={tx.category} merchant={tx.merchant} />
      <Modal visible={camera} animationType="slide" onRequestClose={() => setCamera(false)}>
        <CameraVault onClose={() => setCamera(false)} onImageCaptured={(path) => attachReceipt(tx, path)} />
      </Modal>
      <Modal visible={fullImage} transparent onRequestClose={() => setFullImage(false)}>
        <View style={styles.full}>
          <Image source={{ uri: tx.receipt_path }} style={{ flex: 1 }} resizeMode="contain" />
          <Button title="Close" onPress={() => setFullImage(false)} style={{ margin: 16 }} />
        </View>
      </Modal>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  amount: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: COLORS.textSecondary, fontSize: 12 },
  value: { color: COLORS.textPrimary, fontSize: 14, flexShrink: 1, textAlign: 'right', marginLeft: 16 },
  raw: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: COLORS.inputFill },
  rawText: { color: COLORS.textPrimary, fontSize: 12, marginTop: 4 },
  thumb: { width: 120, height: 160, borderRadius: 8, marginTop: 6 },
  full: { flex: 1, backgroundColor: '#000', paddingTop: 40 },
})

// Observe the single record so edits made inside the sheet re-render it live.
export default withObservables(['transaction'], ({ transaction }) => ({ transaction: transaction.observe() }))(TransactionDetail)
