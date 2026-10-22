import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { fetchSubscriptions, updateSubscription } from '../data/subscriptions'
import { fetchLiveTransactions, fetchTransactionsBetween } from '../data/transactions'
import { col, toPlain } from '../data/util'
import { rollForward } from './SubscriptionDetector'
import { fetchBudgets } from '../data/budgets'
import { budgetStatus } from './Budgets'
import { makePeriod } from './Insights'
import { cardSpend, cycleStart, utilisation, utilisationLevel, formatINR, aggregateSpend } from './Analytics'
import { getSettings, updateSettings } from './Settings'
import { nameTransactionById } from '../data/naming'

const CHANNEL_ID = 'reminders'
const REMINDER_LEAD_DAYS = 3
const REMINDER_HOUR = 9

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// No ':' or '-' in category ids (expo-notifications limitation).
const NEEDS_NAME_CATEGORY = 'needsvendor'
const NAME_ACTION = 'NAME'

/** Channel + the "who was this to?" reply action. Idempotent; also called from the SMS task. */
export const ensureNotificationSetup = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders & alerts',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  await Notifications.setNotificationCategoryAsync(NEEDS_NAME_CATEGORY, [
    {
      identifier: NAME_ACTION,
      buttonTitle: 'Name it',
      textInput: { submitButtonTitle: 'Save', placeholder: 'Who was this to?' },
      // The reply is delivered to JS, which needs the app process; opening it is the reliable way.
      options: { opensAppToForeground: true },
    },
  ])
}

/** Create the Android channel, then ask for permission. Returns whether it was granted. */
export const initNotifications = async () => {
  await ensureNotificationSetup()
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  const req = await Notifications.requestPermissionsAsync()
  return !!req.granted
}

export const reminderDate = (nextBillingDate) => {
  const d = new Date(nextBillingDate)
  d.setDate(d.getDate() - REMINDER_LEAD_DAYS)
  d.setHours(REMINDER_HOUR, 0, 0, 0)
  return d
}

const cancelById = async (id) => {
  if (!id) return
  try { await Notifications.cancelScheduledNotificationAsync(id) } catch { /* already gone */ }
}

/** (Re)schedule the 3-day renewal reminder for one subscription. Safe to call repeatedly. */
export const scheduleSubscriptionReminder = async (sub) => {
  await cancelById(sub.notification_id)
  if (!sub.is_active) {
    if (sub.notification_id) await updateSubscription(sub, { notification_id: null })
    return null
  }
  const when = reminderDate(sub.next_billing_date)
  if (when.getTime() <= Date.now()) {
    if (sub.notification_id) await updateSubscription(sub, { notification_id: null })
    return null
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Subscription renewal alert',
      body: `Your ${sub.name} subscription of ${formatINR(sub.amount)} renews in ${REMINDER_LEAD_DAYS} days.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: CHANNEL_ID,
    },
  })
  await updateSubscription(sub, { notification_id: id })
  return id
}

export const cancelSubscriptionReminder = (sub) => cancelById(sub.notification_id)

/** Warn once per cycle per threshold when a credit card nears its limit. */
export const checkCardLimits = async () => {
  const [cards, txs, settings] = await Promise.all([
    col('credit_cards').query().fetch(),
    fetchLiveTransactions(),
    getSettings(),
  ])
  const alerts = { ...settings.cardAlerts }
  let changed = false
  for (const model of cards) {
    const card = toPlain(model)
    if (!(card.limit > 0)) continue
    const ratio = utilisation(cardSpend(card, txs), card.limit)
    const level = utilisationLevel(ratio)
    const cycle = cycleStart(card.billing_day)
    const seen = alerts[card.id]
    const alreadyNotified = seen && seen.cycle === cycle && (seen.level === level || seen.level === 'critical')
    if (level === 'ok' || alreadyNotified) continue
    await Notifications.scheduleNotificationAsync({
      content: {
        title: level === 'critical' ? 'Credit limit almost reached' : 'Credit limit warning',
        body: `${card.name} is at ${Math.round(ratio * 100)}% of its ${formatINR(card.limit)} limit.`,
      },
      trigger: null,
    })
    alerts[card.id] = { cycle, level }
    changed = true
  }
  if (changed) await updateSettings({ cardAlerts: alerts })
}

/**
 * Roll lapsed billing dates forward, reschedule every reminder and re-check card limits.
 * Called on app start, after sync, and whenever subscriptions change.
 */
export const refreshReminders = async () => {
  const perm = await Notifications.getPermissionsAsync()
  const subs = await fetchSubscriptions()
  for (const sub of subs) {
    if (sub.is_active && sub.next_billing_date <= Date.now()) {
      await updateSubscription(sub, { next_billing_date: rollForward(sub.next_billing_date, sub.billing_cycle) })
    }
    if (perm.granted) await scheduleSubscriptionReminder(sub)
  }
  if (perm.granted) await checkCardLimits()
}

/**
 * Immediate notification for a transaction whose payee we could not work out. Tapping it
 * opens the app (Needs attention card); the "Name it" action takes the name inline.
 */
export const notifyNeedsName = async (tx) => {
  const perm = await Notifications.getPermissionsAsync()
  if (!perm.granted) return null
  await ensureNotificationSetup()
  const incoming = tx.type === 'CREDIT' || tx.type === 'REFUND'
  const mode = tx.payment_mode ? ` via ${tx.payment_mode}` : ''
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${formatINR(tx.amount)} ${incoming ? 'received' : 'paid'}${mode}`,
      body: incoming ? 'Who was this from? Tap to name it.' : 'Who was this to? Tap to name it.',
      categoryIdentifier: NEEDS_NAME_CATEGORY,
      data: { transactionId: tx.id },
    },
    trigger: null,
  })
}

/**
 * Handle the user's reply from the notification. Returns true when it was a name reply.
 */
export const handleNotificationResponse = async (response) => {
  if (!response || response.actionIdentifier !== NAME_ACTION) return false
  const id = response.notification.request.content.data && response.notification.request.content.data.transactionId
  const name = (response.userText || '').trim()
  if (!id || !name) return false
  await nameTransactionById(id, name)
  return true
}

/** Generic heads-up (unusual spend, duplicate charge, budget). Skipped without notification permission. */
export const notifyAlert = async (title, body, data = {}) => {
  const perm = await Notifications.getPermissionsAsync()
  if (!perm.granted) return null
  await ensureNotificationSetup()
  return Notifications.scheduleNotificationAsync({ content: { title, body, data }, trigger: null })
}

const LEVEL_RANK = { ok: 0, warning: 1, over: 2 }

/**
 * Tell the user when a budget reaches 80% or 100% for the month. Each level is announced
 * once per budget per month.
 */
export const checkBudgets = async () => {
  const settings = await getSettings()
  if (!settings.alertsBudget) return
  const budgets = (await fetchBudgets()).map(toPlain)
  if (!budgets.length) return

  const month = makePeriod('MONTH')
  const txs = await fetchTransactionsBetween(month.start, month.end)
  const status = budgetStatus(budgets, aggregateSpend(txs, month.start, month.end), month.end)
  const alerts = {}
  for (const [k, v] of Object.entries(settings.budgetAlerts || {})) if (k.startsWith(`${month.start}:`)) alerts[k] = v

  let changed = Object.keys(alerts).length !== Object.keys(settings.budgetAlerts || {}).length
  for (const row of [status.overall, ...status.categories].filter(Boolean)) {
    const key = `${month.start}:${row.id}`
    if (LEVEL_RANK[row.level] <= LEVEL_RANK[alerts[key] || 'ok']) continue
    const name = row.category === 'ALL' ? 'Monthly budget' : `${row.category} budget`
    await notifyAlert(
      row.level === 'over' ? `${name} exceeded` : `${name} at ${Math.round(row.ratio * 100)}%`,
      `${formatINR(row.spent)} spent of ${formatINR(row.amount)}.`
    )
    alerts[key] = row.level
    changed = true
  }
  if (changed) await updateSettings({ budgetAlerts: alerts })
}
