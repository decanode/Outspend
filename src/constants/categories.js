export const CATEGORIES = [
  { name: 'Housing', color: '#3b82f6', icon: 'home' },
  { name: 'Food & Dining', color: '#10b981', icon: 'restaurant' },
  { name: 'Transport', color: '#f59e0b', icon: 'car' },
  { name: 'Entertainment', color: '#ef476f', icon: 'film' },
  { name: 'Shopping', color: '#8b5cf6', icon: 'bag' },
  { name: 'Bills & Utilities', color: '#06b6d4', icon: 'flash' },
  { name: 'Healthcare', color: '#ec4899', icon: 'medkit' },
  { name: 'Other', color: '#94a3b8', icon: 'ellipsis-horizontal' },
]

export const UNCATEGORIZED = 'Uncategorized'

export const CATEGORY_NAMES = CATEGORIES.map(c => c.name)

export const categoryColor = (name) =>
  (CATEGORIES.find(c => c.name === name) || { color: '#64748b' }).color

// Merchant keywords that mean the same thing everywhere. Country-specific merchants live in the
// region's SMS profile (src/regions/profiles.js). Lowercase keyword -> category.
export const KEYWORD_CATEGORIES = [
  ['mcdonald', 'Food & Dining'], ['starbucks', 'Food & Dining'], ['restaurant', 'Food & Dining'], ['cafe', 'Food & Dining'],
  ['uber', 'Transport'], ['metro', 'Transport'], ['petrol', 'Transport'], ['fuel', 'Transport'],
  ['netflix', 'Entertainment'], ['spotify', 'Entertainment'], ['primevideo', 'Entertainment'], ['youtube', 'Entertainment'],
  ['amazon', 'Shopping'],
  ['electricity', 'Bills & Utilities'], ['broadband', 'Bills & Utilities'], ['recharge', 'Bills & Utilities'], ['gas', 'Bills & Utilities'],
  ['pharmacy', 'Healthcare'], ['hospital', 'Healthcare'],
  ['rent', 'Housing'], ['maintenance', 'Housing'],
]
