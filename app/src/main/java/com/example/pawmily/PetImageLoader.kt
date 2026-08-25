package com.example.pawmily

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.widget.ImageView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

object PetImageLoader {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun loadInto(
        imageView: ImageView,
        source: String?,
        fallbackRes: Int = android.R.drawable.ic_menu_gallery
    ) {
        if (source.isNullOrBlank()) {
            imageView.setImageResource(fallbackRes)
            return
        }
        val bitmap = withContext(Dispatchers.IO) {
            runCatching { decode(source) }.getOrNull()
        }
        if (bitmap != null) {
            imageView.setImageBitmap(bitmap)
        } else {
            imageView.setImageResource(fallbackRes)
        }
    }

    private fun decode(source: String): Bitmap? = when {
        source.startsWith("data:image", ignoreCase = true) -> {
            val base64 = source.substringAfter("base64,", missingDelimiterValue = "")
            if (base64.isBlank()) null
            else {
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                decodeSampled(bytes)
            }
        }
        source.startsWith("http://", ignoreCase = true) ||
            source.startsWith("https://", ignoreCase = true) -> {
            val response = http.newCall(Request.Builder().url(source).build()).execute()
            response.use { res ->
                if (!res.isSuccessful) return null
                val bytes = res.body?.bytes() ?: return null
                decodeSampled(bytes)
            }
        }
        else -> null
    }

    /** Downsample large pet photos to avoid OOM on list/detail. */
    private fun decodeSampled(bytes: ByteArray, maxSide: Int = 512): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val sample = calculateInSampleSize(bounds.outWidth, bounds.outHeight, maxSide)
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
    }

    private fun calculateInSampleSize(width: Int, height: Int, maxSide: Int): Int {
        var inSampleSize = 1
        var halfW = width / 2
        var halfH = height / 2
        while (halfW / inSampleSize >= maxSide && halfH / inSampleSize >= maxSide) {
            inSampleSize *= 2
        }
        return inSampleSize.coerceAtLeast(1)
    }
}
