package com.example.pawmily

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class ProfileFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_profile, container, false)
        val sessionManager = SessionManager(requireContext())

        view.findViewById<TextView>(R.id.tvUserName)?.text = ""
        view.findViewById<TextView>(R.id.tvUserEmail)?.text = ""
        view.findViewById<TextView>(R.id.tvUserPhone)?.text = ""

        view.findViewById<View>(R.id.logoutCard).setOnClickListener {
            sessionManager.logout()
            val intent = Intent(requireContext(), MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
        }

        loadProfile(view, sessionManager)
        return view
    }

    override fun onResume() {
        super.onResume()
        view?.let { loadProfile(it, SessionManager(requireContext())) }
    }

    private fun loadProfile(view: View, sessionManager: SessionManager) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val response = RetrofitClient.instance.getProfile()
                if (response.isSuccessful) {
                    val user = response.body()
                    if (user != null) {
                        val token = sessionManager.getAccessToken()
                        if (!token.isNullOrBlank()) {
                            sessionManager.saveAuthSession(token, user)
                        }
                        view.findViewById<TextView>(R.id.tvUserName)?.text = user.name
                        view.findViewById<TextView>(R.id.tvUserEmail)?.text = user.email.orEmpty()
                        view.findViewById<TextView>(R.id.tvUserPhone)?.text = user.phone.orEmpty()
                        return@launch
                    }
                }
                // Fallback to cached session values
                view.findViewById<TextView>(R.id.tvUserName)?.text = sessionManager.getUserName().orEmpty()
                view.findViewById<TextView>(R.id.tvUserEmail)?.text = sessionManager.getUserEmail().orEmpty()
                view.findViewById<TextView>(R.id.tvUserPhone)?.text = sessionManager.getUserPhone().orEmpty()
                val message = RetrofitClient.parseErrorMessage(response.errorBody()?.string())
                if (!message.isNullOrBlank()) {
                    Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
                }
            } catch (_: Exception) {
                view.findViewById<TextView>(R.id.tvUserName)?.text = sessionManager.getUserName().orEmpty()
                view.findViewById<TextView>(R.id.tvUserEmail)?.text = sessionManager.getUserEmail().orEmpty()
                view.findViewById<TextView>(R.id.tvUserPhone)?.text = sessionManager.getUserPhone().orEmpty()
            }
        }
    }
}
