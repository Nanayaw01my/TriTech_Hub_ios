package com.dandorsolar.lockagent

import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/** Minimal JSON-over-HTTP client (no third-party deps). Call off the main thread. */
object Api {
    private const val TAG = "DDAgent"
    private const val TIMEOUT = 15000

    data class Result(val ok: Boolean, val code: Int, val json: JSONObject?)

    private fun request(method: String, urlStr: String, body: JSONObject?, headers: Map<String, String>): Result {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = TIMEOUT
                readTimeout = TIMEOUT
                setRequestProperty("Accept", "application/json")
                headers.forEach { (k, v) -> setRequestProperty(k, v) }
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    outputStream.use { it.write(body.toString().toByteArray()) }
                }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
            val json = if (text.isNotBlank()) runCatching { JSONObject(text) }.getOrNull() else null
            Result(code in 200..299, code, json)
        } catch (e: Exception) {
            Log.w(TAG, "request $method $urlStr failed: ${e.message}")
            Result(false, 0, null)
        } finally {
            conn?.disconnect()
        }
    }

    /** POST /api/agent/enroll — exchange the enrollment token for a device secret. */
    fun enroll(
        backend: String, token: String, deviceId: String, imei: String?,
        androidVersion: String, appVersion: String, model: String
    ): Result {
        val body = JSONObject()
            .put("enrollment_token", token)
            .put("device_id", deviceId)
            .put("android_version", androidVersion)
            .put("app_version", appVersion)
            .put("model", model)
        if (!imei.isNullOrBlank()) body.put("imei", imei)
        return request("POST", "$backend/api/agent/enroll", body, emptyMap())
    }

    /** POST /api/agent/heartbeat — report applied state + location, receive desired state. */
    fun heartbeat(
        backend: String, deviceId: String, secret: String, appliedState: String,
        fix: LocationHelper.Fix? = null
    ): Result {
        val body = JSONObject()
            .put("lock_state", appliedState)
            .put("android_version", android.os.Build.VERSION.RELEASE)
            .put("app_version", BuildConfig.VERSION_NAME)
        if (fix != null) {
            body.put("lat", fix.lat)
                .put("lng", fix.lng)
                .put("accuracy", fix.accuracy.toDouble())
                .put("loc_at", fix.time)
        }
        return request("POST", "$backend/api/agent/heartbeat", body, authHeaders(deviceId, secret))
    }

    /** POST /api/agent/ack — confirm the applied state. */
    fun ack(backend: String, deviceId: String, secret: String, appliedState: String): Result {
        val body = JSONObject().put("applied_state", appliedState)
        return request("POST", "$backend/api/agent/ack", body, authHeaders(deviceId, secret))
    }

    private fun authHeaders(deviceId: String, secret: String) =
        mapOf("x-device-id" to deviceId, "x-device-secret" to secret)
}
