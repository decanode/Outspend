export const COLORS = {
  background: '#0d1b2a',
  textPrimary: '#e0e1dd',
  textSecondary: '#a3b18a',
  emerald: '#10b981', // Positive
  coral: '#ef476f', // Expenses/Negative
  blue: '#3b82f6',
  amber: '#f59e0b',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  cardFill: 'rgba(255, 255, 255, 0.08)', // 10-15% semi-transparent white fills
  inputFill: 'rgba(0,0,0,0.2)',
  sheet: '#13263a',
}

export const GLASS_STYLES = {
  card: {
    backgroundColor: COLORS.cardFill,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
}
