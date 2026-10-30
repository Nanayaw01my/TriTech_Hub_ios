package com.dandorsolar.lockagent

import android.app.admin.FactoryResetProtectionPolicy
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log

/**
 * Factory Reset Protection with the company's Google accounts. After a reset
 * from recovery mode (the one reset Device Owner can't block), the phone can
 * only be set up again by signing in with one of these accounts.
 */
object Frp {
    private const val TAG = "DDAgent"
    private const val GMS = "com.google.android.gms"

    /** Enforce exactly [ids] (numeric Google account IDs). Empty = FRP off. */
    fun apply(c: Context, ids: List<String>) {
        if (!Policy.isOwner(c)) return
        // Never during the setup wizard: changing FRP while Google's setup is
        // still running can make it fail with "Can't set up device". A later
        // sync applies it once setup has finished.
        if (!setupComplete(c)) return
        val key = ids.sorted().joinToString(",")
        // Idempotent: only touch the policy when the accounts change (or last try failed).
        if (key == Prefs.frpApplied(c) && Prefs.frpStatus(c) != "failed") return
        val status = set(c, ids)
        Prefs.setFrpApplied(c, key)
        Prefs.setFrpStatus(c, status)
        Log.i(TAG, "FRP ${ids.size} account(s): $status")
    }

    /** Switch FRP off — done before handing the phone to the customer. */
    fun clear(c: Context) {
        if (!Policy.isOwner(c)) return
        set(c, emptyList())
        Prefs.setFrpApplied(c, "")
        Prefs.setFrpStatus(c, "off")
    }

    private fun setupComplete(c: Context): Boolean = runCatching {
        android.provider.Settings.Secure.getInt(c.contentResolver, "user_setup_complete", 1) == 1
    }.getOrDefault(true)

    private fun set(c: Context, ids: List<String>): String {
        val dpm = Policy.dpm(c); val admin = Policy.admin(c)
        var modern = false
        // Android 11+: the official Device Owner FRP policy.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val policy = if (ids.isEmpty()) null else FactoryResetProtectionPolicy.Builder()
                    .setFactoryResetProtectionAccounts(ids)
                    .setFactoryResetProtectionEnabled(true)
                    .build()
                dpm.setFactoryResetProtectionPolicy(admin, policy)
                modern = true
            } catch (e: UnsupportedOperationException) {
                Log.w(TAG, "FRP policy not supported on this phone — using Google Play services")
            } catch (e: Exception) {
                Log.w(TAG, "FRP policy failed: ${e.message}")
            }
        }
        // Older phones (and a fallback on newer ones): Google Play services reads
        // the FRP accounts from this app restriction.
        val legacy = runCatching {
            val b = Bundle()
            if (ids.isNotEmpty()) b.putStringArray("factoryResetProtectionAdmin", ids.toTypedArray())
            dpm.setApplicationRestrictions(admin, GMS, b)
            c.sendBroadcast(
                Intent("com.google.android.gms.auth.FRP_CONFIG_CHANGED")
                    .setPackage(GMS)
                    .addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
            )
        }.isSuccess
        return when {
            ids.isEmpty() -> "off"
            modern -> "on"
            legacy -> "on_legacy"
            else -> "failed"
        }
    }
}
