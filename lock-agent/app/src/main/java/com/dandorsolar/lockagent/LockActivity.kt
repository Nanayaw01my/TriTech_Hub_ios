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

        val message = Prefs.lockMessage(this).ifEmpty { getString(R.string.lock_default_message) }
        findViewById<TextView>(R.id.tvLockMessage).text = message

        val contact = Prefs.unlockContact(this)
        findViewById<TextView>(R.id.tvLockContact).text =
            if (contact.isNotEmpty()) getString(R.string.lock_contact_prefix) + contact else ""

        findViewById<Button>(R.id.btnCheck).setOnClickListener { onCheck() }

        // "Call us" — lets a locked customer reach the company directly. Device
        // Owner has granted CALL_PHONE silently, so this dials without prompts.
        val btnCall = findViewById<Button>(R.id.btnCall)
        if (contact.isNotEmpty()) {
            btnCall.visibility = View.VISIBLE
            btnCall.setOnClickListener { callCompany(contact) }
        } else {
            btnCall.visibility = View.GONE
        }

        ContextCompat.registerReceiver(
            this, unlockReceiver, IntentFilter(SyncManager.ACTION_UNLOCK),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        startKiosk()
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
                if (Prefs.desiredLockState(applicationContext) == "unlocked") {
                    finishUnlock()
                } else {
                    status.text = "Still locked — please complete your payment."
                }
            }
        }.start()
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
        if (Prefs.desiredLockState(this) == "unlocked") {
            finishUnlock()
        } else {
            // Back from a call (or anywhere): re-tighten the kiosk to our app only.
            runCatching {
                if (Policy.isOwner(this)) Policy.dpm(this).setLockTaskPackages(Policy.admin(this), arrayOf(packageName))
            }
            startKiosk()
        }
    }

    @Deprecated("Blocked on purpose")
    override fun onBackPressed() {
        // Swallow — the customer cannot dismiss the lock with Back.
    }

    override fun onDestroy() {
        super.onDestroy()
        runCatching { unregisterReceiver(unlockReceiver) }
    }
}
