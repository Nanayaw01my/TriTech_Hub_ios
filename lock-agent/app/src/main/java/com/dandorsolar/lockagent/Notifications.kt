package com.dandorsolar.lockagent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * A high-importance full-screen-intent notification is the reliable way to
 * bring up the lock screen even when the agent is running in the background
 * (e.g. from the periodic worker or right after boot).
 */
object Notifications {
    const val CHANNEL_ID = "dd_lock"
    private const val LOCK_NOTIF_ID = 4201

    fun ensureChannel(c: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = c.getSystemService(NotificationManager::class.java)
            if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                val ch = NotificationChannel(
                    CHANNEL_ID, "Device Protection", NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Shows the lock screen when an account is overdue."
                    setShowBadge(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                mgr.createNotificationChannel(ch)
            }
        }
    }

    fun showLockFullScreen(c: Context) {
        ensureChannel(c)
        val intent = Intent(c, LockActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        val pi = PendingIntent.getActivity(c, 0, intent, flags)

        val notif = Notification.Builder(c, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(c.getString(R.string.lock_title))
            .setContentText(c.getString(R.string.lock_default_message))
            .setPriority(Notification.PRIORITY_MAX)
            .setCategory(Notification.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(pi, true)
            .setContentIntent(pi)
            .build()

        c.getSystemService(NotificationManager::class.java).notify(LOCK_NOTIF_ID, notif)
    }

    fun clearLock(c: Context) {
        c.getSystemService(NotificationManager::class.java).cancel(LOCK_NOTIF_ID)
    }
}
