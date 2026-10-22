import { col } from './util'
import { database } from '../db'
import { applyRuleToExisting } from './transactions'

export const observeRules = () => col('merchant_rules').query()
export const fetchRules = () => col('merchant_rules').query().fetch()

/** Create a rule and retroactively apply it to matching transactions. */
export const createRule = async ({ pattern, mapped_merchant, category }) => {
  const rule = await database.write(() =>
    col('merchant_rules').create(r => {
      r.pattern = pattern.trim()
      r.mapped_merchant = mapped_merchant.trim()
      r.category = category || null
    })
  )
  const updated = await applyRuleToExisting(rule)
  return { rule, updated }
}

export const updateRule = async (rule, patch) => {
  await database.write(() => rule.update(r => Object.assign(r, patch)))
  return applyRuleToExisting(rule)
}

export const deleteRule = (rule) => database.write(() => rule.destroyPermanently())
