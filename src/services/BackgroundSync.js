import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { database } from '../db';
import { syncGmailReceipts } from './GoogleAuth';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log("Running Daily Audit Background Task...");
    
    // We can fetch SMS here natively or query Gmail
    await syncGmailReceipts();

    // Log the audit time (could be saved to AsyncStorage or DB)
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error("Background sync failed", err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerBackgroundSync = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 60 * 60 * 24, // 24 hours
      stopOnTerminate: false, // Android only
      startOnBoot: true, // Android only
    });
    console.log("Background sync task registered.");
  } catch (err) {
    console.error("Failed to register background task", err);
  }
};
