import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Split extends Model {
  static table = 'splits'

  @field('transaction_id') transaction_id
  @field('person') person
  @field('amount') amount
  @field('is_settled') is_settled
  @field('settled_at') settled_at
  @field('created_at') created_at
}
