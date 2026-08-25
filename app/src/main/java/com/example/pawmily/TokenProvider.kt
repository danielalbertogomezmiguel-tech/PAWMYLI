package com.example.pawmily

interface TokenProvider {
    fun getAccessToken(): String?
    fun getRefreshToken(): String?
    fun updateTokens(accessToken: String, refreshToken: String?)
    fun clearSessionOnAuthFailure()
}
