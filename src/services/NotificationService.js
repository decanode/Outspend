import * as Notifications from 'expo-notifications';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const scheduleSubscriptionReminders = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // Scan database for Subscriptions table
  const subscriptions = await database.collections.get('subscriptions').query().fetch();
  
  subscriptions.forEach(async (sub) => {
    // If renewal date is within 3 days, schedule local notification
    const triggerDate = new Date(sub.renewal_date);
    triggerDate.setDate(triggerDate.getDate() - 3);

    if (triggerDate > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Subscription Renewal Alert',
          body: `Your ${sub.name} subscription of ₹${sub.amount} is renewing in 3 days.`,
        },
        trigger: triggerDate,
      });
    }
  });
}
