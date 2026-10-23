import { categorize, ruleMatches, suggestPattern, keywordCategory } from '../src/services/RuleEngine'

const rules = [
  { id: 'r1', pattern: 'chaiwala@ybl', mapped_merchant: 'Chai Point', category: 'Food & Dining' },
  { id: 'r2', pattern: '/^uber\\b/', mapped_merchant: 'Uber', category: 'Transport' },
  { id: 'r3', pattern: '/(broken', mapped_merchant: 'X', category: 'Other' },
]

describe('rules', () => {
  test('substring match on raw text', () => {
    expect(ruleMatches(rules[0], { merchant: 'Unknown Vendor', raw_text: 'credited to VPA chaiwala@ybl' })).toBe(true)
  })
  test('regex match, case-insensitive', () => {
    expect(ruleMatches(rules[1], { merchant: 'UBER INDIA', raw_text: '' })).toBe(true)
    expect(ruleMatches(rules[1], { merchant: 'Superuber', raw_text: '' })).toBe(false)
  })
  test('invalid regex never matches or throws', () => {
    expect(ruleMatches(rules[2], { merchant: '(broken', raw_text: '' })).toBe(false)
  })
  test('user rule wins and clears needs_review', () => {
    const out = categorize({ merchant: 'Unknown Vendor', raw_text: 'to VPA chaiwala@ybl' }, rules)
    expect(out).toMatchObject({ merchant: 'Chai Point', category: 'Food & Dining', merchant_rule_id: 'r1', needs_review: false })
  })
  test('keyword fallback', () => {
    expect(categorize({ merchant: 'Swiggy', raw_text: '' }, [])).toMatchObject({ category: 'Food & Dining', needs_review: false })
  })
  test('unknown vendor needs review', () => {
    expect(categorize({ merchant: 'Unknown Vendor', raw_text: 'x' }, [])).toMatchObject({ category: null, needs_review: true })
  })
  test('known merchant without keyword is uncategorised but not flagged', () => {
    expect(categorize({ merchant: 'Ramesh Kumar', raw_text: '' }, [])).toMatchObject({ category: null, needs_review: false })
  })
  test('keywordCategory', () => {
    expect(keywordCategory('IRCTC booking')).toBe('Transport')
    expect(keywordCategory('')).toBeNull()
  })
  test('suggestPattern prefers VPA', () => {
    expect(suggestPattern({ merchant: 'Unknown Vendor', raw_text: 'to VPA a.b@okaxis ref' })).toBe('a.b@okaxis')
    expect(suggestPattern({ merchant: 'Shop', raw_text: '' })).toBe('Shop')
    expect(suggestPattern({ merchant: 'Unknown Vendor', raw_text: 'nothing' })).toBeNull()
  })
})
