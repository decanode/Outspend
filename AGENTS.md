This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Project architecture (read this before changing structure)

Outspend is an **Android-only**, plain-JavaScript, offline-first expense tracker. The generic Expo-starter guidance above is overridden where it conflicts with this section.

- **Navigation:** React Navigation bottom tabs in `App.js`. We deliberately do **not** use Expo Router: the app is a bare-workflow project with a custom Kotlin SMS module, and `android/` is committed and edited by hand (the "never edit `ios/`/`android/`" rule does not apply here).
- **Data:** WatermelonDB (SQLite). Schema/migrations in `src/db/`. Screens never write to the DB directly; use the helpers in `src/data/`.
- **Pure logic** (parser, rules, analytics, subscription detection, export formatting, access/trial) lives in `src/services/` with no native or DB imports, and is unit-tested in `__tests__/`. Keep it that way.
- **SMS pipeline:** `SmsModule.kt` -> `src/native/Sms.js` -> `SmsIngest.js` -> `TransactionManager.js` (commit) <- `IngestPlanner.js` (pure plan). Every SMS gets a stable `external_id`, so imports are idempotent.
- **Privacy is a product constraint:** no analytics, no remote logging, no network calls with user data. SMS and receipts stay on the device.
- **Settings/flags:** persisted app state in `src/services/Settings.js`; release switches in `src/config.js` (`enforcePaywall`).

## Commands for this repo

```bash
npm install --legacy-peer-deps   # peer ranges conflict upstream; this is required
npm test                         # jest (pure logic + in-memory WatermelonDB integration)
npm run lint                     # expo lint
npx expo-doctor
npx expo run:android             # needs a dev build; Expo Go cannot load the native modules
```

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
