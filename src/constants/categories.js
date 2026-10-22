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

// Lowercase keyword -> category. Used as the fallback after user merchant rules.
export const KEYWORD_CATEGORIES = [
  ['swiggy', 'Food & Dining'], ['zomato', 'Food & Dining'], ['dominos', 'Food & Dining'],
  ['mcdonald', 'Food & Dining'], ['starbucks', 'Food & Dining'], ['restaurant', 'Food & Dining'],
  ['cafe', 'Food & Dining'], ['bigbasket', 'Food & Dining'], ['blinkit', 'Food & Dining'],
  ['zepto', 'Food & Dining'], ['instamart', 'Food & Dining'],
  ['uber', 'Transport'], ['ola', 'Transport'], ['rapido', 'Transport'], ['irctc', 'Transport'],
  ['redbus', 'Transport'], ['metro', 'Transport'], ['fastag', 'Transport'], ['petrol', 'Transport'],
  ['fuel', 'Transport'],
  ['netflix', 'Entertainment'], ['spotify', 'Entertainment'], ['hotstar', 'Entertainment'],
  ['primevideo', 'Entertainment'], ['bookmyshow', 'Entertainment'], ['youtube', 'Entertainment'],
  ['amazon', 'Shopping'], ['flipkart', 'Shopping'], ['myntra', 'Shopping'], ['ajio', 'Shopping'],
  ['meesho', 'Shopping'],
  ['airtel', 'Bills & Utilities'], ['jio', 'Bills & Utilities'], ['vodafone', 'Bills & Utilities'],
  ['electricity', 'Bills & Utilities'], ['bescom', 'Bills & Utilities'], ['broadband', 'Bills & Utilities'],
  ['recharge', 'Bills & Utilities'], ['gas', 'Bills & Utilities'],
  ['pharmacy', 'Healthcare'], ['apollo', 'Healthcare'], ['hospital', 'Healthcare'],
  ['medplus', 'Healthcare'], ['1mg', 'Healthcare'], ['pharmeasy', 'Healthcare'],
  ['rent', 'Housing'], ['maintenance', 'Housing'],
]
