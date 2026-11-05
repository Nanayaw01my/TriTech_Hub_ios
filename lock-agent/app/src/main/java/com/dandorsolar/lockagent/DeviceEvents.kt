package com.dandorsolar.lockagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Report tamper events (and shutdowns) to the server, which texts the company
 * numbers about tamper events. If the phone is offline, the event is kept and
 * sent on the next sync. Only while the phone is under a plan.
 */
object DeviceEvents {
    private const val TAG = "DDAgent"
    private const val MAX_QUEUED = 20

    private fun active(c: Context) =
        Prefs.enrolled(c) && Prefs.desiredLockState(c) != "released"

    /** Try to send now; queue it if that fails. Blocks — call off the main thread. */
    fun sendBlocking(c: Context, type: String, detail: String = "", timeoutMs: Int = 15000) {
        if (!active(c)) return
        val at = System.currentTimeMillis()
        if (!send(c, type, detail, at, timeoutMs)) queue(c, type, detail, at)
    }

    /** Fire-and-forget version for callers on the main thread. */
    fun report(c: Context, type: String, detail: String = "") {
        val app = c.applicationContext
        Thread { runCatching { sendBlocking(app, type, detail) } }.start()
    }

    /** Send anything queued while offline (called from the sync). */
    fun flush(c: Context) {
        val arr = runCatching { JSONArray(Prefs.pendingEvents(c)) }.getOrDefault(JSONArray())
        if (arr.length() == 0) return
        val left = JSONArray()
        for (i in 0 until arr.length()) {
            val e = arr.optJSONObject(i) ?: continue
            if (!send(c, e.optString("type"), e.optString("detail"), e.optLong("at"), 15000)) left.put(e)
        }
        Prefs.setPendingEvents(c, left.toString())
    }

    private fun send(c: Context, type: String, detail: String, at: Long, timeoutMs: Int): Boolean {
        val backend = Prefs.backendUrl(c)
        val id = Prefs.deviceId(c)
        val secret = Prefs.deviceSecret(c)
        if (backend.isEmpty() || id.isEmpty() || secret.isEmpty()) return false
        return runCatching { Api.event(backend, id, secret, type, detail, at, timeoutMs).ok }
            .getOrDefault(false)
    }

    private fun queue(c: Context, type: String, detail: String, at: Long) {
        runCatching {
            val arr = runCatching { JSONArray(Prefs.pendingEvents(c)) }.getOrDefault(JSONArray())
            arr.put(JSONObject().put("type", type).put("detail", detail).put("at", at))
            // Keep only the newest few.
            val trimmed = JSONArray()
            val start = maxOf(0, arr.length() - MAX_QUEUED)
            for (i in start until arr.length()) trimmed.put(arr.get(i))
            Prefs.setPendingEvents(c, trimmed.toString())
            Log.i(TAG, "Event $type queued for the next sync")
        }
    }
}

/**
 * The phone is being switched off. Tell the server when (a flash or a
 * recovery-mode reset starts with switching the phone off), so a later
 * "phone went silent" alert can say when it was switched off.
 */
class ShutdownReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext
        val pending = goAsync()
        Thread {
            try {
                // Short wait: the phone is shutting down. Queued if it doesn't go.
                DeviceEvents.sendBlocking(app, "shutdown", intent.action?.substringAfterLast('.') ?: "", 3000)
            } catch (_: Throwable) {
            } finally {
                pending.finish()
            }
        }.start()
    }
}
