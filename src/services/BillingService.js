import { initConnection, getAvailablePurchases } from 'react-native-iap';

const SUBSCRIPTION_SKU = 'com.decanode.outspend.premium_monthly'; // ₹299/month

export const checkEntitlement = async () => {
  try {
    await initConnection();
    const purchases = await getAvailablePurchases();
    
    // Check if the user has an active subscription
    const hasActiveSub = purchases.some(p => p.productId === SUBSCRIPTION_SKU);
    return hasActiveSub;
  } catch (err) {
    console.error("IAP Error", err);
    // Defaulting to false on error ensures paywall triggers if connection fails
    return false; 
  }
}
