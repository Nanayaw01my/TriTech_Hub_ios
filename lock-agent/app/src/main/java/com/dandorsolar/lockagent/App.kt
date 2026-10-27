package com.dandorsolar.lockagent

import android.app.Application
import android.content.Context
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
        Notifications.ensureChannel(this)
        scheduleSync(this)
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
