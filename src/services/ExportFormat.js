import { dateLocale, formatMoney, homeCurrency } from '../regions'

// Pure formatters for export. No I/O here so they can be unit-tested.

/** RFC 4180 field: quote when it holds a comma, quote or line break. */
export const csvField = (value) => {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const EXPORT_COLUMNS = ['Date', 'Merchant', 'Amount', 'Currency', 'Type', 'Category', 'Source', 'Account', 'Notes', 'Has receipt', 'Your share', 'Tags', 'Transfer']

const exportRow = (t, names = {}) => [
  new Date(t.timestamp).toISOString(),
  t.merchant,
  t.amount,
  t.currency || homeCurrency(),
  t.type,
  t.category || '',
  t.source,
  names[t.account_id] || names[t.card_id] || '',
  t.notes || '',
  t.receipt_path ? 'Yes' : 'No',
  t.my_share === null || t.my_share === undefined ? '' : t.my_share,
  t.tags || '',
  t.transfer === 'AUTO' || t.transfer === 'USER' ? 'Yes' : 'No',
]

export const toCsv = (txs, names = {}) =>
  [EXPORT_COLUMNS, ...txs.map(t => exportRow(t, names))]
    .map(row => row.map(csvField).join(','))
    .join('\r\n') + '\r\n'

export const toJson = (txs, names = {}) =>
  JSON.stringify({
    app: 'Outspend',
    exportedAt: new Date().toISOString(),
    count: txs.length,
    transactions: txs.map(t => ({
      id: t.id,
      date: new Date(t.timestamp).toISOString(),
      merchant: t.merchant,
      amount: t.amount,
      currency: t.currency || homeCurrency(),
      type: t.type,
      category: t.category || null,
      source: t.source,
      account: names[t.account_id] || names[t.card_id] || null,
      notes: t.notes || null,
      yourShare: t.my_share === null || t.my_share === undefined ? null : t.my_share,
      tags: t.tags ? t.tags.split(',') : [],
      transfer: t.transfer === 'AUTO' || t.transfer === 'USER',
      linkedTransactionId: t.linked_transaction_id || null,
    })),
  }, null, 2)

export const escapeHtml = (s) =>
  String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const inr = (n) => formatMoney(n) // home-currency amounts, formatted for the active region

/** Printable bill for sharing a group expense. Only expenses are included. */
export const buildBillHtml = (txs, { title = 'Outspend Group Bill Summary', rangeLabel = '' } = {}) => {
  const rows = [...txs].sort((a, b) => a.timestamp - b.timestamp)
  const total = rows.reduce((s, t) => s + t.amount, 0)
  const body = rows.map(t => `
      <tr>
        <td>${escapeHtml(new Date(t.timestamp).toLocaleDateString(dateLocale()))}</td>
        <td>${escapeHtml(t.merchant)}</td>
        <td>${escapeHtml(t.category || '')}</td>
        <td style="text-align:right">${escapeHtml(inr(t.amount))}</td>
      </tr>`).join('')
  return `<html>
  <body style="font-family: sans-serif; padding: 20px;">
    <h1 style="color: #10b981;">${escapeHtml(title)}</h1>
    <p>${escapeHtml(rangeLabel)}</p>
    <table style="width: 100%; text-align: left; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #ccc;"><th>Date</th><th>Merchant</th><th>Category</th><th style="text-align:right">Amount</th></tr>${body}
      <tr style="border-top: 2px solid #333; font-weight: bold;"><td colspan="3">Total</td><td style="text-align:right">${escapeHtml(inr(total))}</td></tr>
    </table>
  </body>
</html>`
}

const pctText = (p) => (p === null ? '' : `${p > 0 ? '+' : ''}${p}%`)

/** One-page report card for a week or month (analysis comes from Insights.analyzePeriod). */
export const buildReportHtml = (a, label) => {
  const cats = a.categories.slice(0, 5).map(c => `
      <tr><td>${escapeHtml(c.name)}</td><td style="text-align:right">${escapeHtml(inr(c.amount))}</td>
      <td style="text-align:right">${a.total > 0 ? Math.round((c.amount / a.total) * 100) : 0}%</td>
      <td style="text-align:right">${escapeHtml(pctText(c.deltaPct))}</td></tr>`).join('')
  const top = a.top.slice(0, 5).map(t => `
      <tr><td>${escapeHtml(new Date(t.timestamp).toLocaleDateString(dateLocale()))}</td><td>${escapeHtml(t.merchant)}</td>
      <td>${escapeHtml(t.category)}</td><td style="text-align:right">${escapeHtml(inr(t.amount))}</td></tr>`).join('')
  const riser = a.movers.up[0]
  return `<html>
  <body style="font-family: sans-serif; padding: 20px;">
    <h1 style="color: #10b981; margin-bottom: 0;">Outspend report</h1>
    <p style="margin-top: 4px;">${escapeHtml(label)}</p>
    <table style="width:100%; border-collapse: collapse; margin: 12px 0;">
      <tr><td>Spent</td><td style="text-align:right"><b>${escapeHtml(inr(a.total))}</b> ${escapeHtml(pctText(a.deltaPct))} vs previous</td></tr>
      <tr><td>Income</td><td style="text-align:right">${escapeHtml(inr(a.income))}</td></tr>
      <tr><td>Saved</td><td style="text-align:right">${escapeHtml(inr(Math.max(a.net, 0)))}${a.savingsRate === null ? '' : ` (${a.savingsRate}%)`}</td></tr>
      <tr><td>Average per day</td><td style="text-align:right">${escapeHtml(inr(Math.round(a.avgPerDay)))}</td></tr>
    </table>
    <h3>Top categories</h3>
    <table style="width:100%; border-collapse: collapse;">
      <tr style="border-bottom:1px solid #ccc"><th style="text-align:left">Category</th><th style="text-align:right">Spent</th><th style="text-align:right">Share</th><th style="text-align:right">Change</th></tr>${cats}
    </table>
    <h3>Largest purchases</h3>
    <table style="width:100%; border-collapse: collapse;">${top}</table>
    ${riser ? `<p>Biggest rise: <b>${escapeHtml(riser.name)}</b> (${escapeHtml(inr(riser.delta))} more than before).</p>` : ''}
  </body>
</html>`
}
