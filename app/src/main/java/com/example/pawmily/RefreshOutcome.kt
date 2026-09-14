package com.example.pawmily

sealed class RefreshOutcome {
    data class Ok(val response: AuthResponse) : RefreshOutcome()
    data object Unauthorized : RefreshOutcome()
    data class NetworkFailure(val cause: Exception) : RefreshOutcome()
}
