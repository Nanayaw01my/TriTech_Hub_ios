package com.dandorsolar.lockagent

import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject

/**
 * The heart of the agent: talk to the backend, learn the desired lock state,
 * and converge the phone to it. Safe to call repeatedly and from background
 * (worker, FCM, boot). All network happens here — call off the main thread.
 */
object SyncManager {
    private const val TAG = "DDAgent"
    const val ACTION_UNLOCK = "com.dandorsolar.lockagent.UNLOCK"

    /** First-time pairing: trade the enrollment token for a device secret. */
    fun tryEnroll(c: Context) {
        if (Prefs.enrolled(c)) return
        val backend = Prefs.backendUrl(c)
        val token = Prefs.enrollmentToken(c)
        if (backend.isEmpty() || token.isEmpty()) return

        val deviceId = DeviceInfo.androidId(c)
        val res = Api.enroll(
            backend, token, deviceId, DeviceInfo.imei(c),
            DeviceInfo.androidVersion(), BuildConfig.VERSION_NAME, DeviceInfo.model(),
            Prefs.fcmToken(c).ifEmpty { null }
        )
        val j = res.json
        if (res.ok && j != null && j.optBoolean("success", false)) {
            Prefs.setDeviceId(c, deviceId)
            Prefs.setDeviceSecret(c, j.optString("device_secret"))
            Prefs.setEnrolled(c, true)
            applyServerInfo(c, j)
            Log.i(TAG, "Enrolled successfully")
        } else {
            Log.w(TAG, "Enroll failed (code ${res.code})")
        }
    }

    /** One sync cycle: heartbeat, read desired state, apply it. */
    fun syncBlocking(c: Context) {
        if (!Prefs.enrolled(c)) {
            tryEnroll(c)
            if (!Prefs.enrolled(c)) return
        }
        val backend = Prefs.backendUrl(c)
        val id = Prefs.deviceId(c)
        val secret = Prefs.deviceSecret(c)
        if (backend.isEmpty() || id.isEmpty() || secret.isEmpty()) return

        val fix = LocationHelper.lastKnown(c)
        val res = Api.heartbeat(backend, id, secret, Prefs.appliedLockState(c), fix, Prefs.fcmToken(c).ifEmpty { null })
        val j = res.json ?: return
        if (!res.ok) return
        applyServerInfo(c, j)
        val desired = j.optString("desired_lock_state", Prefs.desiredLockState(c))
        Prefs.setDesiredLockState(c, desired)
        applyDesired(c, desired)
    }

    private fun applyServerInfo(c: Context, j: JSONObject) {
        j.optString("lock_message").takeIf { it.isNotEmpty() }?.let { Prefs.setLockMessage(c, it) }
        Prefs.setUnlockContact(c, j.optString("unlock_contact"))
        j.optString("business_name").takeIf { it.isNotEmpty() }?.let { Prefs.setBusinessName(c, it) }
    }

    /** Make the phone match [desired] ("locked"/"unlocked"). Idempotent. */
    fun applyDesired(c: Context, desired: String) {
        if (desired == "locked") lock(c) else unlock(c)
    }

    fun lock(c: Context) {
        Prefs.setAppliedLockState(c, "locked")
        Policy.applyBasePolicies(c)
        // Bring up the lock screen: a full-screen-intent notification works from
        // the background; a direct start covers the foreground case.
        Notifications.showLockFullScreen(c)
        runCatching {
            c.startActivity(
                Intent(c, LockActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            )
        }
        ack(c, "locked")
    }

    fun unlock(c: Context) {
        val wasLocked = Prefs.appliedLockState(c) == "locked"
        Prefs.setAppliedLockState(c, "unlocked")
        Notifications.clearLock(c)
        // Tell a showing LockActivity to leave kiosk mode and finish.
        c.sendBroadcast(Intent(ACTION_UNLOCK).setPackage(c.packageName))
        if (wasLocked) ack(c, "unlocked")
    }

    private fun ack(c: Context, state: String) {
        val backend = Prefs.backendUrl(c)
        val id = Prefs.deviceId(c)
        val secret = Prefs.deviceSecret(c)
        if (backend.isNotEmpty() && id.isNotEmpty() && secret.isNotEmpty()) {
            runCatching { Api.ack(backend, id, secret, state) }
        }
    }
}
