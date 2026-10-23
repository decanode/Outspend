import { NativeModules, Platform } from 'react-native'

const { WidgetModule } = NativeModules

/** Push the two lines shown on the home-screen widget. Safe no-op where unavailable. */
export const updateWidget = async (todayText, budgetText) => {
  if (Platform.OS !== 'android' || !WidgetModule) return
  try {
    await WidgetModule.update(todayText, budgetText)
  } catch (e) {
    console.error('Widget update failed', e)
  }
}
