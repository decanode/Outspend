import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class MerchantRule extends Model {
  static table = 'merchant_rules'

  @field('pattern') pattern
  @field('mapped_merchant') mapped_merchant
  @field('category') category
}
