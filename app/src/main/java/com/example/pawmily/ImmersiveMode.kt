package com.example.pawmily

import android.app.Activity
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.core.view.WindowCompat

/**
 * Immersive / edge-to-edge: hide navigation bar; swipe reveals it temporarily.
 * Always safe to call: defers until DecorView exists (calling before setContentView
 * used to NPE on Samsung/Android 12+ via window.insetsController).
 */
object ImmersiveMode {
    fun apply(activity: Activity) {
        applyAfterContent(activity)
    }

    /** Preferred entry: schedules immersive flags after content is attached. */
    fun applyAfterContent(activity: Activity) {
        val run = Runnable { applyNow(activity) }
        val content = activity.findViewById<View>(android.R.id.content)
        when {
            content != null -> content.post(run)
            activity.window?.decorView != null -> activity.window.decorView.post(run)
            else -> {
                Handler(Looper.getMainLooper()).post {
                    val c = activity.findViewById<View>(android.R.id.content)
                    if (c != null) c.post(run) else run.run()
                }
            }
        }
    }

    private fun applyNow(activity: Activity) {
        val window = activity.window ?: return
        if (window.decorView == null) return
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.insetsController?.let { controller ->
                    controller.hide(WindowInsets.Type.navigationBars())
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    )
                @Suppress("DEPRECATION")
                window.addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
            }
        } catch (_: Exception) {
            // Immersive mode is optional; never crash the activity for it.
        }
    }
}
