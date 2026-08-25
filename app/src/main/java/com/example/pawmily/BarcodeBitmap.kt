package com.example.pawmily

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix

object BarcodeBitmap {
    fun code128(payload: String, width: Int = 700, height: Int = 180): Bitmap? {
        val value = payload.trim()
        if (value.isEmpty()) return null
        return try {
            val hints = mapOf(EncodeHintType.MARGIN to 1)
            val matrix: BitMatrix = MultiFormatWriter().encode(
                value,
                BarcodeFormat.CODE_128,
                width,
                height,
                hints
            )
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            for (x in 0 until width) {
                for (y in 0 until height) {
                    bmp.setPixel(x, y, if (matrix[x, y]) Color.BLACK else Color.WHITE)
                }
            }
            bmp
        } catch (_: Exception) {
            null
        }
    }
}
