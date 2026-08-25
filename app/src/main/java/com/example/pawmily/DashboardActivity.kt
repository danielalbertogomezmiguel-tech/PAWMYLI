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
        // Process death / recents can restore Dashboard without MainActivity.
        if (!SessionGuard.requireRefreshableSession(this, sessionManager)) {
            return
        }

        setContentView(R.layout.activity_dashboard)
        ImmersiveMode.apply(this)

        // Renew access before fragments fire /patients/mine (avoids 401 storms).
        thread {
            val access = TokenRefresher.refreshAccessToken(sessionManager.getAccessToken())
            runOnUiThread {
                if (isFinishing) return@runOnUiThread
                if (access.isNullOrBlank()) {
                    Toast.makeText(
                        this,
                        "Tu sesión expiró. Inicia sesión de nuevo.",
                        Toast.LENGTH_LONG,
                    ).show()
                    val intent = Intent(this, MainActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                    return@runOnUiThread
                }
                sessionReady = true
                if (savedInstanceState == null) {
                    loadFragment(HomeFragment())
                }
                wireBottomNav()
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
        // When returning from background (e.g. vet approved a link), refresh lists.
        if (sessionReady) {
            PetsSyncBus.notifyPetsChanged()
        }
    }

    override fun onPause() {
        SessionEvents.onSessionExpired = null
        super.onPause()
    }

    private fun wireBottomNav() {
        val bottomNavigation = findViewById<BottomNavigationView>(R.id.bottom_navigation)
        bottomNavigation.setOnItemSelectedListener { item ->
            if (!sessionReady) return@setOnItemSelectedListener false
            val fragment: Fragment = when (item.itemId) {
                R.id.navigation_home -> HomeFragment()
                R.id.navigation_pets -> PetsFragment()
                R.id.navigation_reminders -> RemindersFragment()
                R.id.navigation_profile -> ProfileFragment()
                else -> return@setOnItemSelectedListener false
            }
            loadFragment(fragment)
            true
        }
    }

    private fun loadFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.nav_host_fragment, fragment)
            .commit()
    }
}
