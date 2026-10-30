package com.dandorsolar.lockagent

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Self-update. The server tells the phone the latest build number, where to
 * download it and its SHA-256. If this app is older, it downloads the APK, checks
 * the hash, and installs it silently (Device Owner apps need no user tap).
 * Android only accepts it if it's signed with the same key as this app.
 */
object Updater {
    private const val TAG = "DDAgent"
    private const val RETRY_MS = 6L * 60L * 60L * 1000L // retry a failed version after 6h

    /** Called on every check-in with the server's answer. */
    fun offer(c: Context, j: JSONObject) {
        val code = j.optInt("latest_version_code", 0)
        val url = j.optString("update_url")
        val sha = j.optString("update_sha256").lowercase()
        if (code <= BuildConfig.VERSION_CODE || url.isEmpty() || sha.length != 64) return
        if (!Policy.isOwner(c) || Prefs.desiredLockState(c) == "released") return
        if (!setupComplete(c)) return // never during the setup wizard / provisioning
        val now = System.currentTimeMillis()
        if (Prefs.updateTriedVersion(c) == code && now - Prefs.updateTriedAt(c) < RETRY_MS) return
        Prefs.setUpdateTarget(c, code, url, sha)
        val req = OneTimeWorkRequestBuilder<UpdateWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(c).enqueueUniqueWork("dd_update", ExistingWorkPolicy.KEEP, req)
    }

    /** Download, verify and install. Blocking — run off the main thread. */
    fun installBlocking(c: Context) {
        val code = Prefs.updateTargetCode(c)
        val url = Prefs.updateTargetUrl(c)
        val sha = Prefs.updateTargetSha(c)
        if (code <= BuildConfig.VERSION_CODE || url.isEmpty()) return
        Prefs.setUpdateTried(c, code, System.currentTimeMillis())
        val file = File(c.cacheDir, "update.apk")
        try {
            val got = download(url, file)
            if (got != sha) {
                Prefs.setUpdateError(c, "Downloaded file didn't match (v$code)")
                return
            }
            val installer = c.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            params.setAppPackageName(c.packageName)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
            val sessionId = installer.createSession(params)
            installer.openSession(sessionId).use { session ->
                session.openWrite("base.apk", 0, file.length()).use { out ->
                    file.inputStream().use { it.copyTo(out) }
                    session.fsync(out)
                }
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
                val status = PendingIntent.getBroadcast(
                    c, sessionId, Intent(c, UpdateStatusReceiver::class.java), flags
                )
                Log.i(TAG, "Installing update v$code")
                session.commit(status.intentSender)
            }
            // On success Android restarts us; UpdateStatusReceiver/BootReceiver re-arm the lock.
        } catch (e: Exception) {
            Log.w(TAG, "Update failed: ${e.message}")
            Prefs.setUpdateError(c, "v$code: ${e.message ?: "install failed"}")
        } finally {
            runCatching { file.delete() }
        }
    }

    /** Download [url] to [dest]; returns the file's SHA-256 (hex). */
    private fun download(url: String, dest: File): String {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20000
            readTimeout = 60000
            instanceFollowRedirects = true
        }
        try {
            if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
            val md = MessageDigest.getInstance("SHA-256")
            conn.inputStream.use { input ->
                dest.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        md.update(buf, 0, n)
                        out.write(buf, 0, n)
                    }
                }
            }
            return md.digest().joinToString("") { "%02x".format(it) }
        } finally {
            conn.disconnect()
        }
    }

    private fun setupComplete(c: Context): Boolean = runCatching {
        android.provider.Settings.Secure.getInt(c.contentResolver, "user_setup_complete", 1) == 1
    }.getOrDefault(true)
}

/** Runs the download + install off the main thread. */
class UpdateWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Updater.installBlocking(applicationContext)
        Result.success()
    }
}
