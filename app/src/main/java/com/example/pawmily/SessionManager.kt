package com.example.pawmily

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionManager(context: Context) : TokenProvider {
    private val prefs: SharedPreferences = createSecurePrefs(context)

    companion object {
        private const val KEY_IS_LOGGED_IN = "isLoggedIn"
        private const val KEY_ACCESS_TOKEN = "accessToken"
        private const val KEY_REFRESH_TOKEN = "refreshToken"
        private const val KEY_USER_ID = "userId"
        private const val KEY_USER_NAME = "userName"
        private const val KEY_USER_EMAIL = "userEmail"
        private const val KEY_USER_PHONE = "userPhone"
        private const val KEY_LINKED_PET_CODES = "linkedPetCodesList"
        private const val KEY_PET_IMAGE_URI = "petImageUri"
        private const val KEY_NOTIFICATIONS_ENABLED = "notificationsEnabled"

        private fun createSecurePrefs(context: Context): SharedPreferences {
            return try {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                EncryptedSharedPreferences.create(
                    context,
                    "PawMilySessionSecure",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            } catch (_: Exception) {
                // Fallback if Keystore unavailable (emulator edge cases)
                context.getSharedPreferences("PawMilySession", Context.MODE_PRIVATE)
            }
        }
    }

    init {
        RetrofitClient.init(this)
    }

    override fun getAccessToken(): String? {
        val raw = prefs.getString(KEY_ACCESS_TOKEN, null) ?: return null
        return raw.removePrefix("Bearer ").trim().takeIf { it.isNotBlank() }
    }

    override fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    override fun updateTokens(accessToken: String, refreshToken: String?) {
        prefs.edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, true)
            putString(KEY_ACCESS_TOKEN, accessToken.removePrefix("Bearer ").trim())
            if (!refreshToken.isNullOrBlank()) {
                putString(KEY_REFRESH_TOKEN, refreshToken)
            }
            apply()
        }
    }

    override fun clearSessionOnAuthFailure() {
        logout()
    }

    fun savePetImageUri(petId: String, uri: String) {
        prefs.edit().putString(KEY_PET_IMAGE_URI + "_" + petId, uri).apply()
    }

    fun getPetImageUri(petId: String): String? {
        return prefs.getString(KEY_PET_IMAGE_URI + "_" + petId, null)
    }

    fun saveAuthSession(accessToken: String, user: UserDto, refreshToken: String? = null) {
        val cleanAccess = accessToken.removePrefix("Bearer ").trim()
        prefs.edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, true)
            putString(KEY_ACCESS_TOKEN, cleanAccess)
            if (!refreshToken.isNullOrBlank()) putString(KEY_REFRESH_TOKEN, refreshToken)
            putString(KEY_USER_ID, user.id)
            putString(KEY_USER_NAME, user.name)
            putString(KEY_USER_EMAIL, user.email)
            putString(KEY_USER_PHONE, user.phone)
            apply()
        }
    }

    fun setLoggedIn(isLoggedIn: Boolean, phone: String? = null) {
        prefs.edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, isLoggedIn)
            if (phone != null) putString(KEY_USER_PHONE, phone)
            apply()
        }
    }

    fun isLoggedIn(): Boolean = prefs.getBoolean(KEY_IS_LOGGED_IN, false) && !getAccessToken().isNullOrBlank()

    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)

    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)

    fun getUserEmail(): String? = prefs.getString(KEY_USER_EMAIL, null)

    fun getUserPhone(): String? = prefs.getString(KEY_USER_PHONE, null)

    /** Optional local cache of linked pet codes (source of truth is GET /patients/mine). */
    private fun petCodesStorageKey(): String? {
        val userId = getUserId()
        val phone = getUserPhone()
        return when {
            !userId.isNullOrBlank() -> "${KEY_LINKED_PET_CODES}_uid_$userId"
            !phone.isNullOrBlank() -> "${KEY_LINKED_PET_CODES}_$phone"
            else -> null
        }
    }

    fun savePetCode(code: String) {
        val key = petCodesStorageKey() ?: return
        val currentCodes = prefs.getStringSet(key, mutableSetOf()) ?: mutableSetOf()
        val newCodes = currentCodes.toMutableSet()
        newCodes.add(code.uppercase())
        prefs.edit().putStringSet(key, newCodes).apply()
    }

    fun cachePetCodes(codes: List<String>) {
        val key = petCodesStorageKey() ?: return
        prefs.edit().putStringSet(key, codes.map { it.uppercase() }.toSet()).apply()
    }

    /** Clears local linked-pet code cache (e.g. after approving a link request). */
    fun clearLinkedPetsCache() {
        val key = petCodesStorageKey() ?: return
        prefs.edit().remove(key).apply()
    }

    fun getPetCodes(): List<String> {
        val key = petCodesStorageKey() ?: return emptyList()
        return prefs.getStringSet(key, mutableSetOf())?.toList() ?: emptyList()
    }

    fun getPetCode(): String? = getPetCodes().firstOrNull()

    fun areNotificationsEnabled(): Boolean =
        prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, false)

    fun setNotificationsEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIFICATIONS_ENABLED, enabled).apply()
    }

    fun logout() {
        clearLinkedPetsCache()
        PetsMemoryCache.invalidate()
        Thread({
            runCatching {
                kotlinx.coroutines.runBlocking {
                    com.example.pawmily.data.LocalCacheStore.clearAll()
                }
            }
        }, "pawmily-clear-cache").start()
        prefs.edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, false)
            remove(KEY_ACCESS_TOKEN)
            remove(KEY_REFRESH_TOKEN)
            remove(KEY_USER_ID)
            remove(KEY_USER_NAME)
            remove(KEY_USER_EMAIL)
            remove(KEY_USER_PHONE)
            apply()
        }
    }
}
