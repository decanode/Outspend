import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import Transaction from './models/Transaction'
import MerchantRule from './models/MerchantRule'
import CreditCard from './models/CreditCard'
import Subscription from './models/Subscription'

const adapter = new SQLiteAdapter({
  schema,
  // (You might want to comment out or remove jsi: true if you encounter build issues with the adapter)
  jsi: true, 
  onSetUpError: error => {
    console.error("Database setup error:", error)
  }
})

export const database = new Database({
  adapter,
  modelClasses: [
    Transaction,
    MerchantRule,
    CreditCard,
    Subscription
  ],
})
