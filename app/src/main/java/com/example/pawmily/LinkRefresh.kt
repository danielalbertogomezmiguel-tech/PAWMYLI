package com.example.pawmily

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * After a barcode link request, the clinic still has to approve it.
 * Poll the pet list so the owner sees the pet within seconds of approval
 * instead of waiting out the 10-minute cache.
 */
object LinkRefresh {
    private const val WINDOW_MS = 4 * 60_000L
    private const val INTERVAL_MS = 20_000L

    @Volatile
    private var untilMs = 0L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    fun isActive(): Boolean = System.currentTimeMillis() < untilMs

    fun arm() {
        untilMs = System.currentTimeMillis() + WINDOW_MS
        PetsMemoryCache.invalidate()
        if (job?.isActive == true) return
        job = scope.launch {
            while (isActive()) {
                delay(INTERVAL_MS)
                if (!isActive()) break
                runCatching { RemotePetRepository.listMyPets(forceRefresh = true) }
                withContext(Dispatchers.Main) {
                    PetsSyncBus.notifyRepaint()
                }
            }
        }
    }
}
