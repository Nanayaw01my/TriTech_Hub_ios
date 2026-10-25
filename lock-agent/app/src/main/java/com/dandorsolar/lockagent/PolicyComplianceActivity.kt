package com.dandorsolar.lockagent

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.os.Bundle
import android.os.PersistableBundle

/**
 * Shown by the system right after provisioning completes. We read the admin
 * extras (enrollment token + backend URL), lock down the device, enroll with
 * the backend, then hand control back.
 */
class PolicyComplianceActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        @Suppress("DEPRECATION")
        val extras = intent.getParcelableExtra<PersistableBundle>(
            DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        )
        Provisioning.store(this, extras)
        Policy.applyBasePolicies(this)
        App.scheduleSync(this)

        Thread {
            SyncManager.tryEnroll(applicationContext)
            SyncManager.syncBlocking(applicationContext)
            runOnUiThread {
                setResult(RESULT_OK)
                finish()
            }
        }.start()
    }
}
