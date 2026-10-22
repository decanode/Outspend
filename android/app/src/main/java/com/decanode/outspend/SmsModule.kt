package com.decanode.outspend

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.provider.Telephony
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var receiverRegistered = false

    private val smsReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

            // A long SMS arrives as several PDUs in one intent: stitch them back together per sender.
            val bodies = LinkedHashMap<String, StringBuilder>()
            val stamps = HashMap<String, Long>()
            for (sms in messages) {
                val address = sms.displayOriginatingAddress ?: continue
                bodies.getOrPut(address) { StringBuilder() }.append(sms.displayMessageBody ?: "")
                if (!stamps.containsKey(address)) stamps[address] = sms.timestampMillis
            }

            for ((address, body) in bodies) {
                val params: WritableMap = Arguments.createMap()
                params.putString("sender", address)
                params.putString("body", body.toString())
                params.putDouble("timestamp", (stamps[address] ?: System.currentTimeMillis()).toDouble())
                sendEvent("onSmsReceived", params)
            }
        }
    }

    init {
        registerSmsReceiver()
    }

    private fun registerSmsReceiver() {
        if (receiverRegistered) return
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        // Only the system (holder of BROADCAST_SMS) may deliver to this receiver.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.registerReceiver(
                smsReceiver, filter, Manifest.permission.BROADCAST_SMS, null, Context.RECEIVER_EXPORTED
            )
        } else {
            reactApplicationContext.registerReceiver(smsReceiver, filter, Manifest.permission.BROADCAST_SMS, null)
        }
        receiverRegistered = true
    }

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

    // Required by NativeEventEmitter-style listeners; events go through DeviceEventEmitter.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun invalidate() {
        if (receiverRegistered) {
            try {
                reactApplicationContext.unregisterReceiver(smsReceiver)
            } catch (_: IllegalArgumentException) {
                // already unregistered
            }
            receiverRegistered = false
        }
        super.invalidate()
    }
}
