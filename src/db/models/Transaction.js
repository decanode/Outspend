import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

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
  @field('is_deleted') is_deleted
  @field('account_id') account_id
  @field('card_id') card_id
  @field('last4') last4
  @field('payment_mode') payment_mode
  @field('receipt_path') receipt_path
  @field('notes') notes
  @field('merchant_rule_id') merchant_rule_id
  @field('linked_transaction_id') linked_transaction_id
  @field('transfer') transfer
  @field('tags') tags
  @field('my_share') my_share
  @field('created_at') created_at
  @field('updated_at') updated_at
}
