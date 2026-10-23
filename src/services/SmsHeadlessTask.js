import { handleIncomingSms } from './SmsIngest'

// Registered in index.js. Runs in a background JS context when an SMS arrives.
export default async function SmsReceivedTask(data) {
  try {
    await handleIncomingSms(data)
  } catch (e) {
    console.error('SMS task failed', e)
  }
}
