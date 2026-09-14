package com.example.pawmily

/**
 * Single-flight access-token refresh shared by interceptor + authenticator.
 * Network failures do NOT invalidate the session; only a real auth rejection does.
 */
object TokenRefresher {
    private val lock = Any()

    @Volatile
    private var sessionInvalidated = false

    fun sessionInvalidatedPublic(): Boolean = sessionInvalidated

    fun markSessionValid() {
        sessionInvalidated = false
    }

    /**
     * Returns a usable access token.
     * - If [failedAccessToken] is null (proactive): reuses a still-valid JWT without network.
     * - Network errors keep the session and return the existing access token when possible.
     * - Only unauthorized refresh clears the session.
     */
    fun refreshAccessToken(failedAccessToken: String?): String? {
        synchronized(lock) {
            if (sessionInvalidated) return null

            val provider = RetrofitClient.tokenProvider ?: return null
            val current = provider.getAccessToken()

            // Another thread already refreshed past the failing token.
            if (!current.isNullOrBlank() &&
                !failedAccessToken.isNullOrBlank() &&
                current != failedAccessToken
            ) {
                return current
            }

            // Proactive path: keep using a still-valid access token.
            if (failedAccessToken.isNullOrBlank() && JwtAccessToken.isUsable(current)) {
                return current
            }

            val refresh = provider.getRefreshToken()
            if (refresh.isNullOrBlank()) {
                sessionInvalidated = true
                provider.clearSessionOnAuthFailure()
                SessionEvents.notifySessionExpired()
                return null
            }

            when (val outcome = RetrofitClient.refreshOutcome(refresh)) {
                is RefreshOutcome.Ok -> {
                    val refreshed = outcome.response
                    if (refreshed.accessToken.isBlank()) {
                        sessionInvalidated = true
                        provider.clearSessionOnAuthFailure()
                        SessionEvents.notifySessionExpired()
                        return null
                    }
                    sessionInvalidated = false
                    provider.updateTokens(refreshed.accessToken, refreshed.refreshToken)
                    refreshed.user?.let { user ->
                        if (provider is SessionManager) {
                            provider.saveAuthSession(
                                refreshed.accessToken,
                                user,
                                refreshed.refreshToken,
                            )
                        }
                    }
                    return refreshed.accessToken
                }
                is RefreshOutcome.Unauthorized -> {
                    sessionInvalidated = true
                    provider.clearSessionOnAuthFailure()
                    SessionEvents.notifySessionExpired()
                    return null
                }
                is RefreshOutcome.NetworkFailure -> {
                    // Soft failure: keep session; caller may continue offline with local data.
                    return current?.takeIf { it.isNotBlank() }
                }
            }
        }
    }

    /** Background refresh when access is near expiry; never logs out on network errors. */
    fun refreshIfNeededInBackground() {
        val provider = RetrofitClient.tokenProvider ?: return
        val access = provider.getAccessToken()
        if (!JwtAccessToken.needsRefresh(access)) return
        Thread({
            refreshAccessToken(failedAccessToken = null)
        }, "pawmily-token-refresh").start()
    }
}
