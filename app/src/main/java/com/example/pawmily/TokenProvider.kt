package com.example.pawmily

interface TokenProvider {
    fun getAccessToken(): String?
}
