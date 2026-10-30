package com.dandorsolar.lockagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Computer (USB) enrollment, for phones where Google Play Protect blocks QR
 * setup. The enrollment script on the admin's laptop installs the app, makes it
 * Device Owner with `dpm set-device-owner`, then sends this broadcast with the
 * enrollment details (the same ones the QR carries):
 *
 *   am broadcast --include-stopped-packages
 *     -n com.dandorsolar.lockagent/.AdbProvisionReceiver
 *     --es enrollment_token <token> --es backend_url https://...
 *
 * Only the computer can send it (the receiver requires DUMP, which only the
 * adb shell and the system hold), and only before the phone is enrolled.
 */
class AdbProvisionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val c = context.applicationContext
        if (Prefs.enrolled(c)) { resultData = "already enrolled"; return }
        if (!Policy.isOwner(c)) { resultData = "not device owner - run dpm set-device-owner first"; return }
        val token = intent.getStringExtra("enrollment_token").orEmpty().trim()
        val backend = intent.getStringExtra("backend_url").orEmpty().trim()
        if (token.isEmpty() || !backend.startsWith("https://")) { resultData = "missing token or https backend_url"; return }

        Prefs.setBackendUrl(c, backend)
        Prefs.setEnrollmentToken(c, token)
        Trace.send(c, "adb_provision", "owner=true")
        Policy.applyBasePolicies(c)
        App.scheduleSync(c)

        val pending = goAsync()
        Thread {
            val r = runCatching { SyncManager.tryEnroll(c) }.getOrElse { "error_${it.javaClass.simpleName}" }
            Trace.send(c, "enroll", r)
            App.syncNow(c)
            pending.resultData = "enroll: $r"
            pending.finish()
        }.start()
    }
}
