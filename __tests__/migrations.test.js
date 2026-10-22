import { stepsForMigration } from '@nozbe/watermelondb/Schema/migrations/stepsForMigration'
import schema from '../src/db/schema'
import migrations from '../src/db/migrations'

// Column sets exactly as shipped in schema v1 (commit 7af465e) and v2.
const V1 = {
  transactions: ['amount', 'merchant', 'type', 'timestamp', 'category', 'source', 'raw_text', 'external_id', 'needs_review'],
  merchant_rules: ['pattern', 'mapped_merchant', 'category'],
  credit_cards: ['name', 'limit', 'current_spend'],
  subscriptions: ['name', 'amount', 'billing_cycle', 'next_billing_date'],
}
const V2_TRANSACTIONS_EXTRA = ['is_deleted', 'account_id', 'card_id', 'last4', 'payment_mode', 'receipt_path', 'notes', 'merchant_rule_id', 'linked_transaction_id', 'created_at', 'updated_at']

const collect = (steps) => {
  const added = {}
  const created = {}
  for (const step of steps) {
    if (step.type === 'add_columns') added[step.table] = (added[step.table] || []).concat(step.columns)
    if (step.type === 'create_table') created[step.schema.name] = step.schema.columnArray
  }
  return { added, created }
}

const sameAsSchema = (table, cols) => {
  const defs = schema.tables[table].columns
  expect(cols.map(c => c.name).sort()).toEqual(Object.keys(defs).sort())
  for (const c of cols) {
    expect(defs[c.name].type).toBe(c.type)
    expect(!!defs[c.name].isOptional).toBe(!!c.isOptional)
  }
}

describe('schema migrations', () => {
  test('schema is at v3', () => expect(schema.version).toBe(3))

  test('v1 -> v2 adds every v2 column and the accounts table', () => {
    const steps = stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 })
    const { added, created } = collect(steps)
    const v2Tx = Object.keys(schema.tables.transactions.columns).filter(c => !V1.transactions.includes(c) && !['transfer', 'tags', 'my_share'].includes(c))
    expect((added.transactions || []).map(c => c.name).sort()).toEqual(v2Tx.sort())
    expect(v2Tx.sort()).toEqual([...V2_TRANSACTIONS_EXTRA].sort())
    expect(Object.keys(created)).toEqual(['accounts'])
    sameAsSchema('accounts', created.accounts)
  })

  test('v2 -> v3 adds transfer/tags/my_share and the budgets, goals, splits tables', () => {
    const steps = stepsForMigration({ migrations, fromVersion: 2, toVersion: 3 })
    const { added, created } = collect(steps)
    expect(added.transactions.map(c => c.name).sort()).toEqual(['my_share', 'tags', 'transfer'])
    for (const c of added.transactions) {
      expect(schema.tables.transactions.columns[c.name].type).toBe(c.type)
      expect(!!schema.tables.transactions.columns[c.name].isOptional).toBe(!!c.isOptional)
    }
    expect(Object.keys(created).sort()).toEqual(['budgets', 'goals', 'splits'])
    for (const [table, cols] of Object.entries(created)) sameAsSchema(table, cols)
  })

  test('a fresh v1 install can reach v3 in one go', () => {
    const steps = stepsForMigration({ migrations, fromVersion: 1, toVersion: 3 })
    expect(steps).toBeTruthy()
    const { added, created } = collect(steps)
    const allNewTx = Object.keys(schema.tables.transactions.columns).filter(c => !V1.transactions.includes(c))
    expect(added.transactions.map(c => c.name).sort()).toEqual(allNewTx.sort())
    expect(Object.keys(created).sort()).toEqual(['accounts', 'budgets', 'goals', 'splits'])
  })
})
