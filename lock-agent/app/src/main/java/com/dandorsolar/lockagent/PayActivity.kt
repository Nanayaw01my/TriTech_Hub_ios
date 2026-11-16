package com.dandorsolar.lockagent

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity

/**
 * "Pay now" from the lock screen: the customer's own Pay-now page (amount due,
 * Paystack Mobile Money or card), shown inside our app so it works while the
 * phone is locked. After paying, the lock screen checks and unlocks by itself.
 */
class PayActivity : AppCompatActivity() {
    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val url = Prefs.payUrl(this)
        if (!url.startsWith("https://")) { finish(); return }

        // Mobile Money approval may need the phone's own prompt or dialling the
        // network's approval code: let the phone/dialer apps through the kiosk
        // while this page is open (the lock screen tightens it again on return).
        runCatching { Policy.allowPhoneApps(this) }

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.WHITE) }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#EA580C"))
            setPadding(16, 16, 16, 16)
        }
        val back = Button(this).apply {
            text = getString(R.string.pay_back)
            setOnClickListener { finish() }
        }
        val dial = Button(this).apply {
            text = getString(R.string.pay_dialer)
            setOnClickListener { runCatching { startActivity(Intent(Intent.ACTION_DIAL).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
        }
        bar.addView(back, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(dial, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100 }
        web = WebView(this)
        root.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 8))
        root.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.setSupportMultipleWindows(false) // card 3-D Secure etc. open in this same view
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) android.view.View.GONE else android.view.View.VISIBLE
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                return when (u.scheme) {
                    "http", "https" -> false // stay inside the app
                    "tel" -> { runCatching { startActivity(Intent(Intent.ACTION_DIAL, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }; true }
                    else -> true // ignore other apps' links (they can't open on a locked phone)
                }
            }
        }
        web.loadUrl(url)
    }

    @Deprecated("Back goes back in the page, then to the lock screen")
    override fun onBackPressed() {
        if (::web.isInitialized && web.canGoBack()) web.goBack() else finish()
    }

    override fun onDestroy() {
        if (::web.isInitialized) runCatching { web.destroy() }
        super.onDestroy()
        // Ask the server straight away whether the payment unlocked the phone.
        App.syncNow(applicationContext)
    }

    companion object {
        fun open(from: android.content.Context) {
            from.startActivity(Intent(from, PayActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
