package com.decanode.outspend

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.HeadlessJsTaskService

/**
 * Declared in the manifest, so Android starts it for every incoming SMS even when the app
 * is closed. It hands each message to [SmsHeadlessTaskService], which runs the JS parser.
 */
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
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
            val service = Intent(context, SmsHeadlessTaskService::class.java).apply {
                putExtra("sender", address)
                putExtra("body", body.toString())
                putExtra("timestamp", stamps[address] ?: System.currentTimeMillis())
            }
            try {
                HeadlessJsTaskService.acquireWakeLockNow(context)
                context.startService(service)
            } catch (e: IllegalStateException) {
                // Background start was refused by the OS. The message is not lost: the delta
                // sync imports it the next time the app opens or the daily task runs.
            }
        }
    }
}
