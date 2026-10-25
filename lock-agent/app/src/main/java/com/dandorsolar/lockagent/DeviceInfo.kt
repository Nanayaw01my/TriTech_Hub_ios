package com.dandorsolar.lockagent

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.telephony.TelephonyManager

/** Facts about this phone used for enrollment + reporting. */
object DeviceInfo {
    @SuppressLint("HardwareIds")
    fun androidId(c: Context): String =
        Settings.Secure.getString(c.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"

    fun model(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    fun androidVersion(): String = Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString()

    /** Device Owner apps are allowed to read the IMEI; otherwise this returns null. */
    @SuppressLint("HardwareIds", "MissingPermission")
    fun imei(c: Context): String? = try {
        val tm = c.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) tm.imei
        else @Suppress("DEPRECATION") tm.deviceId
    } catch (e: Exception) {
        null
    }
}
