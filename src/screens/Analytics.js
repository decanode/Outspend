import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { Q } from '@nozbe/watermelondb'
import { PieChart } from 'react-native-gifted-charts'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { categoryColor } from '../constants/categories'
import { aggregateSpend, monthBounds, monthLabel, shiftMonth, formatINR } from '../services/Analytics'
import { col, toPlain } from '../data/util'
import { EmptyState, SectionTitle, screenStyles } from '../components/ui'

const TOP_MERCHANTS = 5

const MonthView = ({ year, month, txs }) => {
  const { current, previous } = useMemo(() => {
    const plain = txs.map(toPlain)
    const cur = monthBounds(year, month)
    const prevMonth = shiftMonth({ year, month }, -1)
    const prev = monthBounds(prevMonth.year, prevMonth.month)
    return { current: aggregateSpend(plain, cur.start, cur.end), previous: aggregateSpend(plain, prev.start, prev.end) }
  }, [txs, year, month])

  if (current.total === 0) {
    return <EmptyState title="No spending this month" hint="Expenses captured from SMS or added manually will show up here." />
  }

  const pieData = current.categories.map(c => ({ value: c.amount, color: categoryColor(c.name) }))
  const delta = previous.total > 0 ? Math.round(((current.total - previous.total) / previous.total) * 100) : null

  return (
    <>
      <View style={[GLASS_STYLES.card, styles.chartCard]}>
        <Text style={styles.cardTitle}>Spending breakdown</Text>
        <View style={styles.chartContainer}>
          <PieChart
            donut
            innerRadius={60}
            radius={90}
            data={pieData}
            innerCircleColor={COLORS.background}
            centerLabelComponent={() => (
              <Text style={{ fontSize: 18, color: COLORS.textPrimary, fontWeight: 'bold' }}>{formatINR(current.total)}</Text>
            )}
          />
        </View>
        {delta !== null && (
          <Text style={[styles.delta, { color: delta > 0 ? COLORS.coral : COLORS.emerald }]}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last month
          </Text>
        )}
        <View style={styles.legend}>
          {current.categories.map(c => (
            <View key={c.name} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: categoryColor(c.name) }]} />
              <Text style={styles.legendName}>{c.name}</Text>
              <Text style={styles.legendValue}>{Math.round((c.amount / current.total) * 100)}% · {formatINR(c.amount)}</Text>
            </View>
          ))}
        </View>
      </View>

      <SectionTitle>Top merchants</SectionTitle>
      {current.merchants.slice(0, TOP_MERCHANTS).map(m => (
        <View key={m.name} style={[GLASS_STYLES.card, styles.merchantRow]}>
          <Text style={styles.merchantName} numberOfLines={1}>{m.name}</Text>
          <Text style={styles.merchantAmount}>{formatINR(m.amount)}</Text>
        </View>
      ))}
    </>
  )
}

// Only the visible month and the one before it (for the comparison) are observed.
const ObservedMonth = withObservables(['year', 'month'], ({ year, month }) => {
  const prev = shiftMonth({ year, month }, -1)
  const from = monthBounds(prev.year, prev.month).start
  const to = monthBounds(year, month).end
  return {
    txs: col('transactions').query(Q.where('is_deleted', false), Q.where('timestamp', Q.between(from, to - 1))),
  }
})(MonthView)

export default function Analytics() {
  const now = new Date()
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const isCurrent = ym.year === now.getFullYear() && ym.month === now.getMonth()

  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.header}>Analytics</Text>
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => setYm(shiftMonth(ym, -1))} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(ym)}</Text>
        <TouchableOpacity onPress={() => setYm(shiftMonth(ym, 1))} disabled={isCurrent} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={isCurrent ? COLORS.cardBorder : COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <ObservedMonth year={ym.year} month={ym.month} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  monthLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  chartCard: { alignItems: 'center', marginBottom: 24 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 16, alignSelf: 'flex-start' },
  chartContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  delta: { fontSize: 13, marginBottom: 12 },
  legend: { width: '100%' },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendName: { color: COLORS.textPrimary, flex: 1, fontSize: 13 },
  legendValue: { color: COLORS.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  merchantRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, padding: 16 },
  merchantName: { color: COLORS.textPrimary, fontSize: 16, flex: 1, marginRight: 12 },
  merchantAmount: { color: COLORS.coral, fontSize: 16, fontWeight: 'bold' },
})
