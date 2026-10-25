package com.dandorsolar.lockagent

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/** A small status screen. The agent mostly runs headless in the background. */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        App.syncNow(this)
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val status = findViewById<TextView>(R.id.tvStatus)
        val detail = findViewById<TextView>(R.id.tvDetail)
        when {
            !Policy.isOwner(this) -> {
                status.setText(R.string.status_not_owner)
                detail.text = ""
            }
            Prefs.enrolled(this) -> {
                status.setText(R.string.status_enrolled)
                detail.text = "Device ID: ${Prefs.deviceId(this)}"
            }
            else -> {
                status.setText(R.string.status_not_enrolled)
                detail.text = ""
            }
        }
    }
}
