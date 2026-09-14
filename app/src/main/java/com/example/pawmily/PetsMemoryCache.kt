package com.example.pawmily

/**
 * In-memory pet list cache so Home/Pets/Reminders can paint instantly.
 * Backed by Room for process death; TTL controls when network sync is worthwhile.
 */
object PetsMemoryCache {
    /** Soft TTL: after this, background sync is allowed. */
    private const val TTL_MS = 10 * 60_000L
    /** Hard gap: avoid hammering API when switching tabs quickly. */
    private const val MIN_REFETCH_GAP_MS = 15_000L

    @Volatile
    private var pets: List<Pet> = emptyList()

    @Volatile
    private var fetchedAtMs: Long = 0L

    @Synchronized
    fun snapshot(): List<Pet>? {
        if (fetchedAtMs == 0L && pets.isEmpty()) return null
        if (pets.isEmpty() && fetchedAtMs == 0L) return null
        if (fetchedAtMs == 0L) return null
        return pets.map { it.copy() }
    }

    @Synchronized
    fun isFresh(ttlMs: Long = TTL_MS): Boolean {
        if (fetchedAtMs == 0L) return false
        return System.currentTimeMillis() - fetchedAtMs < ttlMs
    }

    @Synchronized
    fun isStale(ttlMs: Long = TTL_MS): Boolean = !isFresh(ttlMs)

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

    /** Restore from Room without treating as a fresh network fetch timestamp if [asFresh] is false. */
    @Synchronized
    fun putFromDisk(list: List<Pet>, fetchedAtMs: Long) {
        pets = list.map { it.copy() }
        this.fetchedAtMs = fetchedAtMs
    }

    @Synchronized
    fun invalidate() {
        pets = emptyList()
        fetchedAtMs = 0L
    }
}
