package com.example.pawmily

import android.app.Application
import com.example.pawmily.data.LocalCacheStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class PawMilyApp : Application() {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        LocalCacheStore.init(this)
        // Warm memory cache from Room so first frames paint without waiting on network.
        appScope.launch {
            runCatching { LocalCacheStore.loadPetsIntoMemory() }
        }
    }
}
