package com.decanode.outspend

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Lets JS push the two lines shown on the home-screen widget. */
class WidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetModule"

    @ReactMethod
    fun update(today: String, budget: String, promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences(SpendWidgetProvider.PREFS, android.content.Context.MODE_PRIVATE)
                .edit()
                .putString(SpendWidgetProvider.KEY_TODAY, today)
                .putString(SpendWidgetProvider.KEY_BUDGET, budget)
                .apply()
            SpendWidgetProvider.refreshAll(reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_WIDGET", e.message, e)
        }
    }
}
