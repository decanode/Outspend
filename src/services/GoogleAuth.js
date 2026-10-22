import { GoogleSignin } from '@react-native-google-signin/google-signin'

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Will be replaced in production
    offlineAccess: true,
  })
}

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices()
    const userInfo = await GoogleSignin.signIn()
    return userInfo
  } catch (error) {
    console.error("Google SignIn Error", error)
    return null
  }
}

export const syncGmailReceipts = async () => {
  try {
    const tokens = await GoogleSignin.getTokens();
    const query = 'from:(swiggy OR irctc OR amazon OR uber OR zomato) subject:("order summary" OR "tax invoice" OR "booking confirmation")';
    
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`
      }
    });
    const data = await response.json();
    
    if (data.messages) {
      // Stub: Iterate through messages, fetch body, parse, and save to WatermelonDB
      console.log(`Found ${data.messages.length} receipt emails.`);
    }
  } catch (error) {
    console.error("Gmail Sync Error", error);
  }
}
