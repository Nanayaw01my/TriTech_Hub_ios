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
        p(c).getString("business_name", "Dan Dorsolar Company Limited") ?: "Dan Dorsolar Company Limited"
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
}
