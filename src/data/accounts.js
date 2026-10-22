import { col } from './util'
import { database } from '../db'

export const observeAccounts = () => col('accounts').query()
export const observeCards = () => col('credit_cards').query()

export const createAccount = ({ name, type, balance, last4 }) =>
  database.write(() =>
    col('accounts').create(a => {
      const now = Date.now()
      a.name = name.trim()
      a.type = type
      a.balance = balance || 0 // opening balance
      a.last_reconciled_at = now
      a.last4 = last4 || null
      a.created_at = now
    })
  )

export const updateAccount = (account, patch) => database.write(() => account.update(a => Object.assign(a, patch)))

/** The user states the real balance: it becomes the new baseline from now on. */
export const reconcileAccount = (account, actualBalance) =>
  updateAccount(account, { balance: actualBalance, last_reconciled_at: Date.now() })

export const deleteAccount = (account) => database.write(() => account.destroyPermanently())

export const createCard = ({ name, limit, last4, billing_day }) =>
  database.write(() =>
    col('credit_cards').create(c => {
      c.name = name.trim()
      c.limit = limit
      c.current_spend = 0
      c.last4 = last4 || null
      c.billing_day = billing_day || 1
    })
  )

export const updateCard = (card, patch) => database.write(() => card.update(c => Object.assign(c, patch)))
export const deleteCard = (card) => database.write(() => card.destroyPermanently())
