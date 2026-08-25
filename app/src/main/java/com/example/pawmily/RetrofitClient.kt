package com.example.pawmily

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonDeserializer
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

object RetrofitClient {
    const val BASE_URL = "https://api-production-66b1.up.railway.app/api/"

    @Volatile
    var tokenProvider: TokenProvider? = null
        private set

    fun init(provider: TokenProvider) {
        tokenProvider = provider
    }

    private val gson: Gson = GsonBuilder()
        .registerTypeAdapter(
            String::class.java,
            JsonDeserializer { json, _, _ ->
                when {
                    json == null || json.isJsonNull -> ""
                    json.isJsonPrimitive -> json.asJsonPrimitive.asString
                    else -> json.toString()
                }
            }
        )
        .create()
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    private val logging = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }

    private val retryInterceptor = Interceptor { chain ->
        val request = chain.request()
        var lastError: IOException? = null
        repeat(2) { attempt ->
            try {
                return@Interceptor chain.proceed(request)
            } catch (e: IOException) {
                lastError = e
                if (attempt == 1) throw e
            }
        }
        throw lastError ?: IOException("Network error")
    }

    /** Client without auth — used only for refresh to avoid interceptor loops. */
    private val bareClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { tokenProvider?.getAccessToken() })
            .addInterceptor(Auth401RefreshInterceptor())
            .authenticator(TokenAuthenticator())
            .addInterceptor(retryInterceptor)
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    val instance: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .client(client)
            .build()
            .create(ApiService::class.java)
    }

    /**
     * Blocking refresh for OkHttp Authenticator / startup restore.
     * Returns null when refresh token is invalid/expired or network fails.
     */
    fun refreshBlocking(refreshToken: String): AuthResponse? {
        return try {
            val body = gson.toJson(RefreshRequest(refreshToken)).toRequestBody(jsonMedia)
            val request = Request.Builder()
                .url(BASE_URL + "auth/refresh")
                .post(body)
                .build()
            bareClient.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) return null
                gson.fromJson(raw, AuthResponse::class.java)
            }
        } catch (_: Exception) {
            null
        }
    }

    fun parseErrorMessage(errorBody: String?): String? {
        if (errorBody.isNullOrBlank()) return null
        return try {
            val parsed = gson.fromJson(errorBody, ApiErrorResponse::class.java)
            parsed.message?.takeIf { it.isNotBlank() }
                ?: parsed.error?.takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }
}
