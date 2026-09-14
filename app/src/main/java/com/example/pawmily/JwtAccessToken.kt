package com.example.pawmily

import android.util.Base64
import org.json.JSONObject

/** Reads JWT `exp` without verifying the signature (client-side expiry check only). */
object JwtAccessToken {
    fun expiresAtEpochSec(token: String?): Long? {
        if (token.isNullOrBlank()) return null
        return try {
            val parts = token.split(".")
            if (parts.size < 2) return null
            val payload = String(
                Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            )
            val exp = JSONObject(payload).optLong("exp", -1L)
            if (exp <= 0L) null else exp
        } catch (_: Exception) {
            null
        }
    }

    /** True when access token still has [skewSec] seconds of life left. */
    fun isUsable(token: String?, skewSec: Long = 60L): Boolean {
        val exp = expiresAtEpochSec(token) ?: return false
        val now = System.currentTimeMillis() / 1000L
        return now < (exp - skewSec)
    }

    /** True when token is missing/expired or will expire within [withinSec]. */
    fun needsRefresh(token: String?, withinSec: Long = 120L): Boolean {
        val exp = expiresAtEpochSec(token) ?: return true
        val now = System.currentTimeMillis() / 1000L
        return now >= (exp - withinSec)
    }
}
