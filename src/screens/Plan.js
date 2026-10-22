import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { Q } from '@nozbe/watermelondb'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { categoryColor } from '../constants/categories'
import { aggregateSpend, formatMoney } from '../services/Analytics'
import { makePeriod, averageSurplus } from '../services/Insights'
import { budgetStatus, goalProgress } from '../services/Budgets'
import { detectSalary, upcomingBills, owedByPerson } from '../services/Planning'
import { col, toPlain, watch } from '../data/util'
import { observeBudgets, saveBudget, deleteBudget } from '../data/budgets'
import { observeGoals, createGoal, updateGoal, addToGoal, deleteGoal } from '../data/goals'
import { observeSubscriptions } from '../data/subscriptions'
import { observeSplits, settlePerson } from '../data/splits'
import { afterChange } from '../services/PostChange'
import { Button, EmptyState, SectionTitle, screenStyles } from '../components/ui'
import { HBar, Pill } from '../components/charts'
import { BudgetForm, GoalForm, AddMoneyForm } from '../components/PlanForms'
import { formatDate } from '../utils/format'

const LEVEL_COLOR = { ok: COLORS.emerald, warning: COLORS.amber, over: COLORS.coral }

const Card = ({ children, style }) => <View style={[GLASS_STYLES.card, styles.card, style]}>{children}</View>

const Plan = ({ budgets, goals, subs, splits, recent }) => {
  const [budgetForm, setBudgetForm] = useState(null) // null | {} (new) | budget
  const [goalForm, setGoalForm] = useState(null)
  const [moneyGoal, setMoneyGoal] = useState(null)

  const { status, salary, bills, owed, surplus } = useMemo(() => {
    const plainTxs = recent.map(toPlain)
    const month = makePeriod('MONTH')
    return {
      status: budgetStatus(budgets.map(toPlain), aggregateSpend(plainTxs, month.start, month.end), month.end),
      salary: detectSalary(plainTxs),
      bills: upcomingBills(subs.map(toPlain)),
      owed: owedByPerson(splits.map(toPlain)),
      surplus: averageSurplus(plainTxs),
    }
  }, [budgets, recent, subs, splits])

  const refresh = () => afterChange().catch(() => {})

  const saveBudgetForm = async ({ category, amount }) => {
    setBudgetForm(null)
    await saveBudget(category, amount)
    refresh()
  }

  const settle = (p) =>
    Alert.alert(`Settle with ${p.person}?`, `Mark ${formatMoney(p.owed)} (${p.count} payment${p.count === 1 ? '' : 's'}) as received.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark settled', onPress: () => settlePerson(p.person) },
    ])

  const o = status.overall
  return (
    <View style={screenStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={screenStyles.header}>Plan</Text>

        {salary ? (
          <Card>
            <Text style={styles.title}>{salary.daysUntil === 0 ? 'Payday is today' : salary.daysUntil === 1 ? 'Payday is tomorrow' : `Payday in ${salary.daysUntil} days`}</Text>
            <Text style={styles.sub}>About {formatMoney(Math.round(salary.amount))} from {salary.merchant}, around the {salary.day}{ordinal(salary.day)} of each month.</Text>
          </Card>
        ) : null}

        <SectionTitle right={<Text style={styles.link} onPress={() => setBudgetForm({})}>+ Budget</Text>}>Budgets this month</SectionTitle>
        {budgets.length === 0 ? (
          <EmptyState title="No budgets yet" hint="Set an overall monthly cap or limits per category and get a nudge at 80% and 100%." />
        ) : (
          <>
            {o ? (
              <Card>
                <TouchableOpacity onPress={() => setBudgetForm(budgets.find(b => b.id === o.id))}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.title}>Monthly cap</Text>
                    <Pill text={o.level === 'over' ? 'Over budget' : o.level === 'warning' ? 'Close to the limit' : 'On track'} color={LEVEL_COLOR[o.level]} />
                  </View>
                  <HBar label={`${formatMoney(o.spent)} of ${formatMoney(o.amount)}`} value={`${Math.round(o.ratio * 100)}%`} ratio={o.ratio} color={LEVEL_COLOR[o.level]} />
                  <Text style={styles.sub}>
                    {o.level === 'over'
                      ? `${formatMoney(-o.remaining)} over the cap.`
                      : `You can spend about ${formatMoney(Math.round(o.dailyAllowance))} a day for the next ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'}.`}
                  </Text>
                </TouchableOpacity>
              </Card>
            ) : null}
            {status.categories.map(c => (
              <TouchableOpacity key={c.id} onPress={() => setBudgetForm(budgets.find(b => b.id === c.id))}>
                <Card>
                  <HBar label={c.category} value={`${formatMoney(c.spent)} / ${formatMoney(c.amount)}`} ratio={c.ratio} color={c.level === 'ok' ? categoryColor(c.category) : LEVEL_COLOR[c.level]}
                    right={c.level === 'over' ? `${formatMoney(-c.remaining)} over` : `${formatMoney(c.remaining)} left`} />
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        <SectionTitle right={<Text style={styles.link} onPress={() => setGoalForm({})}>+ Goal</Text>}>Savings goals</SectionTitle>
        {goals.length === 0 ? (
          <EmptyState title="No goals yet" hint="Pick something to save for. The app shows what you need to put aside each month." />
        ) : goals.map(g => {
          const p = goalProgress(toPlain(g), surplus)
          return (
            <Card key={g.id}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{g.name}</Text>
                <Text style={styles.link} onPress={() => setGoalForm(g)}>Edit</Text>
              </View>
              <HBar label={`${formatMoney(g.saved_amount)} of ${formatMoney(g.target_amount)}`} value={`${p.pct}%`} ratio={p.pct / 100} color={p.done ? COLORS.emerald : COLORS.blue} />
              <Text style={styles.sub}>
                {p.done ? 'Goal reached 🎉'
                  : p.overdue ? `Target date passed with ${formatMoney(p.remaining)} still to go.`
                  : `${formatMoney(Math.ceil(p.requiredPerMonth))}/month needed until ${formatDate(g.target_date)}. ${surplus > 0 ? `You typically keep about ${formatMoney(Math.round(surplus))}/month, so you are ${p.onTrack ? 'on track' : 'behind'}.` : 'Add income and spending history to see if you are on track.'}`}
              </Text>
              {!p.done ? <Button title="Add money" variant="ghost" onPress={() => setMoneyGoal(g)} style={{ alignSelf: 'flex-start' }} /> : null}
            </Card>
          )
        })}

        <SectionTitle right={bills.dueThisWeek > 0 ? <Pill text={`Due this week ${formatMoney(bills.dueThisWeek)}`} color={COLORS.amber} /> : null}>Upcoming bills</SectionTitle>
        {bills.groups.length === 0 ? (
          <EmptyState title="Nothing due in the next 30 days" hint="Subscriptions you track in the Accounts tab show up here." />
        ) : (
          <Card>
            {bills.groups.map(g => (
              <View key={g.key} style={styles.billGroup}>
                <Text style={styles.billDate}>{formatDate(g.key)}</Text>
                {g.items.map(it => (
                  <View key={`${it.id}${it.date}`} style={styles.rowBetween}>
                    <Text style={styles.billName}>{it.name}</Text>
                    <Text style={styles.billAmount}>{formatMoney(it.amount)}</Text>
                  </View>
                ))}
              </View>
            ))}
            <Text style={styles.sub}>{formatMoney(bills.total)} in total over the next 30 days.</Text>
          </Card>
        )}

        <SectionTitle right={owed.total > 0 ? <Pill text={formatMoney(owed.total)} color={COLORS.emerald} /> : null}>Owed to you</SectionTitle>
        {owed.people.length === 0 ? (
          <EmptyState title="Nobody owes you anything" hint="Open a payment in the Ledger and choose Split to record who shared it." />
        ) : (
          <Card>
            {owed.people.map(p => (
              <View key={p.person} style={[styles.rowBetween, { paddingVertical: 8 }]}>
                <View>
                  <Text style={styles.title}>{p.person}</Text>
                  <Text style={styles.sub}>{p.count} payment{p.count === 1 ? '' : 's'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.title, { color: COLORS.emerald }]}>{formatMoney(p.owed)}</Text>
                  <Text style={styles.link} onPress={() => settle(p)}>Settle</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      <BudgetForm visible={!!budgetForm} budget={budgetForm && budgetForm.id ? budgetForm : null} onClose={() => setBudgetForm(null)}
        takenCategories={budgets.map(b => b.category)} onSave={saveBudgetForm}
        onDelete={() => { const b = budgetForm; setBudgetForm(null); deleteBudget(b).then(refresh) }} />
      <GoalForm visible={!!goalForm} goal={goalForm && goalForm.id ? goalForm : null} onClose={() => setGoalForm(null)}
        onSave={async (v) => {
          const g = goalForm && goalForm.id ? goalForm : null
          setGoalForm(null)
          if (g) await updateGoal(g, v)
          else await createGoal(v)
        }}
        onDelete={() => { const g = goalForm; setGoalForm(null); deleteGoal(g) }} />
      <AddMoneyForm visible={!!moneyGoal} goal={moneyGoal} onClose={() => setMoneyGoal(null)}
        onSave={async (amt) => { const g = moneyGoal; setMoneyGoal(null); await addToGoal(g, amt) }} />
    </View>
  )
}

const ordinal = (n) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th')

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  sub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  link: { color: COLORS.emerald, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billGroup: { marginBottom: 10 },
  billDate: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  billName: { color: COLORS.textPrimary, fontSize: 14 },
  billAmount: { color: COLORS.textPrimary, fontSize: 14, fontVariant: ['tabular-nums'] },
})

export default withObservables([], () => ({
  budgets: observeBudgets(),
  goals: observeGoals(),
  subs: observeSubscriptions(),
  splits: observeSplits(),
  // ~4 months of history feeds payday detection and the typical monthly surplus
  recent: watch(col('transactions').query(Q.where('is_deleted', false), Q.where('timestamp', Q.gte(Date.now() - 125 * 86400000)))),
}))(Plan)
