import { database } from '../db'

export const col = (name) => database.collections.get(name)

/** Plain-object snapshot of a model: safe for pure functions and memoised props. */
export const toPlain = (model) => {
  const out = { id: model.id }
  for (const key of Object.keys(model.collection.schema.columns)) out[key] = model[key]
  return out
}

export const write = (fn) => database.write(fn)

/**
 * Observe a query so it also re-emits when a column of a matching row changes. A plain
 * query.observe() only fires when rows are added or removed, which leaves lists stale after
 * an edit (rename, recategorise, reconcile). Use this for every list a screen shows.
 */
export const watch = (query) => query.observeWithColumns(Object.keys(query.collection.schema.columns))
