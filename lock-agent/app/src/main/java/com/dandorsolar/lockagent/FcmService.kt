package com.dandorsolar.lockagent

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** Receives instant lock/unlock pushes and token refreshes. */
class FcmService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        // Any push just means "sync now" — the backend holds the desired state.
        App.syncNow(applicationContext)
    }

    override fun onNewToken(token: String) {
        val c = applicationContext
        Prefs.setFcmToken(c, token)
        // Report it right away so the backend can push to this device.
        Thread {
            if (Prefs.enrolled(c)) {
                runCatching {
                    Api.heartbeat(
                        Prefs.backendUrl(c), Prefs.deviceId(c), Prefs.deviceSecret(c),
                        Prefs.appliedLockState(c), LocationHelper.lastKnown(c), token
                    )
                }
            }
        }.start()
    }
}
