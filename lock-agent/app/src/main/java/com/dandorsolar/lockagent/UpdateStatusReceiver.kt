package com.dandorsolar.lockagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log

/** Result of a self-update install. Success restarts the app (see BootReceiver). */
class UpdateStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""
        if (status == PackageInstaller.STATUS_SUCCESS) {
            Prefs.setUpdateError(context, "")
        } else {
            Log.w("DDAgent", "Update install status $status: $msg")
            Prefs.setUpdateError(context, "install status $status ${msg.take(120)}".trim())
        }
    }
}
