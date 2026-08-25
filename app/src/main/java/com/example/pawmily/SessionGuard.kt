package com.example.pawmily

import android.app.Activity
import android.content.Intent
import android.widget.Toast

/**
 * Ensures protected screens never run with a non-refreshable session.
 * Dashboard can be restored after process death without MainActivity.
 */
object SessionGuard {
    fun hasRefreshableSession(sessionManager: SessionManager): Boolean {
        return sessionManager.isLoggedIn() && !sessionManager.getRefreshToken().isNullOrBlank()
    }

    /** @return true if the activity may continue; false if it was redirected to login. */
    fun requireRefreshableSession(
        activity: Activity,
        sessionManager: SessionManager = SessionManager(activity),
    ): Boolean {
        if (hasRefreshableSession(sessionManager)) {
            TokenRefresher.markSessionValid()
            return true
        }

        sessionManager.logout()
        Toast.makeText(
            activity,
            "Tu sesión ya no es válida. Inicia sesión de nuevo.",
            Toast.LENGTH_LONG,
        ).show()
        val intent = Intent(activity, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        activity.startActivity(intent)
        activity.finish()
        return false
    }
}
