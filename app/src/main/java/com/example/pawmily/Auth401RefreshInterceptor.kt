package com.example.pawmily

import okhttp3.Interceptor
import okhttp3.Response

/**
 * Explicit Bearer 401 → refresh → retry once.
 * More reliable than Authenticator alone when servers omit WWW-Authenticate.
 */
class Auth401RefreshInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val path = original.url.encodedPath
        val isAuthPublic = path.endsWith("/auth/login") ||
            path.endsWith("/auth/register") ||
            path.endsWith("/auth/refresh")

        val response = chain.proceed(original)
        if (response.code != 401 || isAuthPublic) {
            return response
        }

        if (TokenRefresher.sessionInvalidatedPublic()) {
            return response
        }

        val failedToken = original.header("Authorization")
            ?.removePrefix("Bearer ")
            ?.trim()

        val newAccess = TokenRefresher.refreshAccessToken(failedToken)
        if (newAccess.isNullOrBlank()) {
            return response
        }

        response.close()
        val retry = original.newBuilder()
            .header("Authorization", "Bearer $newAccess")
            .build()
        return chain.proceed(retry)
    }
}
