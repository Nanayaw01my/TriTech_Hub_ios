package com.dandorsolar.lockagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** After a reboot or a self-update: re-arm the lock immediately so it can't be
 *  bypassed, then sync. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        App.scheduleSync(context)
        // Offline checks: lock right away if the deadline passed while the
        // phone was off, and re-arm the deadline alarm (alarms don't survive reboot).
        // (Before the phone's first unlock after boot, app storage may not be
        // readable yet; the normal boot broadcast that follows does the check.)
        runCatching { Deadline.checkNow(context) }
        runCatching { Deadline.schedule(context) }
        // Setup was interrupted by a restart before we enrolled: finish now.
        if (!Prefs.enrolled(context) && Prefs.enrollmentToken(context).isNotEmpty()) {
            Trace.send(context, "boot_not_enrolled", "owner=${Policy.isOwner(context)} ${intent.action?.substringAfterLast('.')}")
        }
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
