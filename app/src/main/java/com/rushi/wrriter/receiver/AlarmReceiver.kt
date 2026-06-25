package com.rushi.wrriter.receiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.rushi.wrriter.MainActivity

/**
 * BroadcastReceiver triggered by AlarmManager to post note-level reminder notifications.
 */
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "note_reminder_channel"
        const val EXTRA_NOTE_URI = "extra_note_uri"
        const val EXTRA_NOTE_TITLE = "extra_note_title"
        
        /**
         * Helper method to schedule an alarm for a note reminder.
         */
        fun scheduleAlarm(context: Context, noteUri: String, noteTitle: String, triggerTimeMs: Long) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? android.app.AlarmManager ?: return
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra(EXTRA_NOTE_URI, noteUri)
                putExtra(EXTRA_NOTE_TITLE, noteTitle)
            }
            
            // Unique RequestCode based on note URI hash to support multiple alarms
            val requestCode = noteUri.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerTimeMs,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerTimeMs,
                    pendingIntent
                )
            }
        }

        /**
         * Helper method to cancel a scheduled alarm.
         */
        fun cancelAlarm(context: Context, noteUri: String) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? android.app.AlarmManager ?: return
            val intent = Intent(context, AlarmReceiver::class.java)
            val requestCode = noteUri.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val noteUri = intent.getStringExtra(EXTRA_NOTE_URI) ?: return
        val noteTitle = intent.getStringExtra(EXTRA_NOTE_TITLE) ?: "Untitled Note"

        createNotificationChannel(context)

        val mainIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("open_note_uri", noteUri)
        }

        val requestCode = noteUri.hashCode()
        val pendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Note Reminder")
            .setContentText("Reminder for: $noteTitle")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.notify(requestCode, notification)
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Note Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Shows alarms scheduled for specific notes"
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
