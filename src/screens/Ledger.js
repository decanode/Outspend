import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput } from 'react-native'
import withObservables from '@nozbe/with-observables'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { CATEGORIES, UNCATEGORIZED } from '../constants/categories'
import { observeLiveTransactions, createTransaction, updateTransaction } from '../data/transactions'
import { createRule } from '../data/rules'
import { suggestPattern } from '../services/RuleEngine'
import { formatMoney, monthBounds, isTransfer, shareOf } from '../services/Analytics'
import { isForeignCurrency } from '../regions'
import { DEFAULT_FILTERS, UNASSIGNED, filterTransactions, hasActiveFilters, spentIn } from '../services/LedgerFilter'
import { watch, col } from '../data/util'
import { parseTags } from '../services/Planning'
import { afterChange } from '../services/PostChange'
import { dayLabel, startOfDay } from '../utils/format'
import { Dropdown, EmptyState, screenStyles } from '../components/ui'
import TransactionForm from '../components/TransactionForm'
import TransactionDetail from '../components/TransactionDetail'
import CategoryPicker from '../components/CategoryPicker'
import useDeleteWithUndo from '../components/useDeleteWithUndo'

const PAGE = 150

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All types' }, { value: 'DEBIT', label: 'Expenses' },
  { value: 'CREDIT', label: 'Income' }, { value: 'REFUND', label: 'Refunds' },
]
const PERIOD_OPTIONS = [
  { value: 'ALL', label: 'All time' }, { value: 'WEEK', label: 'This week' },
  { value: 'MONTH', label: 'This month' }, { value: '30D', label: 'Last 30 days' },
]
const SHOW_OPTIONS = [
  { value: 'ALL', label: 'Everything' }, { value: 'NO_RECEIPT', label: 'Expenses without a receipt' },
  { value: 'HIDE_TRANSFERS', label: 'Hide transfers' }, { value: 'TRANSFERS', label: 'Only transfers' },
]

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
            {transfer ? '↔ Transfer' : item.category || UNCATEGORIZED} · {item.source === 'VERIFIED_SMS' ? 'SMS ✓' : item.source}{item.receipt_path ? ' · 🧾' : ''}{split ? ` · your share ${formatMoney(item.my_share)}` : ''}
          </Text>
          {item.notes ? <Text style={styles.item} numberOfLines={1}>{item.notes}</Text> : null}
          {item.tags ? <Text style={styles.tags}>{item.tags.split(',').map(t => `#${t}`).join(' ')}</Text> : null}
        </View>
        <Text style={[screenStyles.amount, { color: credit ? COLORS.emerald : COLORS.coral }]}>
          {credit ? '+' : '-'}{formatMoney(item.amount, item.currency)}
        </Text>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  )
})

const Ledger = ({ transactions, accounts, cards, route }) => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [periodKey, setPeriodKey] = useState('ALL')
  // The Accounts tab opens this screen with { accountId, token }. A newer token wins over the
  // dropdown until the user changes it again, so no effect is needed to sync it.
  const params = (route && route.params) || {}
  const [accountPick, setAccountPick] = useState({ token: null, value: null })
  const account = accountPick.token === (params.token || null) && accountPick.token !== null
    ? accountPick.value
    : params.accountId || filters.account
  const setAccount = (value) => setAccountPick({ token: params.token || null, value })
  const [limit, setLimit] = useState(PAGE)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState(null)
  const [categorizing, setCategorizing] = useState(null)
  const [requestDelete, undoBar] = useDeleteWithUndo()

  const setFilter = (patch) => { setFilters(f => ({ ...f, ...patch })); setLimit(PAGE) }
  const pickPeriod = (key) => { setPeriodKey(key); setFilter({ from: periodStart(key) }) }
  const clearAll = () => { setFilters(DEFAULT_FILTERS); setPeriodKey('ALL'); setAccountPick({ token: params.token || null, value: null }); setLimit(PAGE) }

  const effective = useMemo(() => ({ ...filters, account }), [filters, account])

  const allTags = useMemo(() => {
    const counts = new Map()
    for (const t of transactions) if (t.tags) for (const x of parseTags(t.tags)) counts.set(x, (counts.get(x) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x)
  }, [transactions])

  const filtered = useMemo(() => filterTransactions(transactions, effective), [transactions, effective])
  const spentInView = useMemo(() => spentIn(filtered), [filtered])

  const accountOptions = useMemo(() => [
    { value: null, label: 'All accounts' },
    ...accounts.map(a => ({ value: a.id, label: a.name })),
    ...cards.map(c => ({ value: c.id, label: `${c.name} (card)` })),
    { value: UNASSIGNED, label: 'Not linked to an account' },
  ], [accounts, cards])
  const categoryOptions = useMemo(() => [
    { value: null, label: 'All categories' },
    ...CATEGORIES.map(c => ({ value: c.name, label: c.name })),
    { value: UNCATEGORIZED, label: 'Uncategorised' },
  ], [])
  const tagOptions = useMemo(() => [{ value: null, label: 'All tags' }, ...allTags.map(t => ({ value: t, label: `#${t}` }))], [allTags])

  const sections = useMemo(() => {
    const map = new Map()
    for (const t of filtered.slice(0, limit)) {
      const key = startOfDay(t.timestamp)
      if (!map.has(key)) map.set(key, { key, title: dayLabel(t.timestamp), total: 0, data: [] })
      const s = map.get(key)
      s.data.push(t)
      if (!isTransfer(t) && !isForeignCurrency(t)) {
        if (t.type === 'DEBIT') s.total += shareOf(t)
        else if (t.type === 'REFUND') s.total -= t.amount
      }
    }
    return [...map.values()]
  }, [filtered, limit])

  const filtersActive = hasActiveFilters(effective)

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
        placeholder="Search merchant, item, category, tag, amount"
        placeholderTextColor={COLORS.textSecondary}
        value={filters.query}
        onChangeText={(v) => setFilter({ query: v })}
      />
      <View style={styles.dropdowns}>
        <Dropdown label="Type" value={filters.type} options={TYPE_OPTIONS} onChange={(v) => setFilter({ type: v })} />
        <Dropdown label="Period" value={periodKey} options={PERIOD_OPTIONS} onChange={pickPeriod} />
        <Dropdown label="Category" value={filters.category} options={categoryOptions} onChange={(v) => setFilter({ category: v })} />
        <Dropdown label="Account" value={account} options={accountOptions} onChange={(v) => { setAccount(v); setFilter({ account: v }) }} />
        {allTags.length > 0 ? <Dropdown label="Tag" value={filters.tag} options={tagOptions} onChange={(v) => setFilter({ tag: v })} /> : null}
        <Dropdown label="Show" value={filters.show} options={SHOW_OPTIONS} onChange={(v) => setFilter({ show: v })} />
      </View>
      {filtersActive ? <Text style={styles.clear} onPress={clearAll}>Clear all filters</Text> : null}

      <Text style={styles.summary}>
        {filtered.length} transaction{filtered.length === 1 ? '' : 's'}{filtered.length ? ` · spent ${formatMoney(Math.max(spentInView, 0))}` : ''}
      </Text>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <Row item={item} stamp={item.updated_at} onOpen={setSelected} onCategory={setCategorizing} onDelete={requestDelete} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>{section.total > 0 ? `-${formatMoney(section.total)}` : ''}</Text>
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
  dropdowns: { flexDirection: 'row', flexWrap: 'wrap' },
  clear: { color: COLORS.coral, fontWeight: '600', marginBottom: 4 },
  summary: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 14 },
  sectionTotal: { color: COLORS.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tags: { color: COLORS.amber, fontSize: 11, marginTop: 3 },
  item: { color: COLORS.textPrimary, fontSize: 12, marginTop: 3, opacity: 0.8 },
  action: { justifyContent: 'center', width: 110, borderRadius: 16, marginBottom: 8 },
  actionText: { color: '#fff', fontWeight: 'bold' },
})

export default withObservables([], () => ({
  transactions: observeLiveTransactions(),
  accounts: watch(col('accounts').query()),
  cards: watch(col('credit_cards').query()),
}))(Ledger)
