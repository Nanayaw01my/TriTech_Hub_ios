package com.dandorsolar.lockagent

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.PersistableBundle

class LockDeviceAdminReceiver : DeviceAdminReceiver() {

    /** Legacy provisioning path (Android 9 and below). */
    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        @Suppress("DEPRECATION")
        val extras = intent.getParcelableExtra<PersistableBundle>(
            DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        )
        Provisioning.store(context, extras)
        Policy.applyBasePolicies(context)
        App.scheduleSync(context)
        App.syncNow(context)
    }

    /** Someone is trying to take away the app's admin rights (Settings → Device
     *  admin apps). Android blocks this for the Device Owner; report it anyway. */
    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        DeviceEvents.report(context, "admin_disable_attempt", "device admin settings")
        return "This phone is managed by ${Prefs.businessName(context)} until it is fully paid. " +
            "This attempt has been reported."
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Policy.applyBasePolicies(context)
        Trace.send(context, "admin_enabled", "owner=${Policy.isOwner(context)}")
    }
}
