package com.example.pawmily

import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/** Fallback authenticator; primary refresh path is Auth401RefreshInterceptor. */
class TokenAuthenticator : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) {
            RetrofitClient.tokenProvider?.clearSessionOnAuthFailure()
            SessionEvents.notifySessionExpired()
            return null
        }
        val path = response.request.url.encodedPath
        if (path.contains("auth/login") || path.contains("auth/register") || path.contains("auth/refresh")) {
            return null
        }
        val failed = response.request.header("Authorization")?.removePrefix("Bearer ")?.trim()
        val access = TokenRefresher.refreshAccessToken(failed) ?: return null
        return response.request.newBuilder()
            .header("Authorization", "Bearer $access")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var result = 1
        var prior = response.priorResponse
        while (prior != null) {
            result++
            prior = prior.priorResponse
        }
        return result
    }
}
