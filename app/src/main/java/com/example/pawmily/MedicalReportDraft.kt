package com.example.pawmily

import android.content.Context
import android.content.Intent

/**
 * Holds the consult report in memory so we never put pet photos / long clinical
 * text into Intent extras (Binder ~1MB). That crash is why older reports
 * with a photo or a long note killed the app on open.
 */
object MedicalReportDraft {
    data class Content(
        val petName: String,
        val date: String,
        val doctor: String,
        val reason: String,
        val diagnosis: String,
        val treatment: String,
        val medication: String = "",
        val observations: String = "",
        val followUp: String = "",
        val number: String = "",
        val type: String = "",
        val petId: String? = null,
        val petBackendId: String? = null,
    )

    @Volatile
    var current: Content? = null

    fun open(context: Context, content: Content) {
        current = content
        context.startActivity(Intent(context, MedicalReportActivity::class.java))
    }
}
