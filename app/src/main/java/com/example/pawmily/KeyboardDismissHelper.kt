package com.example.pawmily

import android.app.Activity
import android.content.Context
import android.graphics.Rect
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ScrollView
import androidx.core.widget.NestedScrollView

object KeyboardDismissHelper {

    fun hide(activity: Activity) {
        val focus = activity.currentFocus ?: return
        val imm = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(focus.windowToken, 0)
        focus.clearFocus()
    }

    /** Tap outside focused EditText (on scroll containers) dismisses the keyboard. */
    fun attach(activity: Activity, root: View) {
        when (root) {
            is ScrollView, is NestedScrollView -> {
                root.isFocusableInTouchMode = true
                root.setOnTouchListener { _, event ->
                    if (event.action == MotionEvent.ACTION_DOWN) {
                        dismissIfOutside(activity, event)
                    }
                    false
                }
            }
            is ViewGroup -> {
                for (i in 0 until root.childCount) {
                    attach(activity, root.getChildAt(i))
                }
            }
        }
        // Allow tapping any EditText without depending on IME "Next"
        enableDirectFocus(root)
    }

    private fun enableDirectFocus(root: View) {
        if (root is EditText) {
            root.isFocusable = true
            root.isFocusableInTouchMode = true
            root.isClickable = true
            root.setOnClickListener { root.requestFocus() }
        } else if (root is ViewGroup) {
            for (i in 0 until root.childCount) {
                enableDirectFocus(root.getChildAt(i))
            }
        }
    }

    private fun dismissIfOutside(activity: Activity, event: MotionEvent) {
        val focus = activity.currentFocus
        if (focus !is EditText) return
        val rect = Rect()
        focus.getGlobalVisibleRect(rect)
        if (!rect.contains(event.rawX.toInt(), event.rawY.toInt())) {
            hide(activity)
        }
    }
}
