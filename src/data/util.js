import { database } from '../db'

export const col = (name) => database.collections.get(name)

/** Plain-object snapshot of a model: safe for pure functions and memoised props. */
export const toPlain = (model) => {
  const out = { id: model.id }
  for (const key of Object.keys(model.collection.schema.columns)) out[key] = model[key]
  return out
}

export const write = (fn) => database.write(fn)
