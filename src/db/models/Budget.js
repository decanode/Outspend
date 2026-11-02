import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Budget extends Model {
  static table = 'budgets'

  @field('category') category
  @field('amount') amount
  @field('created_at') created_at
}
