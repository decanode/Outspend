import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { syncInbox } from './SmsIngest'
import { refreshReminders } from './NotificationService'

export const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK'

// Must be defined at module scope so the OS can run it with the app closed.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await syncInbox()
    await refreshReminders()
    return BackgroundTask.BackgroundTaskResult.Success
  } catch (err) {
    console.error('Background sync failed', err)
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

export const registerBackgroundSync = async () => {
  try {
    const status = await BackgroundTask.getStatusAsync()
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 24 * 60, // minutes: daily audit
    })
  } catch (err) {
    console.error('Failed to register background task', err)
  }
}
