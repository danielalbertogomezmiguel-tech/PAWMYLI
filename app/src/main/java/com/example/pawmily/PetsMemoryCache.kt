package com.example.pawmily

/**
 * In-memory pet list cache so Home/Pets/Reminders can paint instantly
 * and avoid redundant GET /patients/mine on every onResume.
 */
object PetsMemoryCache {
    private const val TTL_MS = 45_000L
    private const val MIN_REFETCH_GAP_MS = 2_500L

    @Volatile
    private var pets: List<Pet> = emptyList()

    @Volatile
    private var fetchedAtMs: Long = 0L

    @Synchronized
    fun snapshot(): List<Pet>? {
        if (fetchedAtMs == 0L) return null
        return pets.map { it.copy() }
    }

    @Synchronized
    fun isFresh(ttlMs: Long = TTL_MS): Boolean {
        if (fetchedAtMs == 0L) return false
        return System.currentTimeMillis() - fetchedAtMs < ttlMs
    }

    @Synchronized
    fun shouldSkipNetwork(): Boolean {
        if (fetchedAtMs == 0L) return false
        return System.currentTimeMillis() - fetchedAtMs < MIN_REFETCH_GAP_MS
    }

    @Synchronized
    fun put(list: List<Pet>) {
        pets = list.map { it.copy() }
        fetchedAtMs = System.currentTimeMillis()
    }

    @Synchronized
    fun invalidate() {
        pets = emptyList()
        fetchedAtMs = 0L
    }
}
