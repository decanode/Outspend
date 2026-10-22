package com.decanode.outspend

import android.provider.Telephony
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

/**
 * Inbox access for the history import and delta sync. Live messages are delivered by the
 * manifest-declared [SmsReceiver] instead, so they also work when the app is closed.
 */
class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsModule"

    /**
     * Returns inbox messages with date >= sinceMs, oldest first, at most `limit` rows.
     * The caller pages by passing the last returned timestamp as the next sinceMs.
     */
    @ReactMethod
    fun getInboxSince(sinceMs: Double, limit: Int, promise: Promise) {
        try {
            val result = Arguments.createArray()
            val projection = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE)
            reactApplicationContext.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(sinceMs.toLong().toString()),
                "${Telephony.Sms.DATE} ASC"
            )?.use { cursor ->
                val addressIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
                var count = 0
                while (cursor.moveToNext() && count < limit) {
                    val row: WritableMap = Arguments.createMap()
                    row.putString("sender", cursor.getString(addressIdx) ?: "")
                    row.putString("body", cursor.getString(bodyIdx) ?: "")
                    row.putDouble("timestamp", cursor.getLong(dateIdx).toDouble())
                    result.pushMap(row)
                    count++
                }
            }
            promise.resolve(result)
        } catch (e: SecurityException) {
            promise.reject("E_SMS_PERMISSION", "READ_SMS permission not granted", e)
        } catch (e: Exception) {
            promise.reject("E_SMS_QUERY", e.message, e)
        }
    }
}
