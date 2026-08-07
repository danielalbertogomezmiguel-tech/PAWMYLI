package com.example.pawmily

import com.google.gson.Gson
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

object RetrofitClient {
    // Production HTTPS API
    private const val BASE_URL = "https://api-production-66b1.up.railway.app/api/"
    // Local emulator fallback (enable cleartext only for 10.0.2.2 via network_security_config):
    // private const val BASE_URL = "http://10.0.2.2:3000/api/"

    @Volatile
    private var tokenProvider: TokenProvider? = null

    fun init(provider: TokenProvider) {
        tokenProvider = provider
    }

    private val gson = Gson()

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

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { tokenProvider?.getAccessToken() })
            .addInterceptor(retryInterceptor)
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
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
