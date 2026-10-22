# Outspend: Implementation Plan for Pending Features

Status: **Reviewed and validated by Claude against `docs/Expense Tracker Design Document_2.pdf` and `docs/UI design.html` (2026-10-22).** Corrections applied inline, marked `[ADDED]` / `[VALIDATED]` / `[RESOLVED]`. All of section 2 is now answered — the 3 items that needed user input (Gmail scope, IAP product status, OAuth client status) were asked and answered in chat: **Gmail deferred, Play Console product not yet created, Google Cloud OAuth client not yet set up.** This pass only edited this plan file — no implementation work has started. No work starts until the user posts approval in section 7.
Baseline: commit `7af465e` (Initial commit), branch `main`.
Stack: Expo SDK ~57, React Native 0.86, WatermelonDB, React Navigation (bottom tabs), plain JS, Android native SMS module.

> How to use this file: edit anything (scope, order, answers to the open questions in section 2), then tell Claude to start.
> Each task has an ID (e.g. `P0-1.2`) so you can say "skip P1-8" or "do P0-2 first".

---

## 0. Current State Summary

### Working
- WatermelonDB schema (v1) with 4 tables: `transactions`, `merchant_rules`, `credit_cards`, `subscriptions` ([src/db/schema.js](src/db/schema.js)).
- Models for all four tables ([src/db/models/](src/db/models/)).
- SMS regex parser ([src/services/RegexEngine.js](src/services/RegexEngine.js)) and dedupe/smart-merge logic ([src/services/TransactionManager.js](src/services/TransactionManager.js)).
- Native Android SMS broadcast receiver emitting `onSmsReceived` ([SmsModule.kt](android/app/src/main/java/com/decanode/outspend/SmsModule.kt)).
- CSV export, camera capture to the document directory, voice recognition service, background task registration.
- UI shells for all 5 tabs, Onboarding and Paywall.

### Placeholders and mock data
| Area | Problem |
|---|---|
| Dashboard | Balance `₹48,750.00` is a literal. "Save Rule" button has no handler. Voice saves a ₹0 "Voice Note". Card text says "paid via UPI" regardless of source. |
| Ledger | Delete handler is an empty comment. Category swipe shows only an alert. "Group by date" is a single dummy section. Camera photo path is never linked to a transaction. |
| Analytics | Pie data, legend, "₹14K" and top merchants are hardcoded. Month selector is static text ("September 2026 ▾"). |
| Accounts | HDFC and SBI cards are hardcoded. "Adjust" only shows an alert. |
| Settings | PDF has 2 hardcoded rows. Trial status string hardcoded ("29 Days left"). |
| Onboarding | Does not request permissions, does not sign in to Gmail, does not save the start date. `isOnboarded` is in-memory only (resets every launch). |
| Gmail sync | Lists message IDs and logs the count only. Never fetches, parses or saves. `webClientId` is a placeholder. `configureGoogleSignIn` is never called. |
| Billing | Paywall disabled in [App.js](App.js). No trial tracking, no purchase listener, no `finishTransaction`, no restore. |
| Notifications | Reads `sub.renewal_date`, but the schema column is `next_billing_date` (bug). Only scheduled once at app start. Nothing creates subscriptions. |

### Known risks and bugs spotted
- `processIncomingSms` is imported in Dashboard but never invoked. No JS code listens to `onSmsReceived`.
- `READ_SMS` / `RECEIVE_SMS` are declared in the manifest but never requested at runtime.
- ~~Need to verify `SmsPackage` is registered in `MainApplication.kt`~~ — **[VALIDATED]** confirmed: `packageList.apply { add(SmsPackage()) }` is present in `MainApplication.kt`.
- `BackgroundSync` calls `syncGmailReceipts()`, which will throw or no-op when the user is not signed in (`getTokens` fails).
- `react-native-iap` v16 likely renamed/changed `requestSubscription` and `getAvailablePurchases`. Must be verified against the installed version.
- CSV export writes to `DownloadDirectoryPath`, which is blocked by scoped storage on Android 10+. CSV escaping strips commas and does not handle quotes or newlines.
- `expo-notifications` `shouldShowAlert` is deprecated in recent SDKs. Verify against the SDK 57 docs.
- No lint, no typecheck, no tests. `package.json` has no `lint` / `typecheck` / `test` scripts.
- `app.json` has no config plugins (camera, notifications, speech recognition, Google sign-in, IAP).
- `AGENTS.md` mandates Expo Router in `src/app/`, but the project uses `App.js` + React Navigation. See Q2.

---

## 0.5 Validation Against the Original Design Docs

Cross-checked section 3 against `docs/Expense Tracker Design Document_2.pdf` (system design) and `docs/UI design.html` (execution plan / UI spec). Scope is substantially aligned; the gaps found below are now corrected inline in each phase (search for `[ADDED]`):

- **Refund-to-debit linking** (design doc §5.3) — a detected `REFUND`/`CASHBACK` should attempt to offset the original debit, not just be tagged. Missing from the original P0-8 scope. **Added to P0-1 (schema field) and P0-8 (logic).**
- **Daily inbox re-sweep** (design doc §5.2 / "Daily Audit WorkManager") — the 24h background task exists to catch SMS that were deleted before the live listener processed them, which needs the *recurring* task to call `getInboxSince`, not just the one-time onboarding import. **Added to P0-7.**
- **JSON export** (design doc §6: "CSV/JSON file") — P2-12 only covered CSV. **Added JSON alongside CSV.**
- **Dashboard weekly trend chart** (UI spec, Tab 1) — a required Dashboard component, missing from the code and not listed in P1-5. **Added to P1-5.**
- **Settings "Last Daily Audit" row and "Manage Merchant Rules" row** (UI spec, Tab 5) — both explicitly specified, both missing from P1-9. **Added to P1-9.**
- **Manual "add transaction" entry** (UI spec, Tab 1: "Primary Action: Voice/Manual Log") — P1-5 had this bracketed `[Confirm in review]`; the original spec already pairs voice with manual entry on one FAB. **Resolved: in scope, added to P1-5.**
- **Opening balance on account creation** (design doc §5.5: "manual seeding of initial account balances") — P1-8 covered ongoing reconciliation but not the starting balance at creation time. **Added to P1-8.**
- Dedupe window: the design doc says 5 minutes; `docs/UI design.html` and the already-implemented `TransactionManager.js` use 2 hours. Not a plan defect — the HTML doc is the more detailed/later source and the code already matches it. Left as-is.
- Analytics "month-over-month comparison / daily trend line" (P1-7) is **not** in either source doc — a nice-to-have the plan author added beyond spec. Left explicitly optional/deferred, not blocking Phase 3 completion.
- `SmsPackage` registration risk (section 0) — already verified true during an earlier session; marked resolved above rather than left as an open risk.

---

## 1. Ground Rules (apply to every phase)

1. **Docs first.** Before touching any Expo / RN / EAS API, read the SDK 57 docs (`https://docs.expo.dev/versions/v57.0.0/`) and `https://docs.expo.dev/llms.txt`. Do not rely on memory.
2. Install packages only via `npx expo install <pkg>`.
3. `android/` is committed in this repo (not CNG-generated). Native edits are allowed there, but anything expressible in `app.json` / config plugins should go there.
4. Run lint and typecheck before declaring any phase done (needs Phase 0 tooling; see P0-0).
5. One commit per task or logical group, each ending with the co-author trailer. No pushes without approval.
6. Privacy promise ("100% private, no servers") is a product constraint. No analytics, no remote logging, and Gmail/SMS content stays on device.
7. Each phase ends with a short verification checklist (listed per phase) and a summary to the user.

---

## 2. Open Questions (answer these before work starts)

Please write your answer under each question.

### Q1. Source of truth
Do you have a spec or feature list I should follow? If not, is the scope in section 3 right?
- **Answer (Claude):** Yes — `docs/Expense Tracker Design Document_2.pdf` (system design) and `docs/UI design.html` (execution plan + UI spec) are the source of truth; I cross-checked section 3 against both. Scope is substantially right. Gaps found and the corrections applied are listed in the new "0.5 Validation Against the Original Design Docs" section above.

### Q2. Navigation architecture
[AGENTS.md](AGENTS.md) says to use Expo Router in `src/app/`. The code uses React Navigation and `App.js`, with a committed `android/` folder.
- Option A (recommended for speed): keep React Navigation, and update AGENTS.md to reflect reality.
- Option B: migrate to Expo Router (`src/app/_layout.tsx`, tabs group). More work, matches the project rules.
- **Answer (Claude):** Option A. The design doc explicitly chose Bare Workflow specifically to enable the custom Kotlin SMS module and manifest permissions this whole app depends on; `AGENTS.md` is generic Expo-starter boilerplate (it never mentions WatermelonDB, SMS, or anything specific to this project) rather than a deliberate rule, so migrating to Expo Router now would be a large, unjustified detour. AGENTS.md gets corrected as part of the existing P2-14 cleanup task, not before.

### Q3. Platform scope
Is this Android-only? Reading SMS is not possible on iOS. If Android-only: drop iOS config, `supportsTablet`, and iOS-specific code paths.
- **Answer (Claude):** Android-only, confirmed directly from the design doc (it only ever specifies Native Android Telephony / SMS BroadcastReceiver) — and iOS cannot grant third-party apps SMS read access at all, which is an OS sandboxing restriction, not a judgment call. Dropping the `ios` key and `supportsTablet` from `app.json` is folded into P2-13 (Release readiness), not done yet.

### Q4. Billing
- Enforce the paywall now, or keep it off until the end? (Recommendation: build it behind a flag and enable at the end.)
- Trial length? (UI says 29 days left, which implies 30.)
- SKU / price confirm: `com.decanode.outspend.premium_monthly`, ₹299/month. Is the Play Console product created?
- **Answer (Claude):**
  - Enforce now vs. later: adopting the plan's own recommendation — build behind a flag, enable in Phase 6 (P2-10).
  - Trial length: **30 days**, confirmed directly from `docs/UI design.html` itself ("Check for the valid 30-day trial..."), consistent with the hardcoded "29 days left" placeholder text (day 2 of a 30-day trial).
  - SKU/price: `com.decanode.outspend.premium_monthly` at ₹299/month matches the original spec exactly — no change needed.
  - Play Console product: **not created yet** (confirmed by you). Flagged as a prerequisite — P2-10 billing code can be written and unit-tested, but end-to-end purchase/restore testing is blocked until the product exists in Play Console. Call this out again when Phase 6 starts.

### Q5. Gmail
- Do you already have a Google Cloud project with an Android OAuth client and web client ID?
- Gmail `gmail.readonly` is a **restricted scope**: Play Store release requires Google's OAuth verification and possibly a CASA security assessment. Is that acceptable, or should Gmail be deprioritised or dropped?
- Which merchants should be supported initially? (Current query: Swiggy, IRCTC, Amazon, Uber, Zomato.)
- **Answer (Claude):**
  - Google Cloud OAuth client: **not set up yet** (confirmed by you). Required before any real Gmail sign-in testing — treat as a Phase 5 prerequisite, not before.
  - Scope decision (confirmed by you): **defer Gmail.** Ship the Android SMS pipeline (Phases 0–4) and billing/release (Phase 6) first; Phase 5 (Gmail) moves to after those ship, not dropped outright. See the updated Phase 5 heading and section 4 execution order below.
  - Merchant list (for whenever Phase 5 resumes): Swiggy, IRCTC, Amazon, Uber, Zomato matches the design doc's own examples (Swiggy, IRCTC, Amazon) plus two reasonable same-category additions. Fine as the initial list; easy to extend later without a plan change.

### Q6. Language
The code is plain JS. Move to TypeScript (makes `tsc --noEmit` meaningful) or stay JS?
- **Answer (Claude):** Stay in plain JS for now — neither source doc specifies a language, and converting now is a detour unrelated to shipping the core SMS pipeline. This is cheap to reverse later (nothing downstream in this plan depends on it), so say the word anytime if you'd rather start with TypeScript.

### Q7. Additional questions to settle during review (my defaults in brackets)
- Currency: INR only? [INR only]
- Categories: fixed default list or user-editable? [fixed default list + user-defined via rules]
- Account model: a new `accounts` table (savings accounts, wallets), with credit cards kept separate? [yes, add `accounts`]
- Soft delete or hard delete for transactions? [soft delete: `is_deleted` flag, so a re-synced SMS doesn't resurrect it]
- Start-date import window default? [last 90 days]
- App lock (PIN/biometric) in scope? [out of scope unless you say so]
- **Answers (Claude):** All the bracketed defaults confirmed correct, one with an added reason:
  - Currency: INR only — confirmed (₹ throughout, TRAI sender-ID regex, UPI-specific parsing).
  - Categories: fixed default list + user-defined via rules — confirmed; matches the `merchant_rules` table's original purpose. Starter list suggestion, taken from the UI mock's own example legend: Housing, Food & Dining, Transport, Entertainment, Shopping, Bills & Utilities, Healthcare, Other.
  - `accounts` table, credit cards kept separate — confirmed, and not just a nice-to-have: the UI spec's Accounts tab shows a bank/wallet "Account Card" (e.g. HDFC Savings) as a distinct component from the "Credit Card Reward Tracker", but the schema never had a table for the former. This is a correction, not a new idea.
  - Soft delete via `is_deleted` — confirmed.
  - Start-date import window default: 90 days — confirmed.
  - App lock (PIN/biometric) — confirmed out of scope; not in either source doc.

---

## 3. Phased Plan

Legend: **P0** = core pipeline (nothing else is useful without it), **P1** = screens on real data, **P2** = monetisation / polish / release.
Estimates are rough effort: S (<1 h), M (1 to 3 h), L (3+ h).

---

### PHASE 0: Foundation and data-model fixes (do first)

**Goal:** Stable base: tooling, schema/model correctness, persisted settings.

#### P0-0 Tooling (M)
- Add `lint`, `typecheck` scripts to `package.json`. Add ESLint config via `npx expo lint` setup, and a test runner (Jest + `jest-expo`) via `npx expo install`.
- If Q6 = TypeScript: add `tsconfig.json`, `typescript`, `@types/react`; convert incrementally (`allowJs: true` first).
- Run `npx expo-doctor` and `npx expo install --fix`; record and resolve findings.
- **Done when:** `npx expo lint`, `npx tsc --noEmit` (if TS), and `npm test` all run (even if few tests).

#### P0-1 Verify models and schema (M)
- Check every model for correct decorators: `Subscription`, `CreditCard`, `MerchantRule` (the `Transaction` model uses `@field` for timestamp; consider `@date`).
- **Fix the `renewal_date` vs `next_billing_date` mismatch** in NotificationService.
- Schema v2 migration (WatermelonDB `schemaMigrations`) adding:
  - `transactions`: `is_deleted` (bool), `account_id` (string, optional), `receipt_path` (string, optional), `merchant_rule_id` (optional), `linked_transaction_id` (string, optional — **[ADDED]** refund-to-debit linking, design doc §5.3), `updated_at`/`created_at`.
  - `accounts` table: `name`, `type` (SAVINGS / WALLET / CASH), `balance`, `last_reconciled_at`, `last4` (optional).
  - `credit_cards`: `last4`, `billing_day`, `statement_day`.
  - `subscriptions`: `merchant`, `is_active`, `detected_from_tx_id`, `notification_id`.
  - `app_settings` (key/value) table, or use `expo-secure-store` / AsyncStorage for simple settings (decide in review).
- Add default category list constant (`src/constants/categories.js`).
- **Done when:** app boots with fresh install and with v1 to v2 upgrade; unit test for migration shape.

#### P0-2 Persisted app state (S)
- Persist `isOnboarded`, `onboardingStartDate`, `trialStartedAt`, permission-granted flags. Load before first render in [App.js](App.js).
- **Done when:** killing and relaunching the app after onboarding skips onboarding.

#### P0-3 Repository / data-access layer (M)
- Create `src/data/` helpers (e.g. `transactions.js`, `rules.js`, `accounts.js`, `subscriptions.js`) so screens do not write raw DB queries and writes go through `database.write`.
- **Done when:** screens import from `src/data/*`; no screen calls `database.write` directly.

**Phase 0 verification:** lint / typecheck / tests green; fresh install and upgrade path both boot; no `renewal_date` references remain.

---

### PHASE 1: SMS ingestion pipeline (P0, core feature)

#### P0-4 Runtime permissions (S)
- Request `READ_SMS` and `RECEIVE_SMS` through `PermissionsAndroid`. Handle denied, "never ask again" (deep-link to settings), and re-prompt from Settings.
- Request `POST_NOTIFICATIONS` (Android 13+) with the same handling.

#### P0-5 Verify and finish the native module (M)
- Confirm `SmsPackage` is registered in `MainApplication.kt`.
- Add native method `getInboxSince(timestampMs)` that queries `Telephony.Sms.Inbox` and returns `[{sender, body, timestamp}]` (paged, to avoid OOM).
- Unregister the receiver on module teardown (`invalidate` / `onCatalystInstanceDestroy`) to avoid leaks.
- Consider a manifest-declared receiver or foreground handling so SMS arriving while the app is backgrounded is captured. Decide the strategy (see risk note below).
- Write a thin JS wrapper `src/native/Sms.js` (typed events, subscribe/unsubscribe).

#### P0-6 Live SMS listener (S)
- On app start (after permission granted), subscribe to `onSmsReceived` and call `processIncomingSms`. Handle errors without crashing the receiver.

#### P0-7 Historical import (M)
- After onboarding, import inbox from `onboardingStartDate` to now using `getInboxSince`. Batch inserts in a single `database.write` per N messages, show a progress indicator, and make the import idempotent via a stable `external_id` (hash of sender + timestamp + body).
- Persist "last imported timestamp" so subsequent launches only fetch the delta.
- **[ADDED]** Wire the same `getInboxSince(lastImportedTimestamp)` call into the recurring background task (not just onboarding) so it doubles as the design doc's "Daily Audit" (§5.2) — catching SMS that were deleted from the inbox before the live listener (P0-6) processed them.
- **[ADDED]** Since Gmail is deferred (Q5), guard `BackgroundSync.js`'s unconditional `syncGmailReceipts()` call behind a signed-in check (or remove it until Phase 5 resumes) so the recurring task doesn't fail/no-op on every run in the meantime.

#### P0-8 Parser hardening (L)
- Reject OTP / promo / non-transactional messages (keywords: OTP, "do not share", offers, EMI reminder, balance enquiry).
- Extract: account/card last-4, available balance, UPI VPA, payment mode (UPI / card / NEFT / ATM).
- Handle formats: `Rs.1,000.00`, `INR 1000`, `₹1,000`, "debited by", "spent on", "sent to", "credited with", "txn of".
- Review the TRAI header regex `^[A-Z]{2}-[A-Za-z]{6}$`: real senders include `VM-HDFCBK`, `AX-SBIUPI-S`, `JD-ICICIT-S`, so suffixes `-S`/`-T`/`-P`/`-G` and 5 to 6 letter IDs are valid. Loosen accordingly.
- Merchant extraction beyond `to|at\s(\S+)`; apply user `MerchantRule`s before falling back to `needs_review`.
- Dedupe on `external_id` for the same SMS received twice (live + import).
- **[ADDED]** Refund/cashback linking (design doc §5.3): when a transaction parses as `REFUND`, search for the most recent matching `DEBIT` from the same merchant within a reasonable window (e.g. 30 days) and set `linked_transaction_id`, so Analytics nets them out instead of double-counting spend.
- Create a fixture file of 40+ real-pattern SMS samples (anonymised) and unit tests (Jest).

**Phase 1 verification:** unit tests pass on fixtures; on a device/emulator, a sent test SMS from an allowed-format sender shows up in the Ledger; history import works from start date; denied-permission path doesn't crash.

> Risk: Google Play restricts `READ_SMS`/`RECEIVE_SMS` to apps whose core function is SMS/expense-tracking use cases and requires a Permissions Declaration Form. Plan for this in P2 release tasks.

---

### PHASE 2: Onboarding, categories and merchant rules

#### P0-9 Functional onboarding (M)
- Step 2 requests SMS (and notification) permissions; allow "Skip" with a clear consequence message.
- Step 3 triggers Google sign-in (if Gmail stays in scope per Q5); skippable.
- Step 4 date picker for the start date (needs a picker dependency, or a simple preset chooser: 30 / 90 / 180 days / custom). Persist the choice and kick off P0-7 import with a progress screen.
- Persist `isOnboarded` at the end.

#### P1-A Categories and merchant rules engine (L)
- `MerchantRule` fields: `pattern` (substring / regex / VPA), `mapped_merchant`, `category`.
- Rule application service: on new transaction, match rules first; fall back to keyword-to-category map (swiggy to Food, uber to Transport, etc.); else `needs_review`.
- When the user saves a rule, retroactively apply it to all matching existing transactions and clear their `needs_review`.

**Phase 2 verification:** fresh install flow end to end; rule saved once recategorises past matching transactions.

---

### PHASE 3: Screens on real data

#### P1-5 Dashboard (M)
- Real balance: sum of account balances (+/- transactions since last reconciliation). Show loading/empty states.
- "Needs Attention" card: show source-aware text (use `raw_text` snippet / source), working "Save Rule" (calls P1-A), and a "Dismiss" option.
- Voice entry: parse amount and merchant from the utterance ("spent 250 on coffee at Starbucks") with a small NLP/regex parser; show a confirmation sheet before saving; fall back to `needs_review` when unparsed. Handle recogniser stop/permission errors. Specify the locale (`en-IN`).
- Recent list: tap navigates to the transaction detail.
- Manual "add transaction" entry (the schema supports `MANUAL`) — **[RESOLVED: in scope]** the original UI spec pairs this with voice on the same FAB ("Primary Action: Voice/Manual Log"); build a simple form (amount, merchant, category, date).
- **[ADDED]** Weekly trend mini bar chart (`react-native-gifted-charts`, last 7 days of spend) — a required Dashboard component in the UI spec, currently missing from both the code and this plan.

#### P1-6 Ledger (L)
- Group by date (Today / Yesterday / date headers) with day totals.
- Soft delete (with undo snackbar) using the `is_deleted` flag; exclude deleted rows from all queries.
- Category picker bottom sheet (uses the category list), with an option "apply to all from this merchant" (creates a rule).
- Edit transaction (amount, merchant, date, category, notes).
- Attach receipt: link the CameraVault photo path to a transaction (`receipt_path`); show a thumbnail and full-screen view.
- Search and filter (text, category, type, source, date range).
- Fix the swipe `onSwipeableLeftOpen` auto-trigger so it closes the swipeable after the action.
- Performance: paginate / windowed list for large histories.

#### P1-7 Analytics (L)
- Aggregate by month and category from the DB (exclude `CREDIT`, deleted and transfers; treat `REFUND` as negative spend).
- Working month selector (prev/next), real donut chart with legend derived from data, centre label showing the total.
- Top merchants for the selected month (top N). Month-over-month comparison and a daily/weekly trend line (optional, confirm in review).
- Empty state when there is no data.

#### P1-8 Accounts (L)
- CRUD for accounts (savings / wallet / cash) and credit cards, with last-4 matching so SMS get attributed to the right account. **[ADDED]** Capture an opening balance when an account is first created (design doc §5.5 "manual seeding of initial account balances"), not just ongoing reconciliation.
- "Adjust balance" creates a reconciliation entry (stored as an adjustment transaction or `last_reconciled_at` + opening balance) instead of an alert.
- Credit card: `current_spend` computed from transactions in the current billing cycle; limit-utilisation bar with warning thresholds (80% / 95%); the limit alert can feed notifications.
- Net worth header = accounts − card dues.

#### P1-9 Settings (M)
- Real trial / subscription status from billing state (see P2-10).
- Group-bill PDF: choose date range and categories/transactions to include; real totals; proper HTML escaping.
- Data controls: resync SMS, re-run import, change start date, **wipe all data** (confirm twice), permission status with deep links.
- Gmail connect/disconnect (if in scope).
- **[ADDED]** "Last Daily Audit" row showing the persisted last-sync timestamp (from P0-7's recurring sync) — in the original UI spec, currently missing from both the code and this plan.
- **[ADDED]** "Manage Merchant Rules" screen: list, edit and delete existing `merchant_rules` entries — in the original UI spec; P1-A builds the matching engine but nothing to manage the rules afterward.

**Phase 3 verification:** all five tabs show data derived only from the DB (grep for hardcoded `₹` literals in screens → none); manual test with seeded dataset of 500+ transactions for list performance.

---

### PHASE 4: Subscriptions and notifications

#### P1-10 Subscription detection (M)
- Detect recurring charges: same merchant + similar amount (±5%) at ~monthly/yearly interval (≥2 occurrences) → propose to the user ("Netflix ₹649 monthly — track as subscription?").
- Manual add/edit/pause subscription UI (list lives in Accounts or a new section; decide in review).
- Compute `next_billing_date` and roll it forward after each billing.

#### P1-11 Notifications rework (M)
- Fix field names; cancel and reschedule on subscription change (store notification IDs); do not rely on app-start scheduling only.
- Use the SDK 57 `expo-notifications` API (trigger format, handler fields, Android channel creation); verify against the docs.
- Alerts: 3-day renewal reminder, card limit threshold, and optional daily "needs review" digest.

**Phase 4 verification:** create a subscription due in 3 days → notification scheduled with the right content; editing or deleting cancels it.

---

### PHASE 5: Gmail receipts (DEFERRED — confirmed by you; moves to after Phase 6, not dropped. No Google Cloud OAuth client exists yet, see Q5.)

#### P2-1 Gmail pipeline (L)
- Configure sign-in with real client IDs at app start; add sign-in state and silent sign-in; handle token refresh and revoked access.
- Fetch each message (`messages.get`, `format=full`), decode base64url MIME parts (text/plain, then text/html stripped), and extract amount, merchant and date with per-merchant templates (Swiggy, Zomato, Amazon, Uber, IRCTC).
- Save with `source = 'GMAIL'` and `external_id = gmail message id` (idempotent), and merge with a matching SMS transaction using the existing 2-hour/amount logic (extend the dedupe source list).
- Track the last sync (use `after:` query or `historyId`); pagination (`nextPageToken`); rate-limit / backoff.
- Background task: skip silently when signed out; make the task robust (never throw).
- Unit tests with sample email bodies.

**Phase 5 verification:** sign in on device → receipts appear in the Ledger once (no duplicates on re-sync); sign out stops background sync.

---

### PHASE 6: Export, billing and release

#### P2-12 Export (S/M)
- Use the cache directory + `expo-sharing` share sheet (or Storage Access Framework) instead of writing to Downloads. Proper CSV escaping (quote fields, double quotes, newlines); include category, notes, account, receipt flag. Reuse in Paywall "Export Data & Exit".
- **[ADDED]** JSON export alongside CSV — the design doc specifies "CSV/JSON" (§6); same share-sheet flow, full transaction fields.

#### P2-10 Billing and paywall (L)
- Verify the `react-native-iap` v16 API (init, `fetchProducts`/`getSubscriptions`, `requestPurchase`, purchase listeners, `finishTransaction`, `getAvailablePurchases`) against the installed version docs.
- Trial tracking: store `trialStartedAt` locally; trial days left shown in Settings; the paywall shows when the trial has expired and there is no active sub.
- Feature flag to enable enforcement (currently commented out in [App.js](App.js)); a dev override for testing.
- Restore purchases, pending/cancelled/error states, offline grace period.
- Note: purely-local trial state can be reset by reinstall or clear-data; acceptable per the privacy-first design? (confirm in review).

#### P2-13 Release readiness (L)
- `app.json`: config plugins and permissions for camera, notifications, speech recognition, Google sign-in, IAP; remove unneeded permissions (`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` are probably unnecessary); set version code, and review the portrait/`userInterfaceStyle` (UI is dark but `userInterfaceStyle` is `light`).
- App icon / splash assets check; app name and package confirmation.
- `eas.json` profiles (development / preview / production), signing, and `eas build` instructions.
- Play Console: SMS Permissions Declaration, data safety form, privacy policy URL, Gmail OAuth verification (if applicable).
- Crash safety: error boundary around the root, graceful handling when native modules are missing (e.g. Expo Go).

#### P2-14 Test pass and cleanup (M)
- Unit tests: parser, dedupe/merge, rules engine, analytics aggregation, subscription detection, CSV escaping.
- Manual device test script (checklist in this file, section 6).
- Remove leftover `console.log`s, dead code, unused imports (`Q`, `database`, etc.).
- Update AGENTS.md / add README with setup, build and architecture notes.

---

## 4. Proposed Execution Order (summary)

| # | Step | Phase / IDs |
|---|---|---|
| 1 | Tooling, schema/model drift, persisted state, data-access layer | Phase 0: P0-0..P0-3 |
| 2 | Permissions and SMS pipeline incl. history import, parser hardening | Phase 1: P0-4..P0-8 |
| 3 | Onboarding, categories and merchant rules | Phase 2: P0-9, P1-A |
| 4 | Dashboard and Ledger on real data | Phase 3: P1-5, P1-6 |
| 5 | Analytics, Accounts, Settings | Phase 3: P1-7, P1-8, P1-9 |
| 6 | Subscription detection and notifications | Phase 4: P1-10, P1-11 |
| 7 | Export, billing and paywall (Play Console product must be created before end-to-end testing) | Phase 6: P2-12, P2-10 |
| 8 | Release readiness, tests, cleanup | Phase 6: P2-13, P2-14 |
| 9 | **Deferred:** Gmail receipt parsing — resume once a Google Cloud OAuth client exists | Phase 5: P2-1 |

Dependencies: P0-1 before everything. P0-4/5 before P0-6/7. P1-A before the Dashboard "Save Rule". The `accounts` table (P0-1) before P1-8. Billing state (P2-10) feeds the Settings status (P1-9), so Settings shows a placeholder until then.

---

## 5. Suggested Working Method (once approved)

- Work one phase at a time on a feature branch (`feat/phase-N-...`), commit per task, and report back after each phase with: what changed, test results, lint/typecheck output, and anything I couldn't verify on a device (I cannot run Android hardware here, so SMS/camera/IAP/voice need your device testing).
- Pause and ask whenever a spec decision is needed (new questions are appended to section 2).

---

## 6. Manual Device Test Checklist (to fill during execution)

- [ ] Fresh install → onboarding → permissions → start date → import runs
- [ ] Live SMS received while app foreground / background / killed
- [ ] Duplicate SMS (live + import) produces one transaction
- [ ] Unknown merchant → Needs Attention → save rule → past transactions updated
- [ ] Manual / voice entry then matching SMS merges into `VERIFIED_SMS`
- [ ] Ledger: delete with undo, change category, attach receipt, search
- [ ] Analytics numbers match a hand-computed month
- [ ] Account balance adjust and card utilisation warning
- [ ] Subscription reminder notification fires
- [ ] CSV, JSON and PDF export open correctly in the share sheet
- [ ] Refund/cashback SMS links back to the matching debit (Analytics nets it out)
- [ ] Dashboard weekly trend chart reflects last 7 days of spend
- [ ] Settings shows last daily audit time and a working "Manage Merchant Rules" screen
- [ ] Gmail sign-in, sync, sign-out (if in scope)
- [ ] Paywall: subscribe, restore, expired trial, offline

---

## 7. Review Notes (for you to fill)

- Scope changes:
- Items to drop / defer:
- Priority changes:
- Approved to start: **[x] yes**  (approved by the user in chat, 2026-10-22: "Validate and start the work. Stop only for queries. Manual steps … later at once.")


---

## 8. Implementation Status (updated after the first implementation pass, branch `feat/implementation`)

All coding for Phases 0-4 and 6 is done. Verified here: `npm test` (129 tests, incl. an in-memory WatermelonDB integration suite and a v1->v2 migration-shape test), `npm run lint` (clean), and `expo export --platform android` (bundles). **Nothing has run on a device or emulator** (no Android hardware here), so everything native is unverified at runtime: SMS module (Kotlin was not compiled), camera, voice, notifications, billing.

| Task | State | Notes |
|---|---|---|
| P0-0 Tooling | Done | `npm test`, `npm run lint`; ESLint pinned to 9 (v10 breaks eslint-plugin-react); plain Jest + Babel (jest-expo's RN preset would not resolve). No `typecheck` script because the project stays JS (Q6). |
| P0-1 Schema/models | Done | v2 + migration. Added beyond plan: `card_id`, `last4`, `payment_mode`, `notes` on transactions. `statement_day` dropped (only `billing_day` is used). `app_settings` is AsyncStorage (`src/services/Settings.js`). `renewal_date` bug fixed. |
| P0-2 Persisted state | Done | onboarding, start date, trial start, last import, last audit, dismissed suggestions, card alerts. |
| P0-3 Data layer | Done | `src/data/*`; screens use it for all writes. |
| P0-4 Permissions | Done | SMS (with "blocked" -> app settings), notifications (channel first), mic via the speech module, camera via VisionCamera. |
| P0-5 Native module | Done, **uncompiled** | `getInboxSince(since, limit)`, multi-part SMS stitching, receiver now requires `BROADCAST_SMS`, unregistered in `invalidate()`. Strategy for killed-app SMS: no manifest receiver; delta sync on launch/resume + daily task. |
| P0-6 Live listener | Done | serialised queue. |
| P0-7 History import + daily audit | Done | paged, idempotent (hashed `external_id`), delta from `lastImportedTimestamp`. Uses **`expo-background-task`** (`expo-background-fetch` is deprecated in SDK 57; removed). Gmail call removed from the task. |
| P0-8 Parser | Done | 45 SMS fixtures, OTP/promo/failed/reminder rejection, last4, balance clause stripped, payment mode, VPA, refund linking. |
| P0-9 Onboarding | Done | 3 steps (Gmail step removed while deferred). |
| P1-A Rules | Done | substring or `/regex/`; retro-apply; keyword fallback. |
| P1-5 Dashboard | Done | real balance, month spend, 7-day chart, Needs-attention with working Save rule/Dismiss, voice with confirmation sheet, manual add. |
| P1-6 Ledger | Done | day groups + totals, search/type/period/category filters, paging, tappable swipe actions, undo delete, edit, category sheet with "apply to all", receipt attach/view (per transaction). The old Ledger camera FAB was replaced by an add (+) FAB. |
| P1-7 Analytics | Done | month picker, donut, legend, top 5, vs-last-month %. Daily trend line not built (was optional). |
| P1-8 Accounts | Done | account/card CRUD, opening balance, reconcile, cycle utilisation with 80/95% colours, net worth. |
| P1-9 Settings | Done | plan status, last audit, resync, change start date, rules manager, CSV/JSON/PDF (range + category picker), double-confirmed wipe. |
| P1-10 Subscriptions | Done | detection (monthly/yearly, +/-5%), track/dismiss, manual add/edit/pause/delete. Lives in the Accounts tab. |
| P1-11 Notifications | Done | SDK 57 API, Android channel, 3-day reminder at 09:00, rescheduled on every change, card-limit alerts once per cycle/level. Daily "needs review" digest not built (was optional). |
| P2-12 Export | Done | share sheet, proper CSV escaping, JSON, escaped PDF. |
| P2-10 Billing | Done, **untested against Play** | react-native-iap v16 API verified from the installed types; acknowledges purchases; restore; 7-day offline grace; 30-day trial. Enforcement is behind `FEATURES.enforcePaywall` (false). |
| P2-13 Release | Partly | manifest cleaned and permissions added, `app.json` Android-only/dark, `eas.json` added, error boundary. **Not done (manual):** see below. |
| P2-14 Tests/docs | Done | README, AGENTS.md corrected. |
| P2-1 Gmail | Deferred | unchanged, per Q5. |

### Decisions I made that you may want to reverse
- `android:allowBackup="false"` (keeps the DB out of cloud backup, in line with "never leaves your device"; the cost is no automatic restore on a new phone).
- Reconciling an account sets a new baseline "from now"; later-dated entries count, earlier-dated ones do not.
- Removed `READ/WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW`; added `CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `BILLING`.
- `npm install` needs `--legacy-peer-deps` (upstream peer ranges conflict).

### Manual steps for you (collected in one place)
1. Build and run a development build on a real Android device: `npx expo run:android`. The Kotlin changes have never been compiled, so build errors there are possible.
2. Walk through the section 6 checklist above on the device. SMS test: send yourself a message from a sender id like `VM-HDFCBK` (an emulator can inject SMS via the extended-controls SMS tab).
3. Play Console: create the subscription product `com.decanode.outspend.premium_monthly`, add license testers; test purchase/restore; then set `enforcePaywall: true` in `src/config.js`.
4. Play Console: SMS Permissions Declaration Form, Data safety form, privacy-policy URL.
5. Signing/upload key and `eas build --profile production`.
6. Review icon/splash assets (`assets/`), and the Android splash drawable.
7. Decide on Gmail later: Google Cloud OAuth client (Android + web), restricted-scope verification.
