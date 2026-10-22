import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Subscription extends Model {
  static table = 'subscriptions'

  @field('name') name
  @field('amount') amount
  @field('billing_cycle') billing_cycle
  @field('next_billing_date') next_billing_date
}
