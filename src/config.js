// Release switches. Flip enforcePaywall to true for the production build once the
// Play Console subscription product exists.
export const FEATURES = {
  enforcePaywall: false,
}

// iPhone: link that installs the "Add to Outspend" Shortcut (Shortcuts app > share > Copy iCloud Link).
// Null until the Shortcut has been built; the app then shows setup instructions instead of an install button.
export const SHORTCUT_URL = null
