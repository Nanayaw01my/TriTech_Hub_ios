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

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Policy.applyBasePolicies(context)
    }
}
