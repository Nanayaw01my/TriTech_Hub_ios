package com.dandorsolar.lockagent

import android.content.Context

/** Small persistent store for enrollment + lock state. */
object Prefs {
    private const val FILE = "dd_agent"
    private fun p(c: Context) = c.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun backendUrl(c: Context): String = p(c).getString("backend_url", "") ?: ""
    fun setBackendUrl(c: Context, v: String) = p(c).edit().putString("backend_url", v.trimEnd('/')).apply()

    fun enrollmentToken(c: Context): String = p(c).getString("enrollment_token", "") ?: ""
    fun setEnrollmentToken(c: Context, v: String) = p(c).edit().putString("enrollment_token", v).apply()

    fun deviceId(c: Context): String = p(c).getString("device_id", "") ?: ""
    fun setDeviceId(c: Context, v: String) = p(c).edit().putString("device_id", v).apply()

    fun deviceSecret(c: Context): String = p(c).getString("device_secret", "") ?: ""
    fun setDeviceSecret(c: Context, v: String) = p(c).edit().putString("device_secret", v).apply()

    fun businessName(c: Context): String =
        p(c).getString("business_name", "Dan & Dor Solar Company Ltd.") ?: "Dan & Dor Solar Company Ltd."
    fun setBusinessName(c: Context, v: String) = p(c).edit().putString("business_name", v).apply()

    fun unlockContact(c: Context): String = p(c).getString("unlock_contact", "") ?: ""
    fun setUnlockContact(c: Context, v: String) = p(c).edit().putString("unlock_contact", v).apply()

    fun lockMessage(c: Context): String = p(c).getString("lock_message", "") ?: ""
    fun setLockMessage(c: Context, v: String) = p(c).edit().putString("lock_message", v).apply()

    fun desiredLockState(c: Context): String = p(c).getString("desired", "unlocked") ?: "unlocked"
    fun setDesiredLockState(c: Context, v: String) = p(c).edit().putString("desired", v).apply()

    /** What the agent has actually applied right now. */
    fun appliedLockState(c: Context): String = p(c).getString("applied", "unlocked") ?: "unlocked"
    fun setAppliedLockState(c: Context, v: String) = p(c).edit().putString("applied", v).apply()

    fun enrolled(c: Context): Boolean = p(c).getBoolean("enrolled", false)
    fun setEnrolled(c: Context, v: Boolean) = p(c).edit().putBoolean("enrolled", v).apply()

    fun fcmToken(c: Context): String = p(c).getString("fcm_token", "") ?: ""
    fun setFcmToken(c: Context, v: String) = p(c).edit().putString("fcm_token", v).apply()

    /**
     * Offline self-lock deadline as epoch millis (0 = none). The phone locks
     * itself once its clock passes this, even with no internet. The server
     * refreshes it on every check-in while the customer is paid up.
     */
    fun paidUntil(c: Context): Long = p(c).getLong("paid_until", 0L)
    fun setPaidUntil(c: Context, v: Long) = p(c).edit().putLong("paid_until", v).apply()

    /** Dead-man switch: epoch millis of the last successful server check-in, and
     *  how many days of silence trigger a self-lock (0 = disabled). */
    fun lastSyncOk(c: Context): Long = p(c).getLong("last_sync_ok", 0L)
    fun setLastSyncOk(c: Context, v: Long) = p(c).edit().putLong("last_sync_ok", v).apply()

    fun deadmanDays(c: Context): Int = p(c).getInt("deadman_days", 7)
    fun setDeadmanDays(c: Context, v: Int) = p(c).edit().putInt("deadman_days", v).apply()

    /** Factory Reset Protection: the account list last applied + its result. */
    fun frpApplied(c: Context): String = p(c).getString("frp_applied", "") ?: ""
    fun setFrpApplied(c: Context, v: String) = p(c).edit().putString("frp_applied", v).apply()
    fun frpStatus(c: Context): String = p(c).getString("frp_status", "off") ?: "off"
    fun setFrpStatus(c: Context, v: String) = p(c).edit().putString("frp_status", v).apply()

    /** Self-update: the build the server offered, and our last attempt at it. */
    fun updateTargetCode(c: Context): Int = p(c).getInt("upd_code", 0)
    fun updateTargetUrl(c: Context): String = p(c).getString("upd_url", "") ?: ""
    fun updateTargetSha(c: Context): String = p(c).getString("upd_sha", "") ?: ""
    fun setUpdateTarget(c: Context, code: Int, url: String, sha: String) =
        p(c).edit().putInt("upd_code", code).putString("upd_url", url).putString("upd_sha", sha).apply()
    fun updateTriedVersion(c: Context): Int = p(c).getInt("upd_tried_code", 0)
    fun updateTriedAt(c: Context): Long = p(c).getLong("upd_tried_at", 0L)
    fun setUpdateTried(c: Context, code: Int, at: Long) =
        p(c).edit().putInt("upd_tried_code", code).putLong("upd_tried_at", at).apply()
    fun updateError(c: Context): String = p(c).getString("upd_error", "") ?: ""
    fun setUpdateError(c: Context, v: String) = p(c).edit().putString("upd_error", v).apply()
}
