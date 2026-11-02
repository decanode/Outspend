package com.decanode.outspend

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/** Home-screen widget: today's spend and what is left of the monthly budget. Tap to open the app. */
class SpendWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) manager.updateAppWidget(id, build(context))
    }

    companion object {
        const val PREFS = "outspend_widget"
        const val KEY_TODAY = "today"
        const val KEY_BUDGET = "budget"

        fun build(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val views = RemoteViews(context.packageName, R.layout.spend_widget)
            views.setTextViewText(R.id.widget_today, prefs.getString(KEY_TODAY, "Open Outspend") ?: "Open Outspend")
            views.setTextViewText(R.id.widget_budget, prefs.getString(KEY_BUDGET, "") ?: "")

            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launch != null) {
                val pending = PendingIntent.getActivity(
                    context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                views.setOnClickPendingIntent(R.id.widget_root, pending)
            }
            return views
        }

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, SpendWidgetProvider::class.java))
            for (id in ids) manager.updateAppWidget(id, build(context))
        }
    }
}
