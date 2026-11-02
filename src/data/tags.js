import { Q } from '@nozbe/watermelondb'
import { col } from './util'
import { updateTransaction } from './transactions'
import { tagsToString, parseTags } from '../services/Planning'

export const setTags = (tx, text) => updateTransaction(tx, { tags: tagsToString(text) || null })

/** Every tag in use, most used first. */
export const allTags = async () => {
  const rows = await col('transactions').query(Q.where('is_deleted', false), Q.where('tags', Q.notEq(null))).fetch()
  const counts = new Map()
  for (const r of rows) for (const t of parseTags(r.tags)) counts.set(t, (counts.get(t) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag)
}
