package com.example.pawmily

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

class ReminderAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(EXTRA_TITLE) ?: context.getString(R.string.app_name)
        val message = intent.getStringExtra(EXTRA_MESSAGE)
            ?: context.getString(R.string.reminder_notification_fallback)
        val reminderId = intent.getStringExtra(EXTRA_REMINDER_ID) ?: title
        val highPriority = intent.getBooleanExtra(EXTRA_HIGH_PRIORITY, false)

        ReminderNotifier.ensureChannels(context)

        val openIntent = Intent(context, DashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context,
            reminderId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = if (highPriority) {
            ReminderNotifier.CHANNEL_HIGH
        } else {
            ReminderNotifier.CHANNEL_DEFAULT
        }

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (highPriority) {
            builder
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
        } else {
            builder.setPriority(NotificationCompat.PRIORITY_DEFAULT)
        }

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(reminderId.hashCode(), builder.build())
    }

    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_MESSAGE = "message"
        const val EXTRA_REMINDER_ID = "reminderId"
        const val EXTRA_HIGH_PRIORITY = "highPriority"
    }
}
