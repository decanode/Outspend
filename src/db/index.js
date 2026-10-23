import { Platform } from 'react-native'
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import migrations from './migrations'
import Transaction from './models/Transaction'
import MerchantRule from './models/MerchantRule'
import CreditCard from './models/CreditCard'
import Subscription from './models/Subscription'
import Account from './models/Account'
import Budget from './models/Budget'
import Goal from './models/Goal'
import Split from './models/Split'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // JSI is the fast path and is what Android runs. On iOS the New Architecture (bridgeless) has not been
  // verified with WatermelonDB's JSI installer, so iOS uses the bridge adapter until it is tested on a device.
  // iOS only imports what the user shares, so the speed difference does not matter there.
  jsi: Platform.OS === 'android',
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
    Account,
    Budget,
    Goal,
    Split
  ],
})
