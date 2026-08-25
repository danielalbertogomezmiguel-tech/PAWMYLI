package com.example.pawmily

/**
 * Lightweight in-process signal so Home/Pets reload after link changes
 * or when the dashboard returns to the foreground — no aggressive polling.
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

    @Synchronized
    fun notifyPetsChanged() {
        PetsMemoryCache.invalidate()
        listeners.toList().forEach { runCatching { it.onPetsShouldRefresh() } }
    }

    /** Reminder priority / content changed — refresh pet summary without clearing pet list cache. */
    @Synchronized
    fun notifyRemindersChanged() {
        listeners.toList().forEach { runCatching { it.onPetsShouldRefresh() } }
    }
}
