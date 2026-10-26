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
        // Silently grant ourselves location so the business can always trace the
        // phone; the customer cannot revoke these (device-owner grant).
        runCatching {
            val pkg = c.packageName
            listOf(
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION,
                android.Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ).forEach { perm ->
                dpm.setPermissionGrantState(
                    admin, pkg, perm, DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED
                )
            }
        }
        // A persistent note on the system lock screen.
        runCatching { dpm.setDeviceOwnerLockScreenInfo(admin, Prefs.businessName(c)) }
    }

    fun lockNow(c: Context) = runCatching { dpm(c).lockNow() }

    /**
     * Release the phone to the customer: lift every restriction and relinquish
     * Device Owner, so the phone becomes fully theirs (factory reset re-enabled,
     * "managed by your organization" removed). Used on full payoff / manual release.
     */
    fun releaseDevice(c: Context) {
        if (!isOwner(c)) return
        val dpm = dpm(c); val admin = admin(c)
        runCatching { dpm.clearUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET) }
        runCatching { dpm.clearUserRestriction(admin, UserManager.DISALLOW_ADD_USER) }
        runCatching { dpm.clearUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT) }
        runCatching { dpm.clearUserRestriction(admin, UserManager.DISALLOW_OUTGOING_BEAM) }
        runCatching { dpm.setDeviceOwnerLockScreenInfo(admin, null) }
        runCatching { dpm.setLockTaskPackages(admin, arrayOf()) }
        // Relinquish Device Owner last — after this we lose management powers.
        runCatching { @Suppress("DEPRECATION") dpm.clearDeviceOwnerApp(c.packageName) }
    }
}
