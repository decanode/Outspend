// In-memory WatermelonDB for integration tests (LokiJS adapter, no native code).
import { Database } from '@nozbe/watermelondb'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'
import schema from '../src/db/schema'
import Transaction from '../src/db/models/Transaction'
import MerchantRule from '../src/db/models/MerchantRule'
import CreditCard from '../src/db/models/CreditCard'
import Subscription from '../src/db/models/Subscription'
import Account from '../src/db/models/Account'
import Budget from '../src/db/models/Budget'
import Goal from '../src/db/models/Goal'
import Split from '../src/db/models/Split'

export const makeDatabase = () =>
  new Database({
    adapter: new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false }),
    modelClasses: [Transaction, MerchantRule, CreditCard, Subscription, Account, Budget, Goal, Split],
  })
