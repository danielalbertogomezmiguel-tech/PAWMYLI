package com.example.pawmily.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.example.pawmily.AppointmentDto
import com.example.pawmily.Pet
import com.example.pawmily.PetsMemoryCache
import com.example.pawmily.ReminderDto
import com.example.pawmily.UserDto
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Local SQLite cache (offline-first). Screens read here first; API writes refresh this store.
 * Uses plain SQLite to avoid Room/KSP tooling issues with the current AGP toolchain.
 */
object LocalCacheStore {
    private val gson = Gson()
    private const val KEY_PETS = "pets"
    private const val KEY_APPOINTMENTS = "appointments"
    private const val DB_NAME = "pawmily_local.db"
    private const val DB_VERSION = 1

    @Volatile
    private var helper: Helper? = null

    fun init(context: Context) {
        if (helper == null) {
            helper = Helper(context.applicationContext)
        }
    }

    private fun db(): SQLiteDatabase =
        helper?.writableDatabase ?: error("LocalCacheStore not initialized")

    suspend fun loadPetsIntoMemory() = withContext(Dispatchers.IO) {
        val pets = getPets()
        if (pets.isEmpty()) return@withContext
        PetsMemoryCache.putFromDisk(pets, petsSyncAt())
    }

    suspend fun getPets(): List<Pet> = withContext(Dispatchers.IO) {
        val out = mutableListOf<Pet>()
        db().rawQuery("SELECT json FROM cached_pets ORDER BY code ASC", null).use { c ->
            while (c.moveToNext()) {
                runCatching { gson.fromJson(c.getString(0), Pet::class.java) }
                    .getOrNull()
                    ?.let { out.add(it) }
            }
        }
        out
    }

    suspend fun getPet(idOrCode: String): Pet? = withContext(Dispatchers.IO) {
        val key = idOrCode.trim()
        db().rawQuery(
            "SELECT json FROM cached_pets WHERE backend_id = ? OR code = ? LIMIT 1",
            arrayOf(key, key),
        ).use { c ->
            if (!c.moveToFirst()) return@withContext null
            runCatching { gson.fromJson(c.getString(0), Pet::class.java) }.getOrNull()
        }
    }

    suspend fun savePets(pets: List<Pet>) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val database = db()
        database.beginTransaction()
        try {
            database.delete("cached_pets", null, null)
            pets.forEach { pet ->
                val backendId = pet.backendId?.takeIf { it.isNotBlank() } ?: return@forEach
                val values = ContentValues().apply {
                    put("backend_id", backendId)
                    put("code", pet.id)
                    put("json", gson.toJson(pet))
                    put("updated_at", now)
                }
                database.insertWithOnConflict(
                    "cached_pets",
                    null,
                    values,
                    SQLiteDatabase.CONFLICT_REPLACE,
                )
            }
            putSyncAt(KEY_PETS, now)
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
        PetsMemoryCache.put(pets)
    }

    suspend fun petsSyncAt(): Long = withContext(Dispatchers.IO) { getSyncAt(KEY_PETS) }

    suspend fun getReminders(petBackendId: String): List<ReminderDto> = withContext(Dispatchers.IO) {
        val out = mutableListOf<ReminderDto>()
        db().rawQuery(
            "SELECT json FROM cached_reminders WHERE pet_backend_id = ?",
            arrayOf(petBackendId),
        ).use { c ->
            while (c.moveToNext()) {
                runCatching { gson.fromJson(c.getString(0), ReminderDto::class.java) }
                    .getOrNull()
                    ?.let { out.add(it) }
            }
        }
        out
    }

    suspend fun saveReminders(petBackendId: String, reminders: List<ReminderDto>) =
        withContext(Dispatchers.IO) {
            val now = System.currentTimeMillis()
            val database = db()
            database.beginTransaction()
            try {
                database.delete("cached_reminders", "pet_backend_id = ?", arrayOf(petBackendId))
                reminders.forEach { rem ->
                    val values = ContentValues().apply {
                        put("id", rem.id)
                        put("pet_backend_id", petBackendId)
                        put("json", gson.toJson(rem))
                        put("updated_at", now)
                    }
                    database.insertWithOnConflict(
                        "cached_reminders",
                        null,
                        values,
                        SQLiteDatabase.CONFLICT_REPLACE,
                    )
                }
                putSyncAt("reminders_$petBackendId", now)
                database.setTransactionSuccessful()
            } finally {
                database.endTransaction()
            }
        }

    suspend fun remindersSyncAt(petBackendId: String): Long =
        withContext(Dispatchers.IO) { getSyncAt("reminders_$petBackendId") }

    suspend fun getAppointments(): List<AppointmentDto> = withContext(Dispatchers.IO) {
        val out = mutableListOf<AppointmentDto>()
        db().rawQuery("SELECT json FROM cached_appointments", null).use { c ->
            while (c.moveToNext()) {
                runCatching { gson.fromJson(c.getString(0), AppointmentDto::class.java) }
                    .getOrNull()
                    ?.let { out.add(it) }
            }
        }
        out
    }

    suspend fun saveAppointments(appointments: List<AppointmentDto>) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val database = db()
        database.beginTransaction()
        try {
            database.delete("cached_appointments", null, null)
            appointments.forEach { appt ->
                val values = ContentValues().apply {
                    put("id", appt.id)
                    put("patient_id", appt.patientId)
                    put("json", gson.toJson(appt))
                    put("updated_at", now)
                }
                database.insertWithOnConflict(
                    "cached_appointments",
                    null,
                    values,
                    SQLiteDatabase.CONFLICT_REPLACE,
                )
            }
            putSyncAt(KEY_APPOINTMENTS, now)
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
    }

    suspend fun appointmentsSyncAt(): Long =
        withContext(Dispatchers.IO) { getSyncAt(KEY_APPOINTMENTS) }

    suspend fun getProfile(): UserDto? = withContext(Dispatchers.IO) {
        db().rawQuery("SELECT json FROM cached_profile LIMIT 1", null).use { c ->
            if (!c.moveToFirst()) return@withContext null
            runCatching { gson.fromJson(c.getString(0), UserDto::class.java) }.getOrNull()
        }
    }

    suspend fun saveProfile(user: UserDto) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val values = ContentValues().apply {
            put("user_id", user.id)
            put("json", gson.toJson(user))
            put("updated_at", now)
        }
        db().insertWithOnConflict("cached_profile", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        putSyncAt("profile", now)
    }

    suspend fun clearAll() = withContext(Dispatchers.IO) {
        val database = db()
        database.beginTransaction()
        try {
            database.delete("cached_pets", null, null)
            database.delete("cached_reminders", null, null)
            database.delete("cached_appointments", null, null)
            database.delete("cached_profile", null, null)
            database.delete("sync_meta", null, null)
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
        PetsMemoryCache.invalidate()
    }

    fun isStale(syncAtMs: Long, ttlMs: Long): Boolean {
        if (syncAtMs <= 0L) return true
        return System.currentTimeMillis() - syncAtMs >= ttlMs
    }

    private fun getSyncAt(key: String): Long {
        db().rawQuery(
            "SELECT updated_at FROM sync_meta WHERE key = ? LIMIT 1",
            arrayOf(key),
        ).use { c ->
            if (!c.moveToFirst()) return 0L
            return c.getLong(0)
        }
    }

    private fun putSyncAt(key: String, updatedAt: Long) {
        val values = ContentValues().apply {
            put("key", key)
            put("updated_at", updatedAt)
        }
        db().insertWithOnConflict("sync_meta", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    private class Helper(context: Context) :
        SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE cached_pets (
                  backend_id TEXT PRIMARY KEY NOT NULL,
                  code TEXT NOT NULL,
                  json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE cached_reminders (
                  id TEXT PRIMARY KEY NOT NULL,
                  pet_backend_id TEXT NOT NULL,
                  json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE cached_appointments (
                  id TEXT PRIMARY KEY NOT NULL,
                  patient_id TEXT,
                  json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE cached_profile (
                  user_id TEXT PRIMARY KEY NOT NULL,
                  json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE sync_meta (
                  key TEXT PRIMARY KEY NOT NULL,
                  updated_at INTEGER NOT NULL
                )
                """.trimIndent()
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            db.execSQL("DROP TABLE IF EXISTS cached_pets")
            db.execSQL("DROP TABLE IF EXISTS cached_reminders")
            db.execSQL("DROP TABLE IF EXISTS cached_appointments")
            db.execSQL("DROP TABLE IF EXISTS cached_profile")
            db.execSQL("DROP TABLE IF EXISTS sync_meta")
            onCreate(db)
        }
    }
}
