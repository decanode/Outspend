import { updateWidget } from '../native/Widget'
import { fetchTransactionsBetween } from '../data/transactions'
import { fetchBudgets } from '../data/budgets'
import { toPlain } from '../data/util'
import { aggregateSpend, formatMoney } from './Analytics'
import { budgetStatus } from './Budgets'
import { currentBudgetPeriod } from '../data/payCycle'

/** Recompute "today's spend" and "budget left" for the home-screen widget. */
export const refreshWidget = async () => {
  const now = Date.now()
  const month = await currentBudgetPeriod(now)
  const txs = await fetchTransactionsBetween(month.start, month.end)
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const todaySpend = aggregateSpend(txs, today.getTime(), today.getTime() + 86400000).total

  const budgets = (await fetchBudgets()).map(toPlain)
  const status = budgetStatus(budgets, aggregateSpend(txs, month.start, month.end), month.end, now)
  const left = status.overall
    ? `${formatMoney(Math.max(status.overall.remaining, 0))} left this ${month.mode === 'CYCLE' ? 'pay cycle' : 'month'}`
    : 'Set a budget in the Plan tab'
  await updateWidget(`Today ${formatMoney(todaySpend)}`, left)
}
