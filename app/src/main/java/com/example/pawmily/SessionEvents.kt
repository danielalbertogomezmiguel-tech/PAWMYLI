package com.example.pawmily

/**
 * Notifies the UI that the session can no longer be refreshed and the user must log in again.
 */
object SessionEvents {
    @Volatile
    var onSessionExpired: (() -> Unit)? = null

    fun notifySessionExpired() {
        onSessionExpired?.invoke()
    }
}
