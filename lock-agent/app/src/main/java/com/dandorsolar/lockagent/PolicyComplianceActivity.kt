package com.dandorsolar.lockagent

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.os.Bundle
import android.os.PersistableBundle

/**
 * Shown by the system right after provisioning completes. We read the admin
 * extras (enrollment token + backend URL), lock down the device, enroll with
 * the backend, then hand control back quickly — the full sync runs afterwards
 * in the background so setup isn't held up.
 */
class PolicyComplianceActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        @Suppress("DEPRECATION")
        val extras = intent.getParcelableExtra<PersistableBundle>(
            DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        )
        Provisioning.store(this, extras)
        Trace.send(this, "compliance_started", "owner=${Policy.isOwner(this)} extras=${extras != null}")
        Policy.applyBasePolicies(this)
        App.scheduleSync(this)

        Thread {
            val r = runCatching { SyncManager.tryEnroll(applicationContext) }.getOrElse { "error_${it.javaClass.simpleName}" }
            Trace.send(applicationContext, "enroll", r)
            App.syncNow(applicationContext)
            runOnUiThread {
                setResult(RESULT_OK)
                finish()
            }
        }.start()
    }
}
