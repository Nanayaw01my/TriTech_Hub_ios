package com.dandorsolar.lockagent

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager

/** Reads the phone's last-known location without Google Play Services. */
object LocationHelper {
    data class Fix(val lat: Double, val lng: Double, val accuracy: Float, val time: Long)

    @SuppressLint("MissingPermission")
    fun lastKnown(c: Context): Fix? {
        val lm = c.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )
        var best: Location? = null
        for (p in providers) {
            val loc = try { lm.getLastKnownLocation(p) } catch (e: Exception) { null }
            if (loc != null && (best == null || loc.time > best.time)) best = loc
        }
        return best?.let { Fix(it.latitude, it.longitude, it.accuracy, it.time) }
    }
}
