import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Account extends Model {
  static table = 'accounts'

  @field('name') name
  @field('type') type
  @field('balance') balance
  @field('last_reconciled_at') last_reconciled_at
  @field('last4') last4
  @field('created_at') created_at
}
