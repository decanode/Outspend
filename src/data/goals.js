import { col } from './util'
import { database } from '../db'

export const observeGoals = () => col('goals').query()

export const createGoal = ({ name, target_amount, target_date, saved_amount = 0 }) =>
  database.write(() =>
    col('goals').create(g => {
      g.name = name.trim()
      g.target_amount = target_amount
      g.saved_amount = saved_amount
      g.target_date = target_date
      g.created_at = Date.now()
    })
  )

export const updateGoal = (goal, patch) => database.write(() => goal.update(g => Object.assign(g, patch)))
export const addToGoal = (goal, amount) =>
  updateGoal(goal, { saved_amount: Math.max(0, goal.saved_amount + amount) })
export const deleteGoal = (goal) => database.write(() => goal.destroyPermanently())
