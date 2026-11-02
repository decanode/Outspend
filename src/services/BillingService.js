import {
  initConnection, fetchProducts, requestPurchase, finishTransaction, restorePurchases,
  hasActiveSubscriptions, purchaseUpdatedListener, purchaseErrorListener,
} from 'react-native-iap'
import { getSettings, updateSettings } from './Settings'
import { computeAccess } from './Access'
import { FEATURES } from '../config'

// Price is set per country in Play Console; the app only ever shows the store's localised price.
export const SUBSCRIPTION_SKU = 'com.decanode.outspend.premium_monthly'
export const FALLBACK_PRICE = null

let connected = false
const connect = async () => {
  if (connected) return
  await initConnection()
  connected = true
}

/** true / false from Google Play, or null when Play could not be reached. */
const queryEntitlement = async () => {
  try {
    await connect()
    return await hasActiveSubscriptions([SUBSCRIPTION_SKU])
  } catch (err) {
    console.error('Entitlement check failed', err)
    return null
  }
}

export const ensureTrialStarted = async () => {
  const s = await getSettings()
  if (!s.trialStartedAt) await updateSettings({ trialStartedAt: Date.now() })
}

/** Resolve the current access state (trial / subscribed / expired). */
export const getAccessState = async () => {
  const entitled = await queryEntitlement()
  if (entitled === true) await updateSettings({ lastEntitledAt: Date.now() })
  const s = await getSettings()
  const access = computeAccess({
    trialStartedAt: s.trialStartedAt,
    entitled,
    lastEntitledAt: s.lastEntitledAt,
  })
  // Until enforcement is switched on, nobody is locked out; the real status is still reported.
  return { ...access, enforced: FEATURES.enforcePaywall, hasAccess: FEATURES.enforcePaywall ? access.hasAccess : true }
}

/** Product details for the paywall; falls back to the known price if Play is unavailable. */
export const loadOffer = async () => {
  try {
    await connect()
    const products = await fetchProducts({ skus: [SUBSCRIPTION_SKU], type: 'subs' })
    const product = products && products[0]
    if (!product) return { price: FALLBACK_PRICE, offerToken: null }
    const offer = (product.subscriptionOffers || []).find(o => o.offerTokenAndroid)
    return { price: product.displayPrice || FALLBACK_PRICE, offerToken: offer ? offer.offerTokenAndroid : null }
  } catch (err) {
    console.error('Could not load product', err)
    return { price: FALLBACK_PRICE, offerToken: null }
  }
}

export const subscribe = async (offerToken) => {
  await connect()
  await requestPurchase({
    type: 'subs',
    request: {
      google: {
        skus: [SUBSCRIPTION_SKU],
        subscriptionOffers: offerToken ? [{ sku: SUBSCRIPTION_SKU, offerToken }] : [],
      },
      apple: { sku: SUBSCRIPTION_SKU },
    },
  })
}

export const restore = async () => {
  await connect()
  await restorePurchases()
  return getAccessState()
}

/**
 * Listen for purchase results. Purchases must be acknowledged (finishTransaction) or
 * Google Play refunds them after 3 days. Returns a cleanup function.
 */
export const startPurchaseListeners = ({ onPurchased, onError }) => {
  const updated = purchaseUpdatedListener(async (purchase) => {
    if (purchase.productId !== SUBSCRIPTION_SKU || purchase.purchaseState !== 'purchased') return
    try {
      await finishTransaction({ purchase, isConsumable: false })
      await updateSettings({ lastEntitledAt: Date.now() })
      onPurchased()
    } catch (err) {
      console.error('Could not finish transaction', err)
      onError(err)
    }
  })
  const failed = purchaseErrorListener((err) => {
    if (err && err.code === 'user-cancelled') return
    onError(err)
  })
  return () => { updated.remove(); failed.remove() }
}
