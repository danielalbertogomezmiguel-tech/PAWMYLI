package com.example.pawmily

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException

class LoginActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)
        KeyboardDismissHelper.attach(this, findViewById(android.R.id.content))

        val etPhone = findViewById<EditText>(R.id.etLoginPhone)
        val etPassword = findViewById<EditText>(R.id.etLoginPassword)
        val btnConfirmLogin = findViewById<Button>(R.id.btnConfirmLogin)
        val sessionManager = SessionManager(this)

        btnConfirmLogin.setOnClickListener {
            val phone = etPhone.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (phone.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Por favor rellena todos los campos", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            btnConfirmLogin.isEnabled = false
            lifecycleScope.launch {
                try {
                    val response = RetrofitClient.instance.login(
                        LoginRequest(phone = phone, password = password)
                    )
                    if (response.isSuccessful) {
                        val body = response.body()
                        if (body != null) {
                            if (body.refreshToken.isNullOrBlank()) {
                                Toast.makeText(
                                    this@LoginActivity,
                                    "El servidor no devolvió refresh token. Actualiza el backend.",
                                    Toast.LENGTH_LONG,
                                ).show()
                                return@launch
                            }
                            TokenRefresher.markSessionValid()
                            sessionManager.saveAuthSession(body.accessToken, body.user, body.refreshToken)
                            runCatching {
                                com.example.pawmily.data.LocalCacheStore.saveProfile(body.user)
                            }
                            Toast.makeText(this@LoginActivity, "Inicio de sesión correcto", Toast.LENGTH_SHORT).show()
                            val intent = Intent(this@LoginActivity, DashboardActivity::class.java)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            startActivity(intent)
                            finish()
                            return@launch
                        }
                    }
                    val message = RetrofitClient.parseErrorMessage(response.errorBody()?.string())
                        ?: "Teléfono o contraseña incorrectos"
                    Toast.makeText(this@LoginActivity, message, Toast.LENGTH_SHORT).show()
                } catch (_: IOException) {
                    Toast.makeText(
                        this@LoginActivity,
                        "No se pudo conectar al servidor. Verifica que el backend esté activo.",
                        Toast.LENGTH_LONG
                    ).show()
                } catch (_: HttpException) {
                    Toast.makeText(this@LoginActivity, "Teléfono o contraseña incorrectos", Toast.LENGTH_SHORT).show()
                } finally {
                    btnConfirmLogin.isEnabled = true
                }
            }
        }
    }
}
