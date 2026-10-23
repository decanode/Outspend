import AsyncStorage from '@react-native-async-storage/async-storage'

// Messages that came from a bank-like sender and mention money but were not turned into a transaction
// (looks like an offer, a failed payment, a reminder, or the direction was unclear). Keeping them
// visible means a missed transaction can be found and added by hand, instead of silently vanishing.

export const MAX_LOGGED = 100
export const MAX_DISMISSED = 500

export const REASON_LABELS = {
  promo: 'Looks like an offer or advert',
  failed: 'Looks like a failed or declined payment',
  reminder: 'Looks like a reminder or statement',
  no_direction: 'Could not tell if money came in or went out',
}

export const emptyState = () => ({ entries: [], dismissed: [] })

/** Add new entries (newest first, capped), ignoring ones already shown or dismissed. */
export const mergeSkipped = (state, incoming) => {
  const known = new Set([...state.entries.map(e => e.id), ...state.dismissed])
  const fresh = []
  for (const e of incoming) {
    if (known.has(e.id)) continue
    known.add(e.id)
    fresh.push(e)
  }
  if (!fresh.length) return state
  const entries = [...fresh, ...state.entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_LOGGED)
  return { entries, dismissed: state.dismissed }
}

/** Remove an entry and remember it so a later re-sync does not bring it back. */
export const dismissEntry = (state, id) => ({
  entries: state.entries.filter(e => e.id !== id),
  dismissed: [id, ...state.dismissed.filter(x => x !== id)].slice(0, MAX_DISMISSED),
})

const KEY = 'outspend:skipped:v1'

export const loadSkipped = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState()
  } catch {
    return emptyState()
  }
}

const save = async (state) => {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { console.error('Could not save skipped messages', e) }
  return state
}

export const logSkipped = async (entries) => {
  if (!entries || !entries.length) return
  const state = await loadSkipped()
  const next = mergeSkipped(state, entries)
  if (next !== state) await save(next)
}

export const dismissSkipped = async (id) => save(dismissEntry(await loadSkipped(), id))
export const clearSkipped = async () => save(emptyState())
