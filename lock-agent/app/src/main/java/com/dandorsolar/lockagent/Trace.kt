package com.dandorsolar.lockagent

import android.content.Context

/**
 * Enrollment breadcrumbs: tell the server which setup step this phone reached,
 * so a failed QR enrollment shows in Enroll Stock where it stopped. Best-effort,
 * off the main thread, never throws.
 */
object Trace {
    private const val DEFAULT_BACKEND = "https://dandorsolar.site"

    fun send(c: Context, stage: String, detail: String = "") {
        val app = c.applicationContext
        // Fall back to the main server so even the very first moment (before the
        // QR's details reach us) is reported.
        val backend = Prefs.backendUrl(app).ifEmpty { DEFAULT_BACKEND }
        val token = Prefs.enrollmentToken(app)
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
