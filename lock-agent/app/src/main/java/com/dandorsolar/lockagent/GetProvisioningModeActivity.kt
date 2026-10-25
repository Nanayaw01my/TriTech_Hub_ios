package com.dandorsolar.lockagent

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle

/**
 * Android 10+ asks the DPC which provisioning mode to use. We always want a
 * fully-managed (Device Owner) device.
 */
class GetProvisioningModeActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val result = Intent().putExtra(
            DevicePolicyManager.EXTRA_PROVISIONING_MODE,
            DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE
        )
        setResult(RESULT_OK, result)
        finish()
    }
}
