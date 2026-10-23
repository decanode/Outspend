# Outspend

Private, offline expense tracker for Android, built to work in any country. It reads bank/UPI SMS on the device, turns them into transactions, and never sends your data anywhere.

## Countries and currencies
One home currency per install, chosen on the first screen (guessed from the phone) and changeable in Settings. Ready-made presets: India, US, UK, UAE, Saudi Arabia, Singapore, Australia, New Zealand, Canada, Ireland, South Africa, Nigeria, Kenya, Philippines, Malaysia, Sri Lanka, Nepal, Bangladesh, Pakistan, plus "Other country" with any of 24 supported currencies. Messages in a different currency are kept (with their own symbol) but never added to your totals. India has a tuned bank-SMS profile; every other country uses a general English profile and has **not been tested against real bank messages**. See `src/regions/profiles.js` for how to add or tune a country.

## Features
- Automatic transactions from bank/UPI/card SMS (live + history import + daily audit), with OTP/promo filtering, duplicate protection and refund linking
- Instant capture: a manifest-declared receiver wakes the app for each bank SMS, even when it is closed. Unknown payees get a notification with a "Name it" reply box
- Manual and voice entry (voice is confirmed before saving); a manual entry is upgraded to "verified" when its SMS arrives
- Merchant rules and categories; unknown payees surface under "Needs attention"
- Ledger with search, filters, per-day totals, swipe actions, soft delete with undo, edit, receipt photos
- Analytics for any week or month: change vs the previous period, biggest movers, day-by-day bars, weekday/weekend and time-of-day patterns, small-purchase share, top 10 expenses, cash flow and savings rate, run-rate projection, 6/12-month trends, and a shareable PDF report card
- Pay cycles: confirm who pays your salary once and spending periods run from salary to salary instead of calendar months; skipped bank messages can be reviewed and added by hand
- Plan tab: category and overall monthly budgets with daily allowance and 80%/100% alerts, savings goals, upcoming-bills calendar, payday countdown, and money owed to you from split payments
- Transfers between your own accounts and card-bill payments are detected and kept out of spending and income; splits count only your share; tags group spending (e.g. a trip)
- Alerts for unusual spend and duplicate charges
- App lock using the phone's own fingerprint/face/screen lock (no separate app PIN), encrypted backup/restore (AES-256-GCM), home-screen widget
- Accounts (opening balance + reconciliation), credit cards (cycle spend, 80%/95% limit alerts), subscription detection with renewal reminders
- Export to CSV, JSON and a PDF group bill via the share sheet
- 30-day trial then a Google Play subscription priced per country in Play Console (paywall behind a flag, see below)

Gmail receipt sync is **deferred** (no OAuth client yet); `src/services/GoogleAuth.js` is an unused stub.

## Development
```bash
npm install --legacy-peer-deps
npm test
npm run lint
npx expo run:android        # development build (native modules: SMS, camera, speech, billing)
```
`android/` is committed and edited directly. `app.json` is kept in step for reference but EAS does not sync it while `android/` exists, so permissions/manifest changes go in `android/app/src/main/AndroidManifest.xml`.

## Release checklist (things that need accounts or a device)
1. **Play Console:** create the subscription `com.decanode.outspend.premium_monthly` (₹299/month) and add license testers.
2. **Enforce billing:** set `FEATURES.enforcePaywall = true` in `src/config.js` for the production build.
3. **SMS permission:** submit Google Play's *Permissions Declaration Form* for `READ_SMS`/`RECEIVE_SMS` (core use case: expense tracking). Provide a privacy policy URL and complete the Data safety form.
4. **Signing:** `eas build --profile production` (see `eas.json`); configure the upload key.
5. **Device test pass:** SMS (foreground/background/killed), camera receipts, voice, notifications, billing and restore. The manual checklist is in `NEW_IMP_PLAN.MD` section 6.

## Known limits
- Capture while the app is closed depends on Android allowing the background start. If the OS refuses (aggressive battery savers on some phones), the SMS is picked up by the delta sync on next launch and the daily task. Reading UPI app notifications (GPay/PhonePe) is intentionally not supported; bank SMS cover those payments.
- The trial start is stored locally, so reinstalling resets it (accepted for a privacy-first design).
- The theme is dark only; a light theme needs a styling refactor and is not done.
- `allowBackup` is disabled so the transaction database is not copied to cloud backup. Moving to a new phone requires an export.
