package com.dandorsolar.lockagent

import android.content.Context
import android.os.BaseBundle

/** Reads the admin-extras bundle delivered during Device Owner provisioning. */
object Provisioning {
    fun store(c: Context, b: BaseBundle?) {
        if (b == null) return
        b.getString("backend_url")?.takeIf { it.isNotBlank() }?.let { Prefs.setBackendUrl(c, it) }
        b.getString("enrollment_token")?.takeIf { it.isNotBlank() }?.let { Prefs.setEnrollmentToken(c, it) }
        b.getString("business_name")?.takeIf { it.isNotBlank() }?.let { Prefs.setBusinessName(c, it) }
        b.getString("unlock_contact")?.let { Prefs.setUnlockContact(c, it) }
    }
}
