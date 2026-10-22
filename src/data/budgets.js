import { col } from './util'
import { database } from '../db'

export const observeBudgets = () => col('budgets').query()
export const fetchBudgets = () => col('budgets').query().fetch()

/** One budget per category: setting it again changes the amount. */
export const saveBudget = async (category, amount) => {
  const existing = (await fetchBudgets()).find(b => b.category === category)
  if (existing) return database.write(() => existing.update(b => { b.amount = amount }))
  return database.write(() =>
    col('budgets').create(b => {
      b.category = category
      b.amount = amount
      b.created_at = Date.now()
    })
  )
}

export const deleteBudget = (budget) => database.write(() => budget.destroyPermanently())
