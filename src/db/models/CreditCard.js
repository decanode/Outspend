import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class CreditCard extends Model {
  static table = 'credit_cards'

  @field('name') name
  @field('limit') limit
  @field('current_spend') current_spend
  @field('last4') last4
  @field('billing_day') billing_day
}
