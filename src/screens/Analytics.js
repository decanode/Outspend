import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { Q } from '@nozbe/watermelondb'
import { PieChart, BarChart } from 'react-native-gifted-charts'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { categoryColor } from '../constants/categories'
import { formatMoney } from '../services/Analytics'
import { makePeriod, shiftPeriod, periodLabel, isCurrentPeriod, analyzePeriod, runRate, trendFor, categoryTrendFor } from '../services/Insights'
import { resolveMonthPeriod } from '../services/PayCycle'
import { peekSettings } from '../services/Settings'
import { OVERALL } from '../services/Budgets'
import { exportPeriodReport } from '../services/ExportService'
import { col, toPlain, watch } from '../data/util'
import { observeBudgets } from '../data/budgets'
import { Button, Chip, EmptyState, screenStyles } from '../components/ui'
import { HBar, MiniBars, Pill } from '../components/charts'
import TransactionDetail from '../components/TransactionDetail'
import useDeleteWithUndo from '../components/useDeleteWithUndo'
import { formatDate } from '../utils/format'

const HISTORY_MONTHS = 15

const Delta = ({ pct, invert = true }) => {
  if (pct === null || pct === undefined) return null
  // for spending, up is bad (coral) and down is good (emerald)
  const bad = invert ? pct > 0 : pct < 0
  return <Pill text={`${pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} ${Math.abs(pct)}%`} color={pct === 0 ? COLORS.textSecondary : bad ? COLORS.coral : COLORS.emerald} />
}

const Card = ({ title, children, style }) => (
  <View style={[GLASS_STYLES.card, styles.card, style]}>
    {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
    {children}
  </View>
)

const Body = ({ txs, budgets, mode, offset, setOffset, earliest, trendMonths, setTrendMonths, onOpen }) => {
  const [now] = useState(() => Date.now())
  const plain = useMemo(() => txs.map(toPlain), [txs])

  // "Month" is the pay cycle once a salary source is confirmed. The period is worked out here, from
  // the transactions, because cycle boundaries are the salary credits themselves.
  const basePeriod = useMemo(
    () => (mode === 'WEEK' ? makePeriod('WEEK', now) : resolveMonthPeriod(now, peekSettings().salarySource, plain, (ts) => makePeriod('MONTH', ts), now)),
    [plain, mode, now]
  )
  const period = useMemo(() => { let p = basePeriod; for (let i = 0; i < offset; i++) p = shiftPeriod(p, -1); return p }, [basePeriod, offset])
  const canGoBack = shiftPeriod(period, -1).end > earliest
  const current = isCurrentPeriod(period, now)

  const a = useMemo(() => analyzePeriod(plain, period), [plain, period])
  const trendBase = useMemo(() => (mode === 'WEEK' ? makePeriod('MONTH', now) : basePeriod), [mode, basePeriod, now])
  const trend = useMemo(() => trendFor(plain, trendBase, trendMonths), [plain, trendBase, trendMonths])
  const catTrend = useMemo(() => categoryTrendFor(plain, trendBase, trendMonths, 5), [plain, trendBase, trendMonths])
  const cap = budgets.find(b => b.category === OVERALL)
  const rate = runRate(a.total, period)
  const label = period.mode === 'WEEK' ? 'last week' : period.mode === 'CYCLE' ? 'last cycle' : 'last month'

  const share = async () => {
    try { await exportPeriodReport(period) } catch { Alert.alert('Could not create the report', 'Please try again.') }
  }

  const nav = (
    <View style={styles.monthRow}>
      <TouchableOpacity onPress={() => setOffset(offset + 1)} disabled={!canGoBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={canGoBack ? COLORS.textPrimary : COLORS.cardBorder} />
      </TouchableOpacity>
      <Text style={styles.monthLabel}>{periodLabel(period)}</Text>
      <TouchableOpacity onPress={() => setOffset(Math.max(0, offset - 1))} disabled={current} hitSlop={12}>
        <Ionicons name="chevron-forward" size={22} color={current ? COLORS.cardBorder : COLORS.textPrimary} />
      </TouchableOpacity>
    </View>
  )

  if (a.total === 0 && a.income === 0) {
    return (
      <>
        {nav}
        <EmptyState title={`Nothing recorded for ${periodLabel(period)}`} hint="Expenses captured from SMS or added by hand will show up here." />
      </>
    )
  }

  const maxTod = Math.max(...Object.values(a.patterns.timeOfDay), 1)
  const todLabels = { morning: 'Morning (5–12)', afternoon: 'Afternoon (12–5)', evening: 'Evening (5–9)', night: 'Night (9–5)' }

  return (
    <>
      {nav}
      <Card>
        <Text style={styles.big}>{formatMoney(a.total)}</Text>
        <View style={styles.row}>
          <Delta pct={a.deltaPct} />
          <Text style={styles.sub}>  vs {label} ({formatMoney(a.prevTotal)})</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>Income</Text><Text style={[styles.statValue, { color: COLORS.emerald }]}>{formatMoney(a.income)}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Saved</Text><Text style={styles.statValue}>{a.income > 0 ? `${a.savingsRate}%` : '—'}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Per day</Text><Text style={styles.statValue}>{formatMoney(Math.round(a.avgPerDay))}</Text></View>
        </View>
        {rate ? (
          <Text style={[styles.sub, { marginTop: 10 }]}>
            At this pace you will spend {formatMoney(Math.round(rate.projected))} this {period.mode === 'CYCLE' ? 'pay cycle' : 'month'}
            {cap ? (rate.projected > cap.amount ? `, ${formatMoney(Math.round(rate.projected - cap.amount))} over your ${formatMoney(cap.amount)} budget.` : `, within your ${formatMoney(cap.amount)} budget.`) : '.'}
          </Text>
        ) : null}
        {a.busiest ? <Text style={styles.sub}>Busiest day: {formatDate(a.busiest.start)} ({formatMoney(a.busiest.amount)})</Text> : null}
      </Card>

      {a.foreign > 0 ? (
        <Text style={[styles.sub, { marginBottom: 12 }]}>
          {a.foreign} transaction{a.foreign === 1 ? '' : 's'} in another currency {a.foreign === 1 ? 'is' : 'are'} not included in these totals.
        </Text>
      ) : null}

      <Card title="Cash flow">
        <HBar label="Income" value={formatMoney(a.income)} ratio={Math.max(a.income, a.total) > 0 ? a.income / Math.max(a.income, a.total) : 0} />
        <HBar label="Spent" value={formatMoney(a.total)} ratio={Math.max(a.income, a.total) > 0 ? a.total / Math.max(a.income, a.total) : 0} color={COLORS.coral} />
        <Text style={[styles.sub, { color: a.net >= 0 ? COLORS.emerald : COLORS.coral }]}>
          {a.net >= 0 ? `You kept ${formatMoney(a.net)}` : `You spent ${formatMoney(-a.net)} more than you earned`}
        </Text>
      </Card>

      {a.categories.length > 0 && (
        <Card title="Where it went">
          <View style={styles.center}>
            <PieChart
              donut innerRadius={55} radius={85}
              data={a.categories.map(c => ({ value: c.amount, color: categoryColor(c.name) }))}
              innerCircleColor={COLORS.background}
              centerLabelComponent={() => <Text style={{ color: COLORS.textPrimary, fontWeight: 'bold' }}>{formatMoney(a.total)}</Text>}
            />
          </View>
          <View style={{ marginTop: 14 }}>
            {a.categories.map(c => (
              <HBar
                key={c.name}
                label={`${c.name} · ${Math.round((c.amount / a.total) * 100)}%`}
                value={formatMoney(c.amount)}
                ratio={c.amount / a.categories[0].amount}
                color={categoryColor(c.name)}
                right={c.deltaPct === null ? `New since ${label}` : `${c.deltaPct > 0 ? '+' : ''}${c.deltaPct}% vs ${label} (${formatMoney(c.prev)})`}
              />
            ))}
          </View>
        </Card>
      )}

      {(a.movers.up.length > 0 || a.movers.down.length > 0) && (
        <Card title="Biggest movers">
          {a.movers.up.map(m => (
            <View key={`u${m.name}`} style={styles.moverRow}>
              <Text style={styles.moverName}>{m.name}</Text>
              <Text style={{ color: COLORS.coral }}>▲ {formatMoney(m.delta)} more</Text>
            </View>
          ))}
          {a.movers.down.map(m => (
            <View key={`d${m.name}`} style={styles.moverRow}>
              <Text style={styles.moverName}>{m.name}</Text>
              <Text style={{ color: COLORS.emerald }}>▼ {formatMoney(-m.delta)} less</Text>
            </View>
          ))}
        </Card>
      )}

      <Card title="Day by day">
        <BarChart
          data={a.daily.map(d => ({ value: d.amount, label: period.mode === 'WEEK' ? d.label : (d.day % 5 === 1 ? String(d.day) : ''), frontColor: a.busiest && d.start === a.busiest.start ? COLORS.coral : COLORS.emerald }))}
          barWidth={period.mode === 'WEEK' ? 24 : 6}
          spacing={period.mode === 'WEEK' ? 14 : 3}
          roundedTop hideRules noOfSections={3} yAxisThickness={0} xAxisThickness={0}
          yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
          height={110} isAnimated={false}
        />
      </Card>

      <Card title="Spending patterns">
        <HBar label="Weekdays" value={formatMoney(a.patterns.weekday)} ratio={(100 - a.patterns.weekendShare) / 100} color={COLORS.blue} />
        <HBar label="Weekends" value={formatMoney(a.patterns.weekend)} ratio={a.patterns.weekendShare / 100} color={COLORS.amber} right={`${a.patterns.weekendShare}% of spending happens on weekends`} />
        <Text style={[styles.cardTitle, { marginTop: 6, fontSize: 14 }]}>Time of day</Text>
        {Object.entries(a.patterns.timeOfDay).map(([k, v]) => (
          <HBar key={k} label={todLabels[k]} value={formatMoney(v)} ratio={v / maxTod} color={COLORS.blue} />
        ))}
        <Text style={styles.sub}>
          Small purchases (under {formatMoney(a.patterns.small.threshold)}): {a.patterns.small.count} totalling {formatMoney(a.patterns.small.total)} — {a.patterns.small.share}% of spending.
        </Text>
      </Card>

      {a.top.length > 0 && (
        <Card title="Top expenses">
          {a.top.map(t => (
            <TouchableOpacity key={t.id} style={styles.topRow} onPress={() => onOpen(t.id)}>
              <View style={{ flex: 1 }}>
                <Text style={screenStyles.rowTitle} numberOfLines={1}>{t.merchant}</Text>
                <Text style={screenStyles.rowSub}>{formatDate(t.timestamp)} · {t.category}</Text>
              </View>
              <Text style={[screenStyles.amount, { color: COLORS.coral }]}>{formatMoney(t.amount)}</Text>
            </TouchableOpacity>
          ))}
        </Card>
      )}

      <Card title="Trend">
        <View style={styles.row}>
          <Chip label="6 months" selected={trendMonths === 6} onPress={() => setTrendMonths(6)} />
          <Chip label="12 months" selected={trendMonths === 12} onPress={() => setTrendMonths(12)} />
        </View>
        <BarChart
          data={trend.map((m, i) => ({ value: m.total, label: m.label, frontColor: i === trend.length - 1 ? COLORS.emerald : 'rgba(16,185,129,0.5)' }))}
          barWidth={trendMonths === 6 ? 28 : 14}
          spacing={trendMonths === 6 ? 14 : 8}
          roundedTop hideRules noOfSections={3} yAxisThickness={0} xAxisThickness={0}
          yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: COLORS.textSecondary, fontSize: 9 }}
          height={110} isAnimated={false}
        />
        {catTrend.map(c => (
          <View key={c.name} style={styles.sparkRow}>
            <Text style={styles.sparkName} numberOfLines={1}>{c.name}</Text>
            <MiniBars values={c.values} color={categoryColor(c.name)} />
          </View>
        ))}
      </Card>

      <Button title="Share report (PDF)" onPress={share} />
    </>
  )
}

const ObservedBody = withObservables(['since'], ({ since }) => ({
  txs: watch(col('transactions').query(Q.where('is_deleted', false), Q.where('timestamp', Q.gte(since)))),
  budgets: observeBudgets(),
}))(({ txs, budgets, ...rest }) => <Body txs={txs} budgets={budgets.map(toPlain)} {...rest} />)

export default function Analytics() {
  const [mode, setMode] = useState('MONTH')
  const [offset, setOffset] = useState(0) // how many periods back from the current one
  const [trendMonths, setTrendMonths] = useState(6)
  const [opened, setOpened] = useState(null)
  const [requestDelete, undoBar] = useDeleteWithUndo()
  const [since] = useState(() => Date.now() - HISTORY_MONTHS * 31 * 86400000)
  const earliest = since + 31 * 86400000
  const monthLabelText = peekSettings().salarySource ? 'Pay cycle' : 'Month'

  const open = async (id) => {
    try { setOpened(await col('transactions').find(id)) } catch { /* deleted meanwhile */ }
  }
  const pickMode = (m) => { setMode(m); setOffset(0) }

  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.header}>Analytics</Text>
      <View style={styles.row}>
        <Chip label="Week" selected={mode === 'WEEK'} onPress={() => pickMode('WEEK')} />
        <Chip label={monthLabelText} selected={mode === 'MONTH'} onPress={() => pickMode('MONTH')} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <ObservedBody since={since} earliest={earliest} mode={mode} offset={offset} setOffset={setOffset}
          trendMonths={trendMonths} setTrendMonths={setTrendMonths} onOpen={open} />
      </ScrollView>
      {opened ? <TransactionDetail transaction={opened} onClose={() => setOpened(null)} onDelete={requestDelete} /> : null}
      {undoBar}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  monthLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  card: { marginBottom: 16 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: 12 },
  big: { color: COLORS.textPrimary, fontSize: 32, fontWeight: 'bold', fontVariant: ['tabular-nums'], marginBottom: 6 },
  sub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  stats: { flexDirection: 'row', marginTop: 14 },
  stat: { flex: 1 },
  statLabel: { color: COLORS.textSecondary, fontSize: 11 },
  statValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  center: { alignItems: 'center' },
  moverRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  moverName: { color: COLORS.textPrimary, fontSize: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.cardBorder },
  sparkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  sparkName: { color: COLORS.textPrimary, fontSize: 12, flex: 1, marginRight: 8 },
})
