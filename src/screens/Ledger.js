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
import { formatINR, monthBounds, isTransfer, shareOf } from '../services/Analytics'
import { parseTags } from '../services/Planning'
import { afterChange } from '../services/PostChange'
import { dayLabel, startOfDay } from '../utils/format'
import { Chip, EmptyState, screenStyles } from '../components/ui'
import TransactionForm from '../components/TransactionForm'
import TransactionDetail from '../components/TransactionDetail'
import CategoryPicker from '../components/CategoryPicker'
import useDeleteWithUndo from '../components/useDeleteWithUndo'

const PAGE = 150

const TYPES = [['ALL', 'All'], ['DEBIT', 'Expense'], ['CREDIT', 'Income'], ['REFUND', 'Refund']]
const PERIODS = [['MONTH', 'This month'], ['30D', '30 days'], ['ALL', 'All time']]

// Resolved when a chip is tapped (not during render) so the window is stable between renders.
const periodStart = (key) => {
  if (key === 'MONTH') { const n = new Date(); return monthBounds(n.getFullYear(), n.getMonth()).start }
  if (key === 'WEEK') { const n = new Date(); const back = (n.getDay() + 6) % 7; return new Date(n.getFullYear(), n.getMonth(), n.getDate() - back).getTime() }
  return key === '30D' ? Date.now() - 30 * 86400000 : 0
}

const SwipeAction = ({ side, label, color, onPress, close }) => (
  <TouchableOpacity
    onPress={() => { close(); onPress() }}
    style={[styles.action, { backgroundColor: color }, side === 'left' ? { alignItems: 'flex-start', paddingLeft: 20 } : { alignItems: 'flex-end', paddingRight: 20 }]}
  >
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
)

// `stamp` (updated_at) re-renders the row after an edit: the model object keeps its identity.
const Row = React.memo(function Row({ item, onOpen, onCategory, onDelete }) {
  const credit = item.type !== 'DEBIT'
  const transfer = isTransfer(item)
  const split = item.my_share !== null && item.my_share !== undefined
  return (
    <ReanimatedSwipeable
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_p, _t, m) => <SwipeAction side="left" label="Category" color={COLORS.blue} close={m.close} onPress={() => onCategory(item)} />}
      renderRightActions={(_p, _t, m) => <SwipeAction side="right" label="Delete" color={COLORS.coral} close={m.close} onPress={() => onDelete(item)} />}
    >
      <TouchableOpacity onPress={() => onOpen(item)} activeOpacity={0.8} style={[GLASS_STYLES.card, styles.card, transfer && { opacity: 0.6 }]}>
        <View style={{ flex: 1 }}>
          <Text style={screenStyles.rowTitle} numberOfLines={1}>{item.merchant}</Text>
          <Text style={screenStyles.rowSub}>
            {transfer ? '↔ Transfer' : item.category || UNCATEGORIZED} · {item.source === 'VERIFIED_SMS' ? 'SMS ✓' : item.source}{item.receipt_path ? ' · 🧾' : ''}{split ? ` · your share ${formatINR(item.my_share)}` : ''}
          </Text>
          {item.tags ? <Text style={styles.tags}>{item.tags.split(',').map(t => `#${t}`).join(' ')}</Text> : null}
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
  const [tag, setTag] = useState(null)
  const [onlyNoReceipt, setOnlyNoReceipt] = useState(false)
  const [hideTransfers, setHideTransfers] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState(null)
  const [categorizing, setCategorizing] = useState(null)
  const [requestDelete, undoBar] = useDeleteWithUndo()

  const allTags = useMemo(() => {
    const counts = new Map()
    for (const t of transactions) if (t.tags) for (const x of parseTags(t.tags)) counts.set(x, (counts.get(x) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x)
  }, [transactions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter(t => {
      if (t.timestamp < period.from) return false
      if (type !== 'ALL' && t.type !== type) return false
      if (category && (t.category || UNCATEGORIZED) !== category) return false
      if (tag && !parseTags(t.tags).includes(tag)) return false
      if (onlyNoReceipt && (t.type !== 'DEBIT' || t.receipt_path)) return false
      if (hideTransfers && isTransfer(t)) return false
      if (q && !`${t.merchant} ${t.category || ''} ${t.notes || ''} ${t.tags || ''} ${t.amount}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [transactions, query, type, period, category, tag, onlyNoReceipt, hideTransfers])

  // What the current filter adds up to, e.g. the full cost of a trip tag. Transfers never count.
  const spentInView = useMemo(() => filtered.reduce((sum, t) => {
    if (isTransfer(t)) return sum
    if (t.type === 'DEBIT') return sum + shareOf(t)
    return t.type === 'REFUND' ? sum - t.amount : sum
  }, 0), [filtered])

  const sections = useMemo(() => {
    const map = new Map()
    for (const t of filtered.slice(0, limit)) {
      const key = startOfDay(t.timestamp)
      if (!map.has(key)) map.set(key, { key, title: dayLabel(t.timestamp), total: 0, data: [] })
      const s = map.get(key)
      s.data.push(t)
      if (!isTransfer(t)) {
        if (t.type === 'DEBIT') s.total += shareOf(t)
        else if (t.type === 'REFUND') s.total -= t.amount
      }
    }
    return [...map.values()]
  }, [filtered, limit])

  const filtersActive = query || type !== 'ALL' || period.key !== 'ALL' || category || tag || onlyNoReceipt || hideTransfers
  const reset = () => { setQuery(''); setType('ALL'); setPeriod({ key: 'ALL', from: 0 }); setCategory(null); setTag(null); setOnlyNoReceipt(false); setHideTransfers(false); setLimit(PAGE) }
  const pickPeriod = (key) => setPeriod(period.key === key ? { key: 'ALL', from: 0 } : { key, from: periodStart(key) })

  const chooseCategory = async (cat, applyAll) => {
    const tx = categorizing
    setCategorizing(null)
    if (applyAll) await createRule({ pattern: suggestPattern(tx) || tx.merchant, mapped_merchant: tx.merchant, category: cat })
    else await updateTransaction(tx, { category: cat })
    afterChange().catch(() => {})
  }

  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.header}>Ledger</Text>

      <TextInput
        style={styles.search}
        placeholder="Search merchant, category, tag, amount"
        placeholderTextColor={COLORS.textSecondary}
        value={query}
        onChangeText={(v) => { setQuery(v); setLimit(PAGE) }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
        <Chip label="This week" selected={period.key === 'WEEK'} color={COLORS.blue} onPress={() => pickPeriod('WEEK')} />
        <Chip label="Uncategorised" selected={category === UNCATEGORIZED} onPress={() => setCategory(category === UNCATEGORIZED ? null : UNCATEGORIZED)} />
        <Chip label="Needs receipt" selected={onlyNoReceipt} onPress={() => setOnlyNoReceipt(!onlyNoReceipt)} />
        <Chip label="Hide transfers" selected={hideTransfers} onPress={() => setHideTransfers(!hideTransfers)} />
        {filtersActive ? <Chip label="Clear all" color={COLORS.coral} onPress={reset} /> : null}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
        {TYPES.map(([k, l]) => <Chip key={k} label={l} selected={type === k} onPress={() => setType(k)} />)}
        {PERIODS.map(([k, l]) => <Chip key={k} label={l} selected={period.key === k} color={COLORS.blue} onPress={() => setPeriod({ key: k, from: periodStart(k) })} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
        <Chip label="All categories" selected={!category} onPress={() => setCategory(null)} />
        {[...CATEGORIES.map(c => c.name), UNCATEGORIZED].map(name => (
          <Chip key={name} label={name} selected={category === name} onPress={() => setCategory(category === name ? null : name)} />
        ))}
      </ScrollView>
      {allTags.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
          {allTags.map(t => <Chip key={t} label={`#${t}`} selected={tag === t} color={COLORS.amber} onPress={() => setTag(tag === t ? null : t)} />)}
        </ScrollView>
      ) : null}

      <Text style={styles.summary}>
        {filtered.length} transaction{filtered.length === 1 ? '' : 's'}{filtered.length ? ` · spent ${formatINR(Math.max(spentInView, 0))}` : ''}
      </Text>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <Row item={item} stamp={item.updated_at} onOpen={setSelected} onCategory={setCategorizing} onDelete={requestDelete} />}
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
        onSave={async (v) => { await createTransaction({ ...v, source: 'MANUAL' }); setAdding(false); afterChange().catch(() => {}) }} />
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
  strip: { flexGrow: 0, marginBottom: 2 },
  summary: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 14 },
  sectionTotal: { color: COLORS.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tags: { color: COLORS.amber, fontSize: 11, marginTop: 3 },
  action: { justifyContent: 'center', width: 110, borderRadius: 16, marginBottom: 8 },
  actionText: { color: '#fff', fontWeight: 'bold' },
})

export default withObservables([], () => ({ transactions: observeLiveTransactions() }))(Ledger)
