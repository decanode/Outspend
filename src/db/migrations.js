import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'transactions',
          columns: [{ name: 'currency', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'transactions',
          columns: [
            { name: 'transfer', type: 'string', isOptional: true },
            { name: 'tags', type: 'string', isOptional: true },
            { name: 'my_share', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'budgets',
          columns: [
            { name: 'category', type: 'string' },
            { name: 'amount', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'goals',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'target_amount', type: 'number' },
            { name: 'saved_amount', type: 'number' },
            { name: 'target_date', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'splits',
          columns: [
            { name: 'transaction_id', type: 'string', isIndexed: true },
            { name: 'person', type: 'string' },
            { name: 'amount', type: 'number' },
            { name: 'is_settled', type: 'boolean' },
            { name: 'settled_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'transactions',
          columns: [
            { name: 'is_deleted', type: 'boolean' },
            { name: 'account_id', type: 'string', isOptional: true },
            { name: 'card_id', type: 'string', isOptional: true },
            { name: 'last4', type: 'string', isOptional: true },
            { name: 'payment_mode', type: 'string', isOptional: true },
            { name: 'receipt_path', type: 'string', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'merchant_rule_id', type: 'string', isOptional: true },
            { name: 'linked_transaction_id', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        addColumns({
          table: 'credit_cards',
          columns: [
            { name: 'last4', type: 'string', isOptional: true },
            { name: 'billing_day', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'subscriptions',
          columns: [
            { name: 'merchant', type: 'string', isOptional: true },
            { name: 'is_active', type: 'boolean' },
            { name: 'detected_from_tx_id', type: 'string', isOptional: true },
            { name: 'notification_id', type: 'string', isOptional: true },
          ],
        }),
        createTable({
          name: 'accounts',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'balance', type: 'number' },
            { name: 'last_reconciled_at', type: 'number' },
            { name: 'last4', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
})
