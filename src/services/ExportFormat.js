// Pure formatters for export. No I/O here so they can be unit-tested.

/** RFC 4180 field: quote when it holds a comma, quote or line break. */
export const csvField = (value) => {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const EXPORT_COLUMNS = ['Date', 'Merchant', 'Amount', 'Type', 'Category', 'Source', 'Account', 'Notes', 'Has receipt']

const exportRow = (t, names = {}) => [
  new Date(t.timestamp).toISOString(),
  t.merchant,
  t.amount,
  t.type,
  t.category || '',
  t.source,
  names[t.account_id] || names[t.card_id] || '',
  t.notes || '',
  t.receipt_path ? 'Yes' : 'No',
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
      type: t.type,
      category: t.category || null,
      source: t.source,
      account: names[t.account_id] || names[t.card_id] || null,
      notes: t.notes || null,
      linkedTransactionId: t.linked_transaction_id || null,
    })),
  }, null, 2)

export const escapeHtml = (s) =>
  String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const inr = (n) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })

/** Printable bill for sharing a group expense. Only expenses are included. */
export const buildBillHtml = (txs, { title = 'Outspend Group Bill Summary', rangeLabel = '' } = {}) => {
  const rows = [...txs].sort((a, b) => a.timestamp - b.timestamp)
  const total = rows.reduce((s, t) => s + t.amount, 0)
  const body = rows.map(t => `
      <tr>
        <td>${escapeHtml(new Date(t.timestamp).toLocaleDateString('en-IN'))}</td>
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
