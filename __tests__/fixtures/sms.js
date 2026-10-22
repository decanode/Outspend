// Anonymised, real-pattern Indian bank/merchant SMS samples.
// expect: null => must be rejected. Otherwise partial match against parser output.
const S = 'VM-HDFCBK'
export const SMS_FIXTURES = [
  // ---- debits: UPI
  { sender: S, body: 'Sent Rs.250.00 from HDFC Bank A/c XX1234 to SWIGGY on 12-10-26 UPI Ref 628374655', expect: { amount: 250, type: 'DEBIT', merchant: 'Swiggy', last4: '1234', payment_mode: 'UPI' } },
  { sender: 'AX-SBIUPI-S', body: 'Dear UPI user A/C X5678 debited by 1,200.00 on date 12Oct26 trf to Ramesh Kumar Refno 628374655', expect: { amount: 1200, type: 'DEBIT', merchant: 'Ramesh Kumar', last4: '5678' } },
  { sender: 'JD-ICICIT-S', body: 'ICICI Bank Acct XX445 debited for Rs 499.00 on 10-Oct-26; zomato@icici credited. UPI:628374655.', expect: { amount: 499, type: 'DEBIT' } },
  { sender: S, body: 'Rs.75.50 debited from A/c **9021 and credited to VPA chaiwala@ybl on 03-10-26. UPI Ref 1122334455', expect: { amount: 75.5, type: 'DEBIT', last4: '9021', payment_mode: 'UPI' } },
  { sender: 'AD-PAYTMB', body: 'Paid Rs.320 to Uber India. Updated Balance: Rs.1,280', expect: { amount: 320, type: 'DEBIT', merchant: 'Uber India' } },
  { sender: 'VK-KOTAKB', body: 'Sent Rs.15000.00 from Kotak Bank AC X7766 to landlord@okaxis on 01-10-26.UPI Ref 6677889900', expect: { amount: 15000, type: 'DEBIT', last4: '7766' } },
  { sender: 'BZ-SBIINB', body: 'Your a/c no. XXXXXXXX1234 is debited by Rs.2,500.00 on 05-10-26 to MEDPLUS PHARMACY. Avl Bal Rs.45,000.00', expect: { amount: 2500, type: 'DEBIT' } },
  { sender: S, body: 'UPI txn of Rs.89.00 paid to Blinkit via HDFC Bank A/c XX1234 on 07-10-26', expect: { amount: 89, type: 'DEBIT', merchant: 'Blinkit' } },
  // ---- debits: card
  { sender: S, body: 'Spent Rs.1,499.00 On HDFC Bank Card 4321 At AMAZON PAY INDIA On 2026-10-09:14:22:10 Avl Lmt Rs.98,501', expect: { amount: 1499, type: 'DEBIT', merchant: 'Amazon Pay India', last4: '4321', payment_mode: 'CARD' } },
  { sender: 'AX-SBICRD', body: 'Rs.2,350.00 spent on your SBI Credit Card ending 8899 at STARBUCKS on 11/10/26.', expect: { amount: 2350, type: 'DEBIT', merchant: 'Starbucks', last4: '8899', payment_mode: 'CARD' } },
  { sender: 'VM-AXISBK', body: 'Rs 3,200 spent on Axis Bank Card no. XX6677 at MYNTRA on 08-10-26 14:11:09. Avl Limit: Rs 46,800', expect: { amount: 3200, type: 'DEBIT', merchant: 'Myntra', last4: '6677' } },
  { sender: 'VM-ICICIB', body: 'INR 899.00 spent using ICICI Bank Card XX3344 on 02-Oct-26 on NETFLIX. Avl Limit: INR 1,10,000.', expect: { amount: 899, type: 'DEBIT', last4: '3344' } },
  { sender: S, body: 'Rs. 560.00 withdrawn from ATM using card XX1234 on 04-10-26', expect: { amount: 560, type: 'DEBIT', payment_mode: 'ATM' } },
  // ---- debits: misc
  { sender: 'VM-HDFCBK', body: 'Rs.4999 debited A/c XX1234 on 06-10-26 towards BESCOM ELECTRICITY BILL', expect: { amount: 4999, type: 'DEBIT' } },
  { sender: 'AX-AIRTEL', body: 'Recharge of Rs.299 successful for 9876543210. Paid via UPI.', expect: { amount: 299, type: 'DEBIT', payment_mode: 'UPI' } },
  { sender: 'VM-HDFCBK', body: 'Payment of Rs.599 made to NETFLIX using HDFC Bank Card XX1234', expect: { amount: 599, type: 'DEBIT' } },
  { sender: 'JK-IDFCFB', body: 'IDFC FIRST Bank: INR 1,000.00 debited from A/c XX9988 on 12-10-26 NEFT to ABC TRADERS', expect: { amount: 1000, type: 'DEBIT', payment_mode: 'NEFT' } },
  { sender: 'VM-HDFCBK', body: 'Paid Rs.45 to Delhi Metro Rail Corp on 11-10-26', expect: { amount: 45, type: 'DEBIT' } },
  // ---- credits
  { sender: S, body: 'Rs.50,000.00 credited to HDFC Bank A/c XX1234 on 01-10-26 by NEFT-ACME CORP SALARY. Avl bal Rs.55,000.00', expect: { amount: 50000, type: 'CREDIT', last4: '1234' } },
  { sender: 'AX-SBIUPI-S', body: 'Your A/C X5678 credited by Rs.500.00 on 09Oct26 by transfer from Priya Sharma Ref 11223344', expect: { amount: 500, type: 'CREDIT', merchant: 'Priya Sharma' } },
  { sender: 'JD-ICICIT-S', body: 'Acct XX445 is credited with Rs 1,250.00 on 10-Oct-26 from rahul@oksbi. UPI:99887766', expect: { amount: 1250, type: 'CREDIT' } },
  { sender: 'VM-KOTAKB', body: 'Rs 2000.00 received in your Kotak Bank A/c X7766 from Anil Mehta on 03-10-26', expect: { amount: 2000, type: 'CREDIT', merchant: 'Anil Mehta' } },
  { sender: 'VM-HDFCBK', body: 'Interest of Rs.312.40 credited to A/c XX1234 on 30-09-26', expect: { amount: 312.4, type: 'CREDIT' } },
  // ---- refunds
  { sender: 'VM-HDFCBK', body: 'Refund of Rs.1,499.00 from AMAZON PAY INDIA credited to your HDFC Bank Card XX4321 on 12-10-26', expect: { amount: 1499, type: 'REFUND' } },
  { sender: 'AX-SBICRD', body: 'Rs.2,350.00 reversed to your SBI Credit Card ending 8899 by STARBUCKS on 12/10/26', expect: { amount: 2350, type: 'REFUND' } },
  { sender: 'VM-ICICIB', body: 'Cashback of Rs.50.00 credited to A/c XX445 on 11-Oct-26', expect: { amount: 50, type: 'REFUND' } },
  // ---- must be rejected
  { sender: S, body: '123456 is your OTP for txn of Rs.1,000.00 at SWIGGY. Do not share this OTP with anyone.', expect: null },
  { sender: S, body: 'OTP 998877 for payment of Rs 250 to Amazon. Valid for 10 mins. Never share.', expect: null },
  { sender: 'VM-HDFCBK-P', body: 'Get pre-approved personal loan up to Rs.5,00,000. Apply now at hdfc.com. T&C apply', expect: null },
  { sender: 'AX-SBICRD', body: 'Offer: Spend Rs.10,000 this month and get Rs.500 cashback on your SBI Card. T&C apply.', expect: null },
  { sender: 'VM-HDFCBK', body: 'Your credit card statement for Sep 2026 is generated. Total amount due Rs.12,345.00. Minimum amount due Rs.617.00. Due date 20-10-26.', expect: null },
  { sender: 'VM-HDFCBK', body: 'Reminder: Rs.5,000.00 will be debited from your A/c XX1234 on 15-10-26 for your SIP.', expect: null },
  { sender: S, body: 'Txn of Rs.800.00 on HDFC Bank Card XX1234 at AMAZON failed due to insufficient funds.', expect: null },
  { sender: S, body: 'UPI payment of Rs.200 to Ravi declined. Please retry.', expect: null },
  { sender: S, body: 'Dear Customer, your A/c XX1234 balance is Rs.45,000.00 as on 12-10-26.', expect: null },
  { sender: S, body: 'Ravi has requested money Rs.500 from you on UPI. Pay now.', expect: null },
  { sender: '+919876543210', body: 'I paid Rs.500 to the plumber yesterday, can you send me back?', expect: null },
  { sender: 'Mom', body: 'Rs 100 sent to you via gpay', expect: null },
  { sender: 'VM-HDFCBK', body: 'Welcome to HDFC Bank NetBanking. Your login was successful.', expect: null },
  { sender: 'AX-SWIGGY', body: 'Your Swiggy order #1234 has been delivered. Enjoy your meal!', expect: null },
  { sender: 'VM-HDFCBK', body: '', expect: null },
  // ---- unknown merchant => needs_review
  { sender: S, body: 'Rs.150.00 debited from A/c XX1234 on 12-10-26. UPI Ref 12345', expect: { amount: 150, type: 'DEBIT', merchant: 'Unknown Vendor', needs_review: true } },
]
