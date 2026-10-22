import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ScrollView, TextInput } from 'react-native'
import withObservables from '@nozbe/with-observables'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { CATEGORIES, UNCATEGORIZED } from '../constants/categories'
import { observeLiveTransactions, createTransaction, updateTransaction } from '../data/transactions'
import { createRule } from '../data/rules'
import { suggestPattern } from '../services/RuleEngine'
import { formatINR, monthBounds } from '../services/Analytics'
import { dayLabel, startOfDay } from '../utils/format'
import { Chip, EmptyState, screenStyles } from '../components/ui'
import TransactionForm from '../components/TransactionForm'
import TransactionDetail from '../components/TransactionDetail'
import CategoryPicker from '../components/CategoryPicker'
import useDeleteWithUndo from '../components/useDeleteWithUndo'

const PAGE = 150

// Resolved when a chip is tapped (not during render) so the window is stable between renders.
const periodStart = (key) => {
  if (key === 'MONTH') { const n = new Date(); return monthBounds(n.getFullYear(), n.getMonth()).start }
  return key === '30D' ? Date.now() - 30 * 86400000 : 0
}
const TYPES = [['ALL', 'All'], ['DEBIT', 'Expense'], ['CREDIT', 'Income'], ['REFUND', 'Refund']]
const PERIODS = [['MONTH', 'This month'], ['30D', '30 days'], ['ALL', 'All time']]

const SwipeAction = ({ side, label, color, onPress, close }) => (
  <TouchableOpacity
    onPress={() => { close(); onPress() }}
    style={[styles.action, { backgroundColor: color }, side === 'left' ? { alignItems: 'flex-start', paddingLeft: 20 } : { alignItems: 'flex-end', paddingRight: 20 }]}
  >
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
)

const Row = React.memo(function Row({ item, onOpen, onCategory, onDelete }) {
  const credit = item.type !== 'DEBIT'
  return (
    <ReanimatedSwipeable
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_p, _t, m) => <SwipeAction side="left" label="Category" color={COLORS.blue} close={m.close} onPress={() => onCategory(item)} />}
      renderRightActions={(_p, _t, m) => <SwipeAction side="right" label="Delete" color={COLORS.coral} close={m.close} onPress={() => onDelete(item)} />}
    >
      <TouchableOpacity onPress={() => onOpen(item)} activeOpacity={0.8} style={[GLASS_STYLES.card, styles.card]}>
        <View style={{ flex: 1 }}>
          <Text style={screenStyles.rowTitle} numberOfLines={1}>{item.merchant}</Text>
          <Text style={screenStyles.rowSub}>{item.category || UNCATEGORIZED} · {item.source === 'VERIFIED_SMS' ? 'SMS ✓' : item.source}{item.receipt_path ? ' · 🧾' : ''}</Text>
        </View>
        <Text style={[screenStyles.amount, { color: credit ? COLORS.emerald : COLORS.coral }]}>
          {credit ? '+' : '-'}{formatINR(item.amount)}
        </Text>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  )
})

const Ledger = ({ transactions }) => {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('ALL')
  const [period, setPeriod] = useState({ key: 'ALL', from: 0 })
  const [category, setCategory] = useState(null)
  const [limit, setLimit] = useState(PAGE)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState(null)
  const [categorizing, setCategorizing] = useState(null)
  const [requestDelete, undoBar] = useDeleteWithUndo()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter(t => {
      if (t.timestamp < period.from) return false
      if (type !== 'ALL' && t.type !== type) return false
      if (category && (t.category || UNCATEGORIZED) !== category) return false
      if (q && !`${t.merchant} ${t.category || ''} ${t.notes || ''} ${t.amount}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [transactions, query, type, period, category])

  const sections = useMemo(() => {
    const map = new Map()
    for (const t of filtered.slice(0, limit)) {
      const key = startOfDay(t.timestamp)
      if (!map.has(key)) map.set(key, { key, title: dayLabel(t.timestamp), total: 0, data: [] })
      const s = map.get(key)
      s.data.push(t)
      if (t.type === 'DEBIT') s.total += t.amount
      else if (t.type === 'REFUND') s.total -= t.amount
    }
    return [...map.values()]
  }, [filtered, limit])

  const chooseCategory = async (cat, applyAll) => {
    const tx = categorizing
    setCategorizing(null)
    if (applyAll) await createRule({ pattern: suggestPattern(tx) || tx.merchant, mapped_merchant: tx.merchant, category: cat })
    else await updateTransaction(tx, { category: cat })
  }

  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.header}>Ledger</Text>

      <TextInput
        style={styles.search}
        placeholder="Search merchant, category, amount"
        placeholderTextColor={COLORS.textSecondary}
        value={query}
        onChangeText={(v) => { setQuery(v); setLimit(PAGE) }}
      />
      <View style={styles.chips}>
        {TYPES.map(([k, l]) => <Chip key={k} label={l} selected={type === k} onPress={() => setType(k)} />)}
      </View>
      <View style={styles.chips}>
        {PERIODS.map(([k, l]) => <Chip key={k} label={l} selected={period.key === k} onPress={() => setPeriod({ key: k, from: periodStart(k) })} color={COLORS.blue} />)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 4 }}>
        <Chip label="All categories" selected={!category} onPress={() => setCategory(null)} />
        {[...CATEGORIES.map(c => c.name), UNCATEGORIZED].map(name => (
          <Chip key={name} label={name} selected={category === name} onPress={() => setCategory(category === name ? null : name)} />
        ))}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <Row item={item} onOpen={setSelected} onCategory={setCategorizing} onDelete={requestDelete} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>{section.total > 0 ? `-${formatINR(section.total)}` : ''}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        onEndReached={() => filtered.length > limit && setLimit(limit + PAGE)}
        onEndReachedThreshold={0.5}
        initialNumToRender={15}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState title="Nothing here" hint="Adjust the filters, or add a transaction with the + button." />}
      />

      <TouchableOpacity style={[screenStyles.fab, { bottom: 24 }]} onPress={() => setAdding(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TransactionForm visible={adding} onClose={() => setAdding(false)}
        onSave={async (v) => { await createTransaction({ ...v, source: 'MANUAL' }); setAdding(false) }} />
      {selected ? <TransactionDetail transaction={selected} onClose={() => setSelected(null)} onDelete={requestDelete} /> : null}
      <CategoryPicker visible={!!categorizing} onClose={() => setCategorizing(null)} onSelect={chooseCategory}
        current={categorizing && categorizing.category} merchant={categorizing && categorizing.merchant} />
      {undoBar}
    </View>
  )
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: COLORS.inputFill, borderRadius: 10, padding: 10, color: COLORS.textPrimary,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 14 },
  sectionTotal: { color: COLORS.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  action: { justifyContent: 'center', width: 110, borderRadius: 16, marginBottom: 8 },
  actionText: { color: '#fff', fontWeight: 'bold' },
})

export default withObservables([], () => ({ transactions: observeLiveTransactions() }))(Ledger)
