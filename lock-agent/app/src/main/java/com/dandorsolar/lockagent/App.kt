package com.dandorsolar.lockagent

import android.app.Application
import android.content.Context
import android.content.Intent
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        // Report that the app process started (only while not yet enrolled), so a
        // failed QR setup shows whether our app was ever installed and launched.
        if (!Prefs.enrolled(this)) Trace.send(this, "app_started", "owner=${Policy.isOwner(this)}")
        Notifications.ensureChannel(this)
        Fcm.init(this)
        Fcm.fetchToken { Prefs.setFcmToken(this, it) }
        scheduleSync(this)
        Deadline.schedule(this) // offline deadline checks (no network needed)
        // Android 9+ only sends "shutting down" to receivers registered at run
        // time (while the app is running), so register here too.
        runCatching {
            val f = android.content.IntentFilter(Intent.ACTION_SHUTDOWN)
            f.addAction("android.intent.action.QUICKBOOT_POWEROFF")
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                registerReceiver(ShutdownReceiver(), f, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(ShutdownReceiver(), f)
            }
        }
    }

    companion object {
        private const val WORK = "dd_sync"

        /** Keep a 15-minute (WorkManager minimum) periodic poll running. */
        fun scheduleSync(c: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(c)
                .enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req)
        }

        fun syncNow(c: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val req = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(c).enqueue(req)
        }

        /** One delayed sync (no network needed — the local checks still run).
         *  Unique, so repeated calls don't pile up. */
        fun syncLater(c: Context, minutes: Long) {
            val req = OneTimeWorkRequestBuilder<SyncWorker>()
                .setInitialDelay(minutes, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(c)
                .enqueueUniqueWork("dd_sync_later", ExistingWorkPolicy.REPLACE, req)
        }
    }
}
