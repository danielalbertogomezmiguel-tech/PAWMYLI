package com.example.pawmily

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) : TokenProvider {
    private val prefs: SharedPreferences = context.getSharedPreferences("PawMilySession", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_IS_LOGGED_IN = "isLoggedIn"
        private const val KEY_ACCESS_TOKEN = "accessToken"
        private const val KEY_USER_ID = "userId"
        private const val KEY_USER_NAME = "userName"
        private const val KEY_USER_EMAIL = "userEmail"
        private const val KEY_USER_PHONE = "userPhone"
        private const val KEY_LINKED_PET_CODES = "linkedPetCodesList"
        private const val KEY_PET_IMAGE_URI = "petImageUri"
    }

    init {
        RetrofitClient.init(this)
    }

    override fun getAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)

    fun savePetImageUri(petId: String, uri: String) {
        prefs.edit().putString(KEY_PET_IMAGE_URI + "_" + petId, uri).apply()
    }

    fun getPetImageUri(petId: String): String? {
        return prefs.getString(KEY_PET_IMAGE_URI + "_" + petId, null)
    }

    fun saveAuthSession(accessToken: String, user: UserDto) {
        prefs.edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, true)
            putString(KEY_ACCESS_TOKEN, accessToken)
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

    fun getPetCodes(): List<String> {
        val key = petCodesStorageKey() ?: return emptyList()
        return prefs.getStringSet(key, mutableSetOf())?.toList() ?: emptyList()
    }

    fun getPetCode(): String? = getPetCodes().firstOrNull()

    fun logout() {
        prefs.edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, false)
            remove(KEY_ACCESS_TOKEN)
            remove(KEY_USER_ID)
            remove(KEY_USER_NAME)
            remove(KEY_USER_EMAIL)
            apply()
        }
    }
}
