import { KEYWORD_CATEGORIES } from '../constants/categories'
import { extractVpa } from './RegexEngine'

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

export const keywordCategory = (text) => {
  const hay = (text || '').toLowerCase()
  if (!hay) return null
  const hit = KEYWORD_CATEGORIES.find(([kw]) => hay.includes(kw))
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
