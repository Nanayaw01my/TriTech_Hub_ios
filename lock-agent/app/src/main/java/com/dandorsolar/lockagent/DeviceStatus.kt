package com.dandorsolar.lockagent

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.telephony.SubscriptionManager
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/**
 * What the phone reports on each check-in: battery, network, and the SIM
 * card(s) in it. sim_key is a fingerprint of the SIM cards ("" = no SIM), so the
 * server can tell when a SIM is removed or swapped (only the last 6 digits of a
 * SIM's serial are sent).
 */
object DeviceStatus {
    @SuppressLint("MissingPermission", "HardwareIds")
    fun collect(c: Context): JSONObject {
        val o = JSONObject()
        runCatching {
            val bm = c.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            o.put("battery", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) o.put("charging", bm.isCharging)
        }
        runCatching {
            val cm = c.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val caps = cm.getNetworkCapabilities(cm.activeNetwork)
            o.put("network", when {
                caps == null -> "none"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile"
                else -> "other"
            })
        }
        runCatching {
            val sm = c.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
            val subs = sm.activeSubscriptionInfoList ?: emptyList()
            val arr = JSONArray()
            val keys = mutableListOf<String>()
            for (s in subs.sortedBy { it.simSlotIndex }) {
                val number = runCatching {
                    if (Build.VERSION.SDK_INT >= 33) sm.getPhoneNumber(s.subscriptionId)
                    else @Suppress("DEPRECATION") s.number
                }.getOrNull().orEmpty()
                val iccid = runCatching { s.iccId }.getOrNull().orEmpty()
                val mccMnc = if (Build.VERSION.SDK_INT >= 29) "${s.mccString}${s.mncString}"
                    else @Suppress("DEPRECATION") "${s.mcc}${s.mnc}"
                arr.put(JSONObject()
                    .put("slot", s.simSlotIndex)
                    .put("carrier", (s.carrierName ?: s.displayName ?: "").toString().take(40))
                    .put("number", number.take(16))
                    .put("iccid_tail", iccid.takeLast(6)))
                keys.add(if (iccid.isNotEmpty()) iccid else "${s.simSlotIndex}:$mccMnc:$number")
            }
            o.put("sims", arr)
            o.put("sim_key", if (keys.isEmpty()) "" else sha(keys.sorted().joinToString("|")))
        }
        return o
    }

    private fun sha(s: String): String = MessageDigest.getInstance("SHA-256")
        .digest(s.toByteArray()).joinToString("") { "%02x".format(it) }.take(24)
}
