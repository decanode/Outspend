import { createContext, useContext } from 'react'

/**
 * access: { status, trialDaysLeft, hasAccess, enforced }
 * bumpPrefs: re-render the whole tab tree after a display preference changes (number format)
 * Actions come from App.js.
 */
export const AppContext = createContext({
  access: { status: 'trial', trialDaysLeft: 30, hasAccess: true, enforced: false },
  refreshAccess: async () => {},
  restartOnboarding: async () => {},
  bumpPrefs: () => {},
  pendingSalary: null, // set when the "has your salary arrived?" notification is tapped
  clearPendingSalary: () => {},
})

export const useApp = () => useContext(AppContext)
