import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import migrations from './migrations'
import Transaction from './models/Transaction'
import MerchantRule from './models/MerchantRule'
import CreditCard from './models/CreditCard'
import Subscription from './models/Subscription'
import Account from './models/Account'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Remove jsi: true if the adapter fails to build on a given device/emulator.
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
    Subscription,
    Account
  ],
})
