package com.dandorsolar.lockagent

import android.content.Context

/**
 * Enrollment breadcrumbs: tell the server which setup step this phone reached,
 * so a failed QR enrollment shows in Enroll Stock where it stopped. Best-effort,
 * off the main thread, never throws.
 */
object Trace {
    fun send(c: Context, stage: String, detail: String = "") {
        val app = c.applicationContext
        val backend = Prefs.backendUrl(app)
        val token = Prefs.enrollmentToken(app)
        if (backend.isEmpty() || token.isEmpty()) return
        Thread {
            runCatching {
                Api.trace(
                    backend, token, stage, detail, DeviceInfo.model(),
                    DeviceInfo.androidVersion(), BuildConfig.VERSION_NAME,
                    runCatching { DeviceInfo.androidId(app) }.getOrDefault("")
                )
            }
        }.start()
    }
}
