package com.example.pawmily

/**
 * Single-flight access-token refresh shared by interceptor + authenticator.
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
     * Returns a fresh access token, or null if refresh is impossible.
     * If [failedAccessToken] is non-null and the stored access token already differs,
     * returns the stored one (another thread refreshed first).
     */
    fun refreshAccessToken(failedAccessToken: String?): String? {
        synchronized(lock) {
            if (sessionInvalidated) return null

            val provider = RetrofitClient.tokenProvider ?: return null
            val current = provider.getAccessToken()
            if (!current.isNullOrBlank() &&
                !failedAccessToken.isNullOrBlank() &&
                current != failedAccessToken
            ) {
                return current
            }

            val refresh = provider.getRefreshToken()
            if (refresh.isNullOrBlank()) {
                sessionInvalidated = true
                provider.clearSessionOnAuthFailure()
                SessionEvents.notifySessionExpired()
                return null
            }

            val refreshed = RetrofitClient.refreshBlocking(refresh)
            if (refreshed == null || refreshed.accessToken.isBlank()) {
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
    }
}
