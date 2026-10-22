import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Transaction extends Model {
  static table = 'transactions'

  @field('amount') amount
  @field('merchant') merchant
  @field('type') type
  @field('timestamp') timestamp
  @field('category') category
  @field('source') source
  @field('raw_text') raw_text
  @field('external_id') external_id
  @field('needs_review') needs_review
}
