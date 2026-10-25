package com.dandorsolar.lockagent

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Periodic + on-demand sync, run by WorkManager off the main thread. */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            SyncManager.syncBlocking(applicationContext)
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
