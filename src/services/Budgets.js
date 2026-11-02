export const OVERALL = 'ALL'
const DAY = 86400000

export const levelFor = (ratio) => (ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok')

/**
 * budgets: [{ id, category, amount }] (category 'ALL' = overall monthly cap)
 * spend: aggregateSpend() result for the current month
 * monthEnd: exclusive end of the month; now: current time
 */
export const budgetStatus = (budgets, spend, monthEnd, now = Date.now()) => {
  const byCategory = new Map(spend.categories.map(c => [c.name, c.amount]))
  const daysLeft = Math.max(1, Math.ceil((monthEnd - now) / DAY)) // today counts

  const rows = budgets.map(b => {
    const spent = b.category === OVERALL ? spend.total : byCategory.get(b.category) || 0
    const ratio = b.amount > 0 ? spent / b.amount : 0
    return {
      id: b.id,
      category: b.category,
      amount: b.amount,
      spent,
      remaining: b.amount - spent,
      ratio,
      level: levelFor(ratio),
      dailyAllowance: Math.max(b.amount - spent, 0) / daysLeft,
    }
  })
  return {
    overall: rows.find(r => r.category === OVERALL) || null,
    categories: rows.filter(r => r.category !== OVERALL).sort((a, b) => b.ratio - a.ratio),
    daysLeft,
  }
}

/** Progress of a savings goal against what you typically save per month. */
export const goalProgress = (goal, monthlySurplus, now = Date.now()) => {
  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0)
  const monthsLeft = goal.target_date > now ? Math.max(1, Math.ceil((goal.target_date - now) / (30.44 * DAY))) : 0
  const required = remaining > 0 && monthsLeft > 0 ? remaining / monthsLeft : 0
  return {
    pct: goal.target_amount > 0 ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100)) : 0,
    remaining,
    monthsLeft,
    requiredPerMonth: required,
    done: remaining === 0,
    overdue: remaining > 0 && monthsLeft === 0,
    onTrack: remaining === 0 || (monthsLeft > 0 && monthlySurplus >= required),
  }
}
