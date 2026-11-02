import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Goal extends Model {
  static table = 'goals'

  @field('name') name
  @field('target_amount') target_amount
  @field('saved_amount') saved_amount
  @field('target_date') target_date
  @field('created_at') created_at
}
