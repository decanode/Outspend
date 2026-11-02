export const TRAI_SENDER_REGEX = /^[A-Z]{2}-[A-Za-z]{6}$/

// Bank reference (UTR / RRN / Ref no.) used to recognise the same transaction across messages.
export const extractReference = (body) => {
  const match = body.match(/(?:UTR|RRN|Ref(?:erence)?)(?:\s*(?:No\.?|Number))?\s*[:\-#.]?\s*(?:UPI\/)?([A-Za-z0-9]{8,})/i)
  return match ? match[1].toUpperCase() : null
}

export const parseSmsTransaction = (sender, body, timestamp) => {
  // Verify TRAI Sender ID
  if (!TRAI_SENDER_REGEX.test(sender)) {
    return null // Ignore personal conversations
  }
  return parseBankMessage(body, timestamp, 'SMS')
}

// Parses a bank message body with no sender check (e.g. text shared from the iOS Shortcut).
export const parseBankMessage = (body, timestamp, source = 'SMS') => {
  const transaction = {
    amount: null,
    merchant: null,
    type: null,
    timestamp: timestamp,
    source,
    raw_text: body,
    external_id: extractReference(body),
    needs_review: false
  }

  // Extract amount
  // Matches Rs., INR, Rs, ₹ followed by amount (e.g., Rs. 1,000.00)
  const amountMatch = body.match(/(?:Rs\.?|INR|₹)\s?(\d+(?:,\d+)*(?:\.\d+)?)/i)
  if (amountMatch) {
    transaction.amount = parseFloat(amountMatch[1].replace(/,/g, ''))
  }

  // Determine Type (DEBIT/CREDIT/REFUND)
  const bodyUpper = body.toUpperCase()
  if (bodyUpper.includes('REFUND') || bodyUpper.includes('CASHBACK')) {
    transaction.type = 'REFUND'
  } else if (bodyUpper.includes('CREDITED') || bodyUpper.includes('RECEIVED')) {
    transaction.type = 'CREDIT'
  } else if (bodyUpper.includes('DEBITED') || bodyUpper.includes('PAID') || bodyUpper.includes('SPENT')) {
    transaction.type = 'DEBIT'
  }

  // Extract Merchant
  // A simplistic approach: find text after "to " or "at " up to the next space/punctuation
  const merchantMatch = body.match(/(?:to|at)\s([A-Za-z0-9@.-]+)/i)
  if (merchantMatch) {
    transaction.merchant = merchantMatch[1]
  } else {
    // Standard UPI string fallback or unrecognized
    transaction.merchant = 'Unknown Vendor'
    transaction.needs_review = true
  }

  if (transaction.amount && transaction.type) {
    return transaction
  }
  return null
}
