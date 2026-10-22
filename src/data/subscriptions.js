import { col } from './util'
import { database } from '../db'

export const observeSubscriptions = () => col('subscriptions').query()
export const fetchSubscriptions = () => col('subscriptions').query().fetch()

export const createSubscription = ({ name, merchant, amount, billing_cycle, next_billing_date, detected_from_tx_id }) =>
  database.write(() =>
    col('subscriptions').create(s => {
      s.name = name.trim()
      s.merchant = (merchant || name).trim()
      s.amount = amount
      s.billing_cycle = billing_cycle
      s.next_billing_date = next_billing_date
      s.is_active = true
      s.detected_from_tx_id = detected_from_tx_id || null
    })
  )

export const updateSubscription = (sub, patch) => database.write(() => sub.update(s => Object.assign(s, patch)))
export const deleteSubscription = (sub) => database.write(() => sub.destroyPermanently())
