package com.decanode.outspend

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the JS task "SmsReceivedTask" (registered in index.js) for one incoming SMS. */
class SmsHeadlessTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        val data = Arguments.createMap().apply {
            putString("sender", extras.getString("sender"))
            putString("body", extras.getString("body"))
            putDouble("timestamp", extras.getLong("timestamp").toDouble())
        }
        // 30s safety timeout; allowed in foreground so it also works while the app is open.
        return HeadlessJsTaskConfig("SmsReceivedTask", data, 30000, true)
    }
}
