package com.rushi.wrriter.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.rushi.wrriter.MainActivity
import com.rushi.wrriter.data.PreferencesManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Service tracking continuous typing activity and triggering break reminders.
 */
class BreakReminderService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var preferencesManager: PreferencesManager

    private var lastKeyPressTime: Long = 0
    private var sessionStartTime: Long = 0

    companion object {
        const val ACTION_KEYPRESS = "com.rushi.wrriter.ACTION_KEYPRESS"
        const val ACTION_EDITOR_CLOSED = "com.rushi.wrriter.ACTION_EDITOR_CLOSED"
        
        private const val NOTIFICATION_ID = 2001
        private const val CHANNEL_ID = "break_reminder_channel"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        preferencesManager = PreferencesManager(applicationContext)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null) {
            when (intent.action) {
                ACTION_KEYPRESS -> handleKeyPress()
                ACTION_EDITOR_CLOSED -> handleEditorClosed()
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    private fun handleKeyPress() {
        serviceScope.launch {
            val enabled = preferencesManager.breakReminderEnabledFlow.first()
            if (!enabled) return@launch

            val thresholdMinutes = preferencesManager.breakReminderThresholdFlow.first()
            val now = System.currentTimeMillis()

            if (sessionStartTime == 0L) {
                sessionStartTime = now
                lastKeyPressTime = now
                return@launch
            }

            val gap = now - lastKeyPressTime

            // If idle for more than 2 minutes, the continuous typing session is broken
            if (gap > 2 * 60 * 1000) {
                sessionStartTime = now
            }

            lastKeyPressTime = now

            val elapsed = now - sessionStartTime
            val thresholdMs = thresholdMinutes * 60 * 1000L

            if (elapsed >= thresholdMs) {
                fireBreakNotification()
                // Reset session to prevent spamming
                sessionStartTime = now
            }
        }
    }

    private fun handleEditorClosed() {
        // Reset the session when the editor is closed
        sessionStartTime = 0
        lastKeyPressTime = 0
    }

    private fun fireBreakNotification() {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = android.app.PendingIntent.getActivity(
            this,
            0,
            intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Time for a break!")
            .setContentText("You've been typing continuously. Take a quick break to rest your eyes.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Break Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifies when continuous typing exceeds break reminder thresholds"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
