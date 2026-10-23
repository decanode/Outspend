import { KEYWORD_CATEGORIES } from '../constants/categories'
import { extractVpa } from './RegexEngine'
import { getRegion } from '../regions'

export const UNKNOWN_VENDOR = 'Unknown Vendor'

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toMatcher = (pattern) => {
  const p = (pattern || '').trim()
  if (!p) return null
  const regexLiteral = p.match(/^\/(.+)\/([gimsuy]*)$/)
  try {
    return regexLiteral
      ? new RegExp(regexLiteral[1], regexLiteral[2].replace('g', '') || 'i')
      : new RegExp(escapeRegExp(p), 'i')
  } catch {
    return null // invalid user regex: never matches
  }
}

export const ruleMatches = (rule, tx) => {
  const re = toMatcher(rule.pattern)
  if (!re) return false
  return re.test(tx.merchant || '') || re.test(tx.raw_text || '')
}

export const findRule = (rules, tx) => rules.find(r => ruleMatches(r, tx)) || null

// A keyword must start at a word boundary, and short ones must also end at one, so "tfl" does not
// match inside "netflix" and "gas" does not match "vegas".
const keywordRegexes = new Map()
const keywordRegex = (kw) => {
  if (!keywordRegexes.has(kw)) {
    const k = escapeRegExp(kw.trim())
    keywordRegexes.set(kw, new RegExp(`(?<![a-z0-9])${k}${kw.trim().length <= 4 ? '(?![a-z0-9])' : ''}`))
  }
  return keywordRegexes.get(kw)
}

export const keywordCategory = (text) => {
  const hay = (text || '').toLowerCase()
  if (!hay) return null
  const hit = [...getRegion().sms.keywordCategories, ...KEYWORD_CATEGORIES].find(([kw]) => keywordRegex(kw).test(hay))
  return hit ? hit[1] : null
}

/**
 * Decide merchant/category for a draft transaction.
 * Order: user rules -> keyword map -> needs_review.
 */
export const categorize = (tx, rules = []) => {
  const rule = findRule(rules, tx)
  if (rule) {
    return {
      merchant: rule.mapped_merchant || tx.merchant,
      category: rule.category || keywordCategory(rule.mapped_merchant) || null,
      merchant_rule_id: rule.id || null,
      needs_review: false,
    }
  }
  const known = tx.merchant && tx.merchant !== UNKNOWN_VENDOR
  return {
    merchant: tx.merchant,
    category: known ? keywordCategory(`${tx.merchant} ${tx.raw_text || ''}`) : null,
    merchant_rule_id: null,
    needs_review: !known,
  }
}

/** Best stable pattern for a "Save Rule" action on an unrecognised transaction. */
export const suggestPattern = (tx) => {
  const vpa = extractVpa(tx.raw_text)
  if (vpa) return vpa
  if (tx.merchant && tx.merchant !== UNKNOWN_VENDOR) return tx.merchant
  return null
}
