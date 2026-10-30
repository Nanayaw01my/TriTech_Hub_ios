package com.dandorsolar.lockagent

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PersistableBundle

/**
 * Android 10+ asks the DPC which provisioning mode to use. We always want a
 * fully-managed (Device Owner) device. We also save the enrollment details here
 * (the first moment our app runs), so enrollment can still finish later even if
 * the phone is restarted mid-setup.
 */
class GetProvisioningModeActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        @Suppress("DEPRECATION")
        val extras = intent.getParcelableExtra<PersistableBundle>(
            DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        )
        Provisioning.store(this, extras)
        val allowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            intent.getIntegerArrayListExtra(DevicePolicyManager.EXTRA_PROVISIONING_ALLOWED_PROVISIONING_MODES)
        } else null
        Trace.send(this, "mode_requested", "allowed=${allowed ?: "n/a"} extras=${extras != null}")

        val result = Intent().putExtra(
            DevicePolicyManager.EXTRA_PROVISIONING_MODE,
            DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE
        )
        // Hand the admin extras on to the policy-compliance step.
        if (extras != null) result.putExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE, extras)
        setResult(RESULT_OK, result)
        finish()
    }
}
