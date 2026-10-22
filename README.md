# Outspend

Private, offline expense tracker for Android. It reads bank/UPI SMS on the device, turns them into transactions, and never sends your data anywhere.

## Features
- Automatic transactions from bank/UPI/card SMS (live + history import + daily audit), with OTP/promo filtering, duplicate protection and refund linking
- Instant capture: a manifest-declared receiver wakes the app for each bank SMS, even when it is closed. Unknown payees get a notification with a "Name it" reply box
- Manual and voice entry (voice is confirmed before saving); a manual entry is upgraded to "verified" when its SMS arrives
- Merchant rules and categories; unknown payees surface under "Needs attention"
- Ledger with search, filters, per-day totals, swipe actions, soft delete with undo, edit, receipt photos
- Analytics by month and category with top merchants and month-over-month change
- Accounts (opening balance + reconciliation), credit cards (cycle spend, 80%/95% limit alerts), subscription detection with renewal reminders
- Export to CSV, JSON and a PDF group bill via the share sheet
- 30-day trial then a Google Play subscription (paywall behind a flag, see below)

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
- `allowBackup` is disabled so the transaction database is not copied to cloud backup. Moving to a new phone requires an export.
