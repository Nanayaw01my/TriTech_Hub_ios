package com.dandorsolar.lockagent

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.HandlerThread
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * The phone's location, without Google Play Services. [lastKnown] is only the
 * cached position from whenever something last asked (e.g. setup at the office),
 * so [fresh] actively asks for a new fix: the network provider (cell/Wi-Fi,
 * cheap) every time, and GPS at most once an hour.
 */
object LocationHelper {
    data class Fix(val lat: Double, val lng: Double, val accuracy: Float, val time: Long)

    private const val GPS_EVERY_MS = 60L * 60L * 1000L

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

    /** A new location fix (blocking, call off the main thread); falls back to [lastKnown]. */
    fun fresh(c: Context): Fix? {
        val lm = c.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return lastKnown(c)
        var best: Location? = current(lm, LocationManager.NETWORK_PROVIDER, 15_000L)
        val now = System.currentTimeMillis()
        if (now - Prefs.lastGpsAt(c) > GPS_EVERY_MS || best == null) {
            Prefs.setLastGpsAt(c, now)
            val gps = current(lm, LocationManager.GPS_PROVIDER, 30_000L)
            if (gps != null && (best == null || gps.accuracy < best.accuracy)) best = gps
        }
        return best?.let { Fix(it.latitude, it.longitude, it.accuracy, it.time) } ?: lastKnown(c)
    }

    @SuppressLint("MissingPermission")
    private fun current(lm: LocationManager, provider: String, timeoutMs: Long): Location? {
        val enabled = runCatching { lm.isProviderEnabled(provider) }.getOrDefault(false)
        if (!enabled) return null
        val latch = CountDownLatch(1)
        var result: Location? = null
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val exec = Executors.newSingleThreadExecutor()
                lm.getCurrentLocation(provider, null, exec) { loc -> result = loc; latch.countDown() }
                latch.await(timeoutMs, TimeUnit.MILLISECONDS)
                exec.shutdown()
            } else {
                val thread = HandlerThread("dd-location").apply { start() }
                val listener = object : LocationListener {
                    override fun onLocationChanged(loc: Location) { result = loc; latch.countDown() }
                    @Deprecated("Deprecated in Java")
                    override fun onStatusChanged(p: String?, s: Int, e: Bundle?) {}
                    override fun onProviderEnabled(p: String) {}
                    override fun onProviderDisabled(p: String) { latch.countDown() }
                }
                @Suppress("DEPRECATION")
                lm.requestSingleUpdate(provider, listener, thread.looper)
                latch.await(timeoutMs, TimeUnit.MILLISECONDS)
                runCatching { lm.removeUpdates(listener) }
                thread.quitSafely()
            }
            result
        } catch (e: Exception) {
            null
        }
    }
}
