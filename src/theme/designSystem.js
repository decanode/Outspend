export const COLORS = {
  background: '#0d1b2a',
  textPrimary: '#e0e1dd',
  textSecondary: '#a3b18a',
  emerald: '#10b981', // Positive
  coral: '#ef476f', // Expenses/Negative
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  cardFill: 'rgba(255, 255, 255, 0.08)' // 10-15% semi-transparent white fills
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
