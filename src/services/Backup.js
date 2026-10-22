import { database } from '../db'
import { getSettings } from './Settings'

// Tables in restore order. Rows keep their ids so links (refunds, splits, accounts) survive.
const TABLES = ['transactions', 'merchant_rules', 'credit_cards', 'subscriptions', 'accounts', 'budgets', 'goals', 'splits']
const SETTINGS_KEYS = ['onboardingStartDate', 'lastImportedTimestamp', 'dismissedSubscriptions', 'region', 'currency', 'numberStyle', 'alertsAnomaly', 'alertsBudget']

const rowOf = (model) => {
  const row = { id: model.id }
  for (const c of Object.keys(model.collection.schema.columns)) row[c] = model[c] === undefined ? null : model[c]
  return row
}

export const buildBackupObject = async () => {
  const tables = {}
  for (const name of TABLES) tables[name] = (await database.collections.get(name).query().fetch()).map(rowOf)
  const s = await getSettings()
  const settings = {}
  for (const k of SETTINGS_KEYS) settings[k] = s[k]
  return { format: 'outspend-backup', version: 1, createdAt: Date.now(), tables, settings }
}

export const backupCounts = (obj) => Object.fromEntries(TABLES.map(t => [t, (obj.tables[t] || []).length]))

export const validateBackup = (obj) => {
  if (!obj || obj.format !== 'outspend-backup') throw new Error('Not an Outspend backup.')
  if (obj.version !== 1) throw new Error('This backup was made by a newer version of the app.')
  if (!obj.tables || typeof obj.tables !== 'object') throw new Error('The backup is empty or damaged.')
  for (const t of TABLES) {
    const rows = obj.tables[t] || []
    if (!Array.isArray(rows) || rows.some(r => !r || typeof r.id !== 'string')) throw new Error(`The backup is damaged (${t}).`)
  }
  return obj
}

/** Replace everything on this device with the backup. All-or-nothing: it runs in one write. */
export const restoreBackupObject = async (obj) => {
  validateBackup(obj)
  await database.write(async () => {
    await database.unsafeResetDatabase()
    const ops = []
    for (const name of TABLES) {
      const collection = database.collections.get(name)
      const columns = Object.keys(collection.schema.columns)
      for (const row of obj.tables[name] || []) {
        ops.push(collection.prepareCreate(r => {
          r._raw.id = row.id
          for (const c of columns) if (row[c] !== undefined) r[c] = row[c]
        }))
      }
    }
    for (let i = 0; i < ops.length; i += 400) await database.batch(...ops.slice(i, i + 400))
  })
  return backupCounts(obj)
}
