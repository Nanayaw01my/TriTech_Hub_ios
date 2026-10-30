package com.dandorsolar.lockagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** After a reboot or a self-update: re-arm the lock immediately so it can't be
 *  bypassed, then sync. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        App.scheduleSync(context)
        // Re-show the lock OR the "Awaiting Activation" page straight after boot.
        val applied = Prefs.appliedLockState(context)
        val desired = Prefs.desiredLockState(context)
        val shouldBeLocked = applied == "locked" || desired == "locked" ||
            applied == "pending" || desired == "pending_activation"
        if (shouldBeLocked) {
            Notifications.showLockFullScreen(context)
            runCatching {
                context.startActivity(
                    Intent(context, LockActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
        }
        App.syncNow(context)
    }
}
