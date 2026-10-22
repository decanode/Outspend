import { createContext, useContext } from 'react'

/** access: { status, trialDaysLeft, hasAccess, enforced }; actions come from App.js */
export const AppContext = createContext({
  access: { status: 'trial', trialDaysLeft: 30, hasAccess: true, enforced: false },
  refreshAccess: async () => {},
  restartOnboarding: async () => {},
})

export const useApp = () => useContext(AppContext)
