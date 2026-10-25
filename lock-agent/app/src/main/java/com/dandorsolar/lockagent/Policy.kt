package com.dandorsolar.lockagent

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.UserManager
import android.util.Log

/** Thin wrapper over DevicePolicyManager for the Device Owner powers we use. */
object Policy {
    private const val TAG = "DDAgent"

    fun admin(c: Context) = ComponentName(c, LockDeviceAdminReceiver::class.java)
    fun dpm(c: Context) = c.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    fun isOwner(c: Context): Boolean = dpm(c).isDeviceOwnerApp(c.packageName)

    /** Lock the enforcement posture in place: block the escape routes. */
    fun applyBasePolicies(c: Context) {
        if (!isOwner(c)) { Log.w(TAG, "applyBasePolicies: not device owner"); return }
        val dpm = dpm(c); val admin = admin(c)
        runCatching { dpm.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET) }
        runCatching { dpm.addUserRestriction(admin, UserManager.DISALLOW_ADD_USER) }
        runCatching { dpm.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT) }
        runCatching { dpm.addUserRestriction(admin, UserManager.DISALLOW_OUTGOING_BEAM) }
        // Let only our app run in lock-task (kiosk) mode — no exit confirmation.
        runCatching { dpm.setLockTaskPackages(admin, arrayOf(c.packageName)) }
        // A persistent note on the system lock screen.
        runCatching { dpm.setDeviceOwnerLockScreenInfo(admin, Prefs.businessName(c)) }
    }

    fun lockNow(c: Context) = runCatching { dpm(c).lockNow() }

    /** Called on unlock: leave factory reset blocked (device still on a plan). */
    fun clearRestrictionsForFullPayoff(c: Context) {
        if (!isOwner(c)) return
        val dpm = dpm(c); val admin = admin(c)
        runCatching { dpm.clearUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET) }
        runCatching { dpm.clearUserRestriction(admin, UserManager.DISALLOW_ADD_USER) }
        runCatching { dpm.clearUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT) }
    }
}
