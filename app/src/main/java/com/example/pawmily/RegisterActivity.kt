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

class RegisterActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)
        KeyboardDismissHelper.attach(this, findViewById(android.R.id.content))

        val etName = findViewById<EditText>(R.id.etName)
        val etEmail = findViewById<EditText>(R.id.etEmail)
        val etPhone = findViewById<EditText>(R.id.etPhone)
        val etPassword = findViewById<EditText>(R.id.etPassword)
        val btnConfirmRegister = findViewById<Button>(R.id.btnConfirmRegister)
        val sessionManager = SessionManager(this)

        btnConfirmRegister.setOnClickListener {
            val name = etName.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val phone = etPhone.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (name.isEmpty() || email.isEmpty() || phone.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Por favor rellena todos los campos", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (phone.length < 7) {
                Toast.makeText(this, "Número de teléfono no válido", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (password.length < 6) {
                Toast.makeText(this, "La contraseña debe tener al menos 6 caracteres", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            btnConfirmRegister.isEnabled = false
            lifecycleScope.launch {
                try {
                    val response = RetrofitClient.instance.register(
                        RegisterRequest(
                            name = name,
                            phone = phone,
                            email = email,
                            password = password,
                            role = "owner"
                        )
                    )
                    if (response.isSuccessful) {
                        val body = response.body()
                        if (body != null) {
                            if (body.refreshToken.isNullOrBlank()) {
                                Toast.makeText(
                                    this@RegisterActivity,
                                    "El servidor no devolvió refresh token. Actualiza el backend.",
                                    Toast.LENGTH_LONG,
                                ).show()
                                return@launch
                            }
                            TokenRefresher.markSessionValid()
                            sessionManager.saveAuthSession(body.accessToken, body.user, body.refreshToken)
                            Toast.makeText(this@RegisterActivity, "Registro exitoso", Toast.LENGTH_SHORT).show()
                            val intent = Intent(this@RegisterActivity, DashboardActivity::class.java)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            startActivity(intent)
                            finish()
                            return@launch
                        }
                    }
                    val message = RetrofitClient.parseErrorMessage(response.errorBody()?.string())
                        ?: "Error al registrar usuario"
                    Toast.makeText(this@RegisterActivity, message, Toast.LENGTH_SHORT).show()
                } catch (_: IOException) {
                    Toast.makeText(
                        this@RegisterActivity,
                        "No se pudo conectar al servidor. Verifica que el backend esté activo.",
                        Toast.LENGTH_LONG
                    ).show()
                } catch (_: HttpException) {
                    Toast.makeText(this@RegisterActivity, "Error al registrar usuario", Toast.LENGTH_SHORT).show()
                } finally {
                    btnConfirmRegister.isEnabled = true
                }
            }
        }
    }
}
