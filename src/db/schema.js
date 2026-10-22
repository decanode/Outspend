import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'amount', type: 'number' },
        { name: 'merchant', type: 'string' },
        { name: 'type', type: 'string' }, // DEBIT, CREDIT, REFUND
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'source', type: 'string' }, // SMS, GMAIL, MANUAL, VOICE, VERIFIED_SMS
        { name: 'raw_text', type: 'string', isOptional: true },
        { name: 'external_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'needs_review', type: 'boolean' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'account_id', type: 'string', isOptional: true },
        { name: 'card_id', type: 'string', isOptional: true },
        { name: 'last4', type: 'string', isOptional: true },
        { name: 'payment_mode', type: 'string', isOptional: true }, // UPI, CARD, NEFT, ATM...
        { name: 'receipt_path', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'merchant_rule_id', type: 'string', isOptional: true },
        { name: 'linked_transaction_id', type: 'string', isOptional: true }, // refund -> original debit
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'merchant_rules',
      columns: [
        { name: 'pattern', type: 'string' }, // substring, or /regex/ ; matched against merchant + raw text
        { name: 'mapped_merchant', type: 'string' },
        { name: 'category', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'credit_cards',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'limit', type: 'number' },
        { name: 'current_spend', type: 'number' },
        { name: 'last4', type: 'string', isOptional: true },
        { name: 'billing_day', type: 'number', isOptional: true }, // day of month the cycle starts
      ]
    }),
    tableSchema({
      name: 'subscriptions',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'billing_cycle', type: 'string' }, // MONTHLY, YEARLY
        { name: 'next_billing_date', type: 'number' },
        { name: 'merchant', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'detected_from_tx_id', type: 'string', isOptional: true },
        { name: 'notification_id', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'accounts',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' }, // SAVINGS, WALLET, CASH
        { name: 'balance', type: 'number' }, // balance as of last_reconciled_at
        { name: 'last_reconciled_at', type: 'number' },
        { name: 'last4', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ]
    }),
  ]
})
