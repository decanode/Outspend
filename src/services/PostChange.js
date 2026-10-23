import { reconcileTransfers } from '../data/transfers'
import { fetchTransactionsBetween } from '../data/transactions'
import { detectAnomalies } from './Anomaly'
import { checkBudgets, notifyAlert } from './NotificationService'
import { refreshWidget } from './WidgetSync'
import { getSettings } from './Settings'

const swallow = (label) => (e) => console.error(`${label} failed`, e)

/**
 * Housekeeping after anything changes the transactions (manual edits, imports).
 * Pairs transfers, re-checks budgets and refreshes the widget.
 */
export const afterChange = async () => {
  await reconcileTransfers().catch(swallow('Transfer pairing'))
  await checkBudgets().catch(swallow('Budget check'))
  await refreshWidget().catch(swallow('Widget refresh'))
}

/**
 * Same, plus spend alerts for transactions that were just captured from SMS.
 * createdTx: the rows ingestMessages reported as new.
 */
export const afterLiveCapture = async (createdTx) => {
  await reconcileTransfers().catch(swallow('Transfer pairing'))
  const settings = await getSettings()
  if (settings.alertsAnomaly && createdTx.some(t => t.type === 'DEBIT')) {
    try {
      const now = Date.now()
      const history = await fetchTransactionsBetween(now - 180 * 86400000, now + 1)
      for (const created of createdTx.filter(t => t.type === 'DEBIT')) {
        const tx = history.find(h => h.id === created.id) || created // re-read: pairing may have flagged it
        for (const a of detectAnomalies(tx, history)) {
          await notifyAlert(a.kind === 'DUPLICATE' ? 'Possible duplicate charge' : 'Unusual spend', a.message, { transactionId: tx.id })
        }
      }
    } catch (e) {
      console.error('Anomaly check failed', e)
    }
  }
  await checkBudgets().catch(swallow('Budget check'))
  await refreshWidget().catch(swallow('Widget refresh'))
}
