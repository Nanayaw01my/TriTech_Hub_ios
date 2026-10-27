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
            Prefs.setLastSyncOk(c, System.currentTimeMillis())
            Prefs.setDesiredLockState(c, j.optString("desired_lock_state", Prefs.desiredLockState(c)))
            applyServerInfo(c, j)
            Log.i(TAG, "Enrolled successfully")
        } else {
            Log.w(TAG, "Enroll failed (code ${res.code})")
        }
    }

    /** One sync cycle: heartbeat, read desired state, apply it, then enforce the
     *  offline deadline. The deadline check runs even when the network is down —
     *  that is the whole point of the offline failsafe. */
    fun syncBlocking(c: Context) {
        if (!Prefs.enrolled(c)) {
            tryEnroll(c)
            if (!Prefs.enrolled(c)) return
        }
        val backend = Prefs.backendUrl(c)
        val id = Prefs.deviceId(c)
        val secret = Prefs.deviceSecret(c)
        var synced = false
        if (backend.isNotEmpty() && id.isNotEmpty() && secret.isNotEmpty()) {
            // Make sure we have an FCM token to report (best-effort, async).
            if (Fcm.enabled() && Prefs.fcmToken(c).isEmpty()) {
                Fcm.fetchToken { Prefs.setFcmToken(c, it) }
            }
            val fix = LocationHelper.lastKnown(c)
            val res = Api.heartbeat(backend, id, secret, Prefs.appliedLockState(c), fix, Prefs.fcmToken(c).ifEmpty { null })
            val j = res.json
            if (res.ok && j != null) {
                synced = true
                Prefs.setLastSyncOk(c, System.currentTimeMillis()) // dead-man: fed a heartbeat
                applyServerInfo(c, j)
                val desired = j.optString("desired_lock_state", Prefs.desiredLockState(c))
                Prefs.setDesiredLockState(c, desired)
                applyDesired(c, desired)
            }
        }
        // Offline: keep holding a not-yet-activated phone on the waiting page.
        if (!synced && Prefs.desiredLockState(c) == "pending_activation" &&
            Prefs.appliedLockState(c) != "pending") {
            awaitActivation(c)
        }
        // Offline failsafe — always, regardless of whether the server was reachable.
        enforceDeadline(c)
    }

    /**
     * Lock the phone locally if its stored payment deadline has passed. Needs no
     * internet: the phone enforces the installment schedule on its own clock. The
     * clock itself is held to network time by Device Owner policy (see Policy),
     * so the customer cannot rewind the date to dodge it.
     */
    fun enforceDeadline(c: Context) {
        if (Prefs.desiredLockState(c) == "released") return
        if (Prefs.desiredLockState(c) == "pending_activation") return // already held
        if (Prefs.appliedLockState(c) == "locked") return
        val deadline = Prefs.paidUntil(c)
        if (deadline <= 0L) return // stock / unactivated / released — no enforcement
        val now = System.currentTimeMillis()

        // 1) Offline self-lock: the installment deadline has passed.
        if (now > deadline) {
            Log.i(TAG, "Offline deadline passed — self-locking")
            lock(c)
            return
        }

        // 2) Dead-man switch: the phone (on an active plan) hasn't reached the
        //    server for too long — lock so it can't stay dark to dodge commands.
        val days = Prefs.deadmanDays(c)
        if (days > 0) {
            var last = Prefs.lastSyncOk(c)
            if (last <= 0L) { Prefs.setLastSyncOk(c, now); last = now } // seed, don't lock on first run
            if (now - last > days.toLong() * 24L * 60L * 60L * 1000L) {
                Log.i(TAG, "Dead-man: no check-in for $days days — self-locking")
                lock(c)
            }
        }
    }

    private fun applyServerInfo(c: Context, j: JSONObject) {
        j.optString("lock_message").takeIf { it.isNotEmpty() }?.let { Prefs.setLockMessage(c, it) }
        Prefs.setUnlockContact(c, j.optString("unlock_contact"))
        j.optString("business_name").takeIf { it.isNotEmpty() }?.let { Prefs.setBusinessName(c, it) }
        if (j.has("paid_until")) Prefs.setPaidUntil(c, j.optLong("paid_until", 0L))
        if (j.has("deadman_days")) Prefs.setDeadmanDays(c, j.optInt("deadman_days", 7))
    }

    /** Make the phone match [desired] ("locked"/"unlocked"/"released"/
     *  "pending_activation"). Idempotent. */
    fun applyDesired(c: Context, desired: String) {
        when (desired) {
            "released" -> release(c)
            "locked" -> lock(c)
            "pending_activation" -> awaitActivation(c)
            else -> unlock(c)
        }
    }

    /**
     * Hold the phone on the "Awaiting Activation" first page (same kiosk as the
     * lock screen, different wording) until the admin activates the sale. Used
     * for stock phones and sales still under review.
     */
    fun awaitActivation(c: Context) {
        // Never take over the screen during the setup wizard — that could break
        // provisioning. Retry shortly; it applies as soon as setup has finished.
        if (!setupComplete(c)) {
            App.syncLater(c, 2)
            return
        }
        Prefs.setAppliedLockState(c, "pending")
        Policy.applyBasePolicies(c)
        Notifications.showLockFullScreen(c)
        runCatching {
            c.startActivity(
                Intent(c, LockActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            )
        }
    }

    /** True once the device's first-run setup wizard has completed. */
    private fun setupComplete(c: Context): Boolean = runCatching {
        android.provider.Settings.Secure.getInt(c.contentResolver, "user_setup_complete", 1) == 1
    }.getOrDefault(true)

    /** Fully hand the phone to the customer: lift the lock + drop Device Owner. */
    fun release(c: Context) {
        // Done only once Device Owner is really gone — a failed attempt retries
        // on the next sync instead of being marked done.
        if (Prefs.appliedLockState(c) == "released" && !Policy.isOwner(c)) return
        Notifications.clearLock(c)
        c.sendBroadcast(Intent(ACTION_UNLOCK).setPackage(c.packageName))
        ack(c, "released")            // tell the backend first (network still works)
        Policy.releaseDevice(c)       // clears restrictions + relinquishes Device Owner
        if (Policy.isOwner(c)) {
            Prefs.setAppliedLockState(c, "release_pending")
            Log.w(TAG, "Release incomplete — still Device Owner, will retry")
        } else {
            Prefs.setAppliedLockState(c, "released")
            Log.i(TAG, "Device released to customer")
        }
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
        val applied = Prefs.appliedLockState(c)
        val wasLocked = applied == "locked" || applied == "pending"
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
