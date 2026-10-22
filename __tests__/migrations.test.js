import { stepsForMigration } from '@nozbe/watermelondb/Schema/migrations/stepsForMigration'
import schema from '../src/db/schema'
import migrations from '../src/db/migrations'

// Column sets exactly as shipped in schema v1 (commit 7af465e).
const V1 = {
  transactions: ['amount', 'merchant', 'type', 'timestamp', 'category', 'source', 'raw_text', 'external_id', 'needs_review'],
  merchant_rules: ['pattern', 'mapped_merchant', 'category'],
  credit_cards: ['name', 'limit', 'current_spend'],
  subscriptions: ['name', 'amount', 'billing_cycle', 'next_billing_date'],
}

describe('schema v1 -> v2 migration', () => {
  const steps = stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 })

  test('schema is at v2 and a v1->v2 path exists', () => {
    expect(schema.version).toBe(2)
    expect(steps).toBeTruthy()
  })

  test('adds every column that is new in v2, on the right table', () => {
    const added = {}
    for (const step of steps) {
      if (step.type === 'add_columns') added[step.table] = step.columns.map(c => c.name)
    }
    for (const [table, oldCols] of Object.entries(V1)) {
      const now = Object.keys(schema.tables[table].columns).filter(c => c !== 'id')
      const expectedNew = now.filter(c => !oldCols.includes(c)).sort()
      expect((added[table] || []).sort()).toEqual(expectedNew)
    }
  })

  test('creates the accounts table with the same columns as the schema', () => {
    const create = steps.find(s => s.type === 'create_table')
    expect(create.schema.name).toBe('accounts')
    const migrated = create.schema.columnArray.map(c => c.name).sort()
    expect(migrated).toEqual(Object.keys(schema.tables.accounts.columns).sort())
  })

  test('migrated column definitions match the schema (type and optionality)', () => {
    for (const step of steps) {
      if (step.type !== 'add_columns') continue
      for (const col of step.columns) {
        const def = schema.tables[step.table].columns[col.name]
        expect(def.type).toBe(col.type)
        expect(!!def.isOptional).toBe(!!col.isOptional)
      }
    }
  })
})
