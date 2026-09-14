package com.example.pawmily

/**
 * Lightweight in-process signal so Home/Pets reload after link changes
 * or when a soft sync is needed — no aggressive wipe on every resume.
 */
object PetsSyncBus {
    interface Listener {
        fun onPetsShouldRefresh()
    }

    private val listeners = mutableSetOf<Listener>()

    @Synchronized
    fun addListener(listener: Listener) {
        listeners.add(listener)
    }

    @Synchronized
    fun removeListener(listener: Listener) {
        listeners.remove(listener)
    }

    /** Hard refresh after create/link/unlink — clears memory cache and notifies. */
    @Synchronized
    fun notifyPetsChanged() {
        PetsMemoryCache.invalidate()
        listeners.toList().forEach { runCatching { it.onPetsShouldRefresh() } }
    }

    /** Resume / soft sync: only notify if memory cache is stale. */
    @Synchronized
    fun notifySoftSyncIfStale() {
        if (!PetsMemoryCache.isStale()) return
        listeners.toList().forEach { runCatching { it.onPetsShouldRefresh() } }
    }

    /** Reminder priority / content changed — refresh pet summary without clearing pet list cache. */
    @Synchronized
    fun notifyRemindersChanged() {
        listeners.toList().forEach { runCatching { it.onPetsShouldRefresh() } }
    }
}
