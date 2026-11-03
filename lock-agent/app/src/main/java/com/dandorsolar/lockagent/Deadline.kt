package com.dandorsolar.lockagent

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Offline enforcement. The normal sync only runs with a connection, so a
 * customer who switches data off would otherwise never be locked. These run on
 * the phone's own clock with NO network needed:
 *  - an alarm at the exact payment deadline (paid_until);
 *  - a 15-minute check with no network constraint (backup, and the dead-man switch);
 *  - a check at boot (see BootReceiver).
 */
object Deadline {
    private const val TAG = "DDAgent"
    private const val WORK = "dd_deadline_check"

    /** (Re)arm everything. Safe to call often. */
    fun schedule(c: Context) {
        val app = c.applicationContext
        // 15-minute local check — no network required.
        runCatching {
            val req = PeriodicWorkRequestBuilder<DeadlineWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(app).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
        }
        // Alarm at the deadline itself.
        val am = app.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val pi = PendingIntent.getBroadcast(
            app, 4711, Intent(app, DeadlineReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.cancel(pi)
        val at = Prefs.paidUntil(app)
        if (at <= 0L) return
        val whenMs = maxOf(at + 1000L, System.currentTimeMillis() + 5000L)
        // Inexact-but-allowed-while-idle needs no special permission; Android
        // delivers it within minutes even in Doze.
        runCatching { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi) }
            .onFailure { Log.w(TAG, "deadline alarm failed: ${it.message}") }
    }

    /** Run the local checks now (deadline passed / dead-man switch). */
    fun checkNow(c: Context) {
        runCatching { SyncManager.enforceDeadline(c.applicationContext) }
            .onFailure { Log.w(TAG, "deadline check failed: ${it.message}") }
    }
}

/** Fires at the payment deadline. */
class DeadlineReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Off the main thread: locking also tries to tell the server.
        val pending = goAsync()
        Thread {
            try {
                Deadline.checkNow(context)
                runCatching { Deadline.schedule(context) } // re-arm (e.g. after the deadline moved)
            } finally {
                pending.finish()
            }
        }.start()
    }
}

/** 15-minute offline check. */
class DeadlineWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.Default) {
        Deadline.checkNow(applicationContext)
        Result.success()
    }
}
