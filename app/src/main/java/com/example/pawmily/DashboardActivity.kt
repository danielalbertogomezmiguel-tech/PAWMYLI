package com.example.pawmily

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import kotlin.concurrent.thread

class DashboardActivity : AppCompatActivity() {
    @Volatile
    private var sessionReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionManager = SessionManager(this)
        if (!SessionGuard.requireRefreshableSession(this, sessionManager)) {
            return
        }

        setContentView(R.layout.activity_dashboard)
        ImmersiveMode.apply(this)

        // Show UI immediately from local cache; refresh token only when needed.
        sessionReady = true
        if (savedInstanceState == null) {
            showTab(R.id.navigation_home)
        }
        wireBottomNav()

        thread {
            val access = sessionManager.getAccessToken()
            if (JwtAccessToken.isUsable(access)) {
                TokenRefresher.refreshIfNeededInBackground()
                return@thread
            }
            val renewed = TokenRefresher.refreshAccessToken(failedAccessToken = access)
            if (renewed.isNullOrBlank() &&
                TokenRefresher.sessionInvalidatedPublic()
            ) {
                runOnUiThread {
                    if (isFinishing) return@runOnUiThread
                    Toast.makeText(
                        this,
                        "Tu sesión expiró. Inicia sesión de nuevo.",
                        Toast.LENGTH_LONG,
                    ).show()
                    val intent = Intent(this, MainActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        SessionEvents.onSessionExpired = {
            runOnUiThread {
                Toast.makeText(
                    this,
                    "Tu sesión expiró. Inicia sesión de nuevo.",
                    Toast.LENGTH_LONG,
                ).show()
                val intent = Intent(this, MainActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                startActivity(intent)
                finish()
            }
        }
        // Soft sync only when cache is stale — do not wipe local data on every resume.
        if (sessionReady) {
            PetsSyncBus.notifySoftSyncIfStale()
            TokenRefresher.refreshIfNeededInBackground()
        }
    }

    override fun onPause() {
        SessionEvents.onSessionExpired = null
        super.onPause()
    }

    private var currentTabId = R.id.navigation_home

    private fun wireBottomNav() {
        val bottomNavigation = findViewById<BottomNavigationView>(R.id.bottom_navigation)
        bottomNavigation.setOnItemSelectedListener { item ->
            if (item.itemId == currentTabId &&
                supportFragmentManager.findFragmentByTag(item.itemId.toString()) != null
            ) {
                return@setOnItemSelectedListener true
            }
            showTab(item.itemId)
            true
        }
    }

    private fun showTab(itemId: Int) {
        val factory: () -> Fragment = when (itemId) {
            R.id.navigation_home -> { { HomeFragment() } }
            R.id.navigation_pets -> { { PetsFragment() } }
            R.id.navigation_reminders -> { { RemindersFragment() } }
            R.id.navigation_profile -> { { ProfileFragment() } }
            else -> return
        }
        val tag = itemId.toString()
        val fm = supportFragmentManager
        val tx = fm.beginTransaction()
        fm.fragments.forEach { fragment ->
            if (fragment.isVisible && fragment.tag != tag) tx.hide(fragment)
        }
        val existing = fm.findFragmentByTag(tag)
        if (existing == null) {
            tx.add(R.id.nav_host_fragment, factory(), tag)
        } else {
            tx.show(existing)
        }
        tx.commit()
        currentTabId = itemId
    }
}
