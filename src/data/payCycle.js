import { Q } from '@nozbe/watermelondb'
import { col, toPlain } from './util'
import { getSettings, updateSettings } from '../services/Settings'
import { resolveMonthPeriod, salaryKey } from '../services/PayCycle'
import { makePeriod } from '../services/Insights'

const DAY = 86400000

/** Credits from the last `days` days: all that is needed to find salary credits. */
export const fetchCreditHistory = async (days = 400) =>
  (await col('transactions').query(
    Q.where('is_deleted', false), Q.where('type', 'CREDIT'), Q.where('timestamp', Q.gte(Date.now() - days * DAY))
  ).fetch()).map(toPlain)

/** The period that stands in for "this month": the pay cycle when a salary is confirmed, else the calendar month. */
export const currentBudgetPeriod = async (now = Date.now()) => {
  const [settings, credits] = await Promise.all([getSettings(), fetchCreditHistory()])
  return resolveMonthPeriod(now, settings.salarySource, credits, (ts) => makePeriod('MONTH', ts), now)
}

export const confirmSalarySource = (merchant) => updateSettings({ salarySource: { key: salaryKey(merchant), merchant } })
export const clearSalarySource = () => updateSettings({ salarySource: null })

export const dismissSalaryCandidate = async (merchant) => {
  const s = await getSettings()
  return updateSettings({ salaryDismissed: [...new Set([...(s.salaryDismissed || []), salaryKey(merchant)])] })
}
