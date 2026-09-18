package com.example.pawmily

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

object ReminderNotifier {
    const val CHANNEL_DEFAULT = "pawmily_reminders"
    const val CHANNEL_HIGH = "pawmily_reminders_high"
    const val CHANNEL_INBOX = "pawmily_inbox"

    fun canNotify(context: Context): Boolean {
        if (!SessionManager(context).areNotificationsEnabled()) return false
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val defaultChannel = NotificationChannel(
            CHANNEL_DEFAULT,
            "Recordatorios",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Recordatorios de PawMily"
        }

        val highChannel = NotificationChannel(
            CHANNEL_HIGH,
            "Recordatorios prioritarios",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Recordatorios de alta prioridad"
            enableVibration(true)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }

        val inboxChannel = NotificationChannel(
            CHANNEL_INBOX,
            "Correo de la clínica",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Avisos de citas, cancelaciones y solicitudes"
            enableVibration(true)
        }

        nm.createNotificationChannel(defaultChannel)
        nm.createNotificationChannel(highChannel)
        nm.createNotificationChannel(inboxChannel)
    }

    /** Immediate notification for clinic/inbox messages (not an alarm). */
    fun notifyInbox(context: Context, title: String, body: String) {
        ensureChannels(context)
        if (!canNotify(context)) return

        val openIntent = Intent(context, InboxActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context,
            (title + body).hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = androidx.core.app.NotificationCompat.Builder(context, CHANNEL_INBOX)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(androidx.core.app.NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setCategory(androidx.core.app.NotificationCompat.CATEGORY_MESSAGE)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(("inbox_" + System.currentTimeMillis()).hashCode(), notification)
    }

    fun schedule(
        context: Context,
        reminderId: String,
        title: String,
        message: String?,
        dateIso: String,
        timeHm: String,
        priority: String?,
        notifyEnabled: Boolean
    ) {
        ensureChannels(context)
        cancel(context, reminderId)
        if (!notifyEnabled) return
        if (!canNotify(context)) return

        val triggerAt = parseTriggerMillis(dateIso, timeHm) ?: return
        if (triggerAt <= System.currentTimeMillis()) return

        val high = priority.equals("alta", ignoreCase = true)
        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            putExtra(ReminderAlarmReceiver.EXTRA_REMINDER_ID, reminderId)
            putExtra(ReminderAlarmReceiver.EXTRA_TITLE, title)
            putExtra(ReminderAlarmReceiver.EXTRA_MESSAGE, message ?: title)
            putExtra(ReminderAlarmReceiver.EXTRA_HIGH_PRIORITY, high)
        }

        val pending = PendingIntent.getBroadcast(
            context,
            reminderId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (high && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        }
    }

    fun cancel(context: Context, reminderId: String) {
        val intent = Intent(context, ReminderAlarmReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            context,
            reminderId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pending)
    }

    private fun parseTriggerMillis(dateIso: String, timeHm: String): Long? {
        return try {
            val dateParts = dateIso.trim().split("-").map { it.toInt() }
            val timeParts = timeHm.trim().split(":").map { it.toInt() }
            if (dateParts.size < 3 || timeParts.size < 2) return null
            Calendar.getInstance().apply {
                set(Calendar.YEAR, dateParts[0])
                set(Calendar.MONTH, dateParts[1] - 1)
                set(Calendar.DAY_OF_MONTH, dateParts[2])
                set(Calendar.HOUR_OF_DAY, timeParts[0])
                set(Calendar.MINUTE, timeParts[1])
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        } catch (_: Exception) {
            null
        }
    }
}
