package com.dandorsolar.lockagent

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Firebase Cloud Messaging, initialized programmatically from BuildConfig so no
 * google-services.json is needed. If the config is blank, FCM is simply off and
 * the agent stays on its 15-minute poll.
 */
object Fcm {
    private const val TAG = "DDAgent"

    fun enabled(): Boolean =
        BuildConfig.FIREBASE_APP_ID.isNotEmpty() &&
        BuildConfig.FIREBASE_API_KEY.isNotEmpty() &&
        BuildConfig.FIREBASE_SENDER_ID.isNotEmpty()

    fun init(context: Context) {
        if (!enabled()) return
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                val opts = FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                    .setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                    .build()
                FirebaseApp.initializeApp(context, opts)
                Log.i(TAG, "Firebase initialized")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Firebase init failed: ${e.message}")
        }
    }

    /** Fetch the current FCM token and hand it back (best-effort). */
    fun fetchToken(onToken: (String) -> Unit) {
        if (!enabled()) return
        try {
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { if (!it.isNullOrEmpty()) onToken(it) }
                .addOnFailureListener { Log.w(TAG, "FCM token fetch failed: ${it.message}") }
        } catch (e: Exception) {
            Log.w(TAG, "FCM token error: ${e.message}")
        }
    }
}
