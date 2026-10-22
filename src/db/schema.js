import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'amount', type: 'number' },
        { name: 'merchant', type: 'string' },
        { name: 'type', type: 'string' }, // DEBIT, CREDIT, REFUND
        { name: 'timestamp', type: 'number' },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'source', type: 'string' }, // SMS, GMAIL, MANUAL, VERIFIED_SMS
        { name: 'raw_text', type: 'string', isOptional: true },
        { name: 'external_id', type: 'string', isOptional: true },
        { name: 'needs_review', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'merchant_rules',
      columns: [
        { name: 'pattern', type: 'string' }, // e.g., 'UPI string'
        { name: 'mapped_merchant', type: 'string' },
        { name: 'category', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'credit_cards',
      columns: [
        { name: 'name', type: 'string' }, // e.g., 'SBI Cashback'
        { name: 'limit', type: 'number' },
        { name: 'current_spend', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'subscriptions',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'billing_cycle', type: 'string' }, // e.g., 'MONTHLY', 'YEARLY'
        { name: 'next_billing_date', type: 'number' },
      ]
    }),
  ]
})
