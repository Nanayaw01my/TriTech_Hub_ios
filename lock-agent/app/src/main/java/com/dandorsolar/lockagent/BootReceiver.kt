package com.dandorsolar.lockagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** After a reboot: re-arm the lock immediately so it can't be bypassed, then sync. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        App.scheduleSync(context)
        val shouldBeLocked =
            Prefs.appliedLockState(context) == "locked" || Prefs.desiredLockState(context) == "locked"
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
