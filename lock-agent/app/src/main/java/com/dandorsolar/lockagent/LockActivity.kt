package com.dandorsolar.lockagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/** Full-screen, un-dismissable lock shown while the account is overdue. */
class LockActivity : AppCompatActivity() {

    // While this screen is showing, ask the server every so often whether the
    // state changed (sale activated / payment made), so it lifts within a
    // minute even if the instant push doesn't arrive.
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    @Volatile private var checking = false
    private val autoCheck = object : Runnable {
        override fun run() {
            quickCheck()
            handler.postDelayed(this, if (isAwaiting()) 45_000L else 120_000L)
        }
    }

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            finishUnlock()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_lock)

        findViewById<Button>(R.id.btnCheck).setOnClickListener { onCheck() }
        render()

        ContextCompat.registerReceiver(
            this, unlockReceiver, IntentFilter(SyncManager.ACTION_UNLOCK),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        startKiosk()
    }

    /** True while the phone is held on the "Awaiting Activation" first page. */
    private fun isAwaiting() = Prefs.desiredLockState(this) == "pending_activation"

    /** Fill the screen for the current mode: overdue lock, or awaiting activation. */
    private fun render() {
        val title = findViewById<TextView>(R.id.tvLockTitle)
        val msg = findViewById<TextView>(R.id.tvLockMessage)
        val check = findViewById<Button>(R.id.btnCheck)
        if (isAwaiting()) {
            title.setText(R.string.pending_title)
            msg.text = getString(R.string.pending_message, Prefs.businessName(this))
            check.setText(R.string.pending_check)
        } else {
            title.setText(R.string.lock_title)
            msg.text = Prefs.lockMessage(this).ifEmpty { getString(R.string.lock_default_message) }
            check.setText(R.string.lock_check_again)
        }

        val contact = Prefs.unlockContact(this)
        findViewById<TextView>(R.id.tvLockContact).text =
            if (contact.isNotEmpty()) getString(R.string.lock_contact_prefix) + contact else ""

        // "Call us" — lets the customer reach the company directly. Device Owner
        // has granted CALL_PHONE silently, so this dials without prompts.
        val btnCall = findViewById<Button>(R.id.btnCall)
        if (contact.isNotEmpty()) {
            btnCall.visibility = View.VISIBLE
            btnCall.setOnClickListener { callCompany(contact) }
        } else {
            btnCall.visibility = View.GONE
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        render() // state may have changed (e.g. awaiting → overdue lock)
    }

    private fun startKiosk() {
        // Permitted for the Device Owner without the user pinning confirmation.
        runCatching { startLockTask() }
    }

    private fun onCheck() {
        val status = findViewById<TextView>(R.id.tvLockStatus)
        status.setText(R.string.lock_checking)
        Thread {
            SyncManager.syncBlocking(applicationContext)
            runOnUiThread {
                if (!SyncManager.shouldShowLock(applicationContext)) {
                    finishUnlock()
                } else {
                    render()
                    status.setText(if (isAwaiting()) R.string.pending_still else R.string.lock_still)
                }
            }
        }.start()
    }

    /** Light server check; does a full sync only when the state changed. */
    private fun quickCheck() {
        if (checking) return
        val app = applicationContext
        val backend = Prefs.backendUrl(app)
        val id = Prefs.deviceId(app)
        val secret = Prefs.deviceSecret(app)
        if (backend.isEmpty() || id.isEmpty() || secret.isEmpty()) return
        checking = true
        Thread {
            try {
                val r = Api.commands(backend, id, secret)
                val desired = r.json?.optString("desired_lock_state").orEmpty()
                val j = r.json
                // Sync fully when anything changed: the state (activated /
                // unlocked by the office) or the deadline (a payment came in).
                val changed = r.ok && j != null && (
                    (desired.isNotEmpty() && desired != Prefs.desiredLockState(app)) ||
                    (j.has("paid_until") && j.optLong("paid_until", 0L) != Prefs.paidUntil(app)))
                if (changed) {
                    SyncManager.syncBlocking(app)
                    runOnUiThread {
                        if (!SyncManager.shouldShowLock(app)) finishUnlock() else render()
                    }
                }
            } catch (_: Throwable) {
            } finally {
                checking = false
            }
        }.start()
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(autoCheck)
    }

    private fun callCompany(number: String) {
        val tel = "tel:" + number.trim()
        // Allow the dialer/telecom through lock-task so the call UI can show,
        // then place the call directly (CALL_PHONE is granted by Device Owner).
        runCatching {
            val dpm = Policy.dpm(this)
            val admin = Policy.admin(this)
            val dialer = packageManager.resolveActivity(
                Intent(Intent.ACTION_DIAL), 0
            )?.activityInfo?.packageName
            val pkgs = mutableListOf(packageName)
            if (dialer != null) pkgs.add(dialer)
            if (Policy.isOwner(this)) dpm.setLockTaskPackages(admin, pkgs.toTypedArray())
        }
        val placed = runCatching {
            startActivity(Intent(Intent.ACTION_CALL, Uri.parse(tel)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }.isSuccess
        if (!placed) {
            runCatching {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse(tel)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
    }

    private fun finishUnlock() {
        runCatching { stopLockTask() }
        // Restore the strict single-app kiosk allowlist after a call may have
        // temporarily widened it.
        runCatching {
            if (Policy.isOwner(this)) Policy.dpm(this).setLockTaskPackages(Policy.admin(this), arrayOf(packageName))
        }
        Notifications.clearLock(this)
        finish()
    }

    override fun onResume() {
        super.onResume()
        // Close only when nothing says the phone should be locked or waiting
        // (an offline self-lock keeps the server's old "unlocked" until it syncs).
        if (!SyncManager.shouldShowLock(this)) {
            finishUnlock()
        } else {
            // Back from a call (or anywhere): re-tighten the kiosk to our app only.
            runCatching {
                if (Policy.isOwner(this)) Policy.dpm(this).setLockTaskPackages(Policy.admin(this), arrayOf(packageName))
            }
            render()
            startKiosk()
            handler.removeCallbacks(autoCheck)
            handler.postDelayed(autoCheck, 15_000L)
        }
    }

    @Deprecated("Blocked on purpose")
    override fun onBackPressed() {
        // Swallow — the customer cannot dismiss the lock with Back.
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(autoCheck)
        runCatching { unregisterReceiver(unlockReceiver) }
    }
}
