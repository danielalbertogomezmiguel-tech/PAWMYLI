package com.example.pawmily

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionManager = SessionManager(this)
        val loggedIn = sessionManager.isLoggedIn()
        if (loggedIn) {
            val refresh = sessionManager.getRefreshToken()
            if (refresh.isNullOrBlank()) {
                sessionManager.logout()
                Toast.makeText(
                    this,
                    "Tu sesión ya no es válida. Inicia sesión de nuevo.",
                    Toast.LENGTH_LONG,
                ).show()
                showWelcome()
            } else {
                restoreOrLogin(sessionManager)
            }
            return
        }

        showWelcome()
    }

    private fun restoreOrLogin(sessionManager: SessionManager) {
        Toast.makeText(this, "Renovando sesión…", Toast.LENGTH_SHORT).show()
        thread {
            val newAccess = TokenRefresher.refreshAccessToken(sessionManager.getAccessToken())
            runOnUiThread {
                if (!newAccess.isNullOrBlank()) {
                    goDashboard()
                } else {
                    Toast.makeText(
                        this,
                        "Tu sesión expiró. Inicia sesión de nuevo.",
                        Toast.LENGTH_LONG,
                    ).show()
                    showWelcome()
                }
            }
        }
    }

    private fun goDashboard() {
        startActivity(Intent(this, DashboardActivity::class.java))
        finish()
    }

    private fun showWelcome() {
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ImmersiveMode.apply(this)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        findViewById<Button>(R.id.btnRegister).setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }

        findViewById<Button>(R.id.btnLogin).setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }
    }
}
