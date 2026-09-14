package com.example.pawmily

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class ProfileFragment : Fragment() {
    private lateinit var sessionManager: SessionManager
    private var switchNotifications: SwitchCompat? = null
    private var updatingSwitch = false

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            sessionManager.setNotificationsEnabled(true)
            ReminderNotifier.ensureChannels(requireContext())
            setSwitchChecked(true)
            Toast.makeText(requireContext(), R.string.notifications_enabled, Toast.LENGTH_SHORT).show()
        } else {
            sessionManager.setNotificationsEnabled(false)
            setSwitchChecked(false)
            Toast.makeText(
                requireContext(),
                R.string.notifications_permission_denied,
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_profile, container, false)
        sessionManager = SessionManager(requireContext())

        switchNotifications = view.findViewById(R.id.switchNotifications)
        switchNotifications?.apply {
            isEnabled = true
            setSwitchChecked(sessionManager.areNotificationsEnabled())
            setOnCheckedChangeListener { _, isChecked ->
                if (updatingSwitch) return@setOnCheckedChangeListener
                onNotificationsToggled(isChecked)
            }
        }

        view.findViewById<View>(R.id.logoutCard).setOnClickListener {
            sessionManager.logout()
            val intent = Intent(requireContext(), MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
        }

        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadProfile(view)
    }

    override fun onResume() {
        super.onResume()
        // Prefer session data on resume; network profile only when opening the tab fresh.
        view?.let { view ->
            bindUser(
                view,
                sessionManager.getUserName().orEmpty(),
                sessionManager.getUserEmail().orEmpty(),
                sessionManager.getUserPhone()?.takeIf { it.isNotBlank() }
                    ?: getString(R.string.empty_phone)
            )
        }
        setSwitchChecked(sessionManager.areNotificationsEnabled())
    }

    private fun setSwitchChecked(checked: Boolean) {
        val sw = switchNotifications ?: return
        updatingSwitch = true
        sw.isChecked = checked
        updatingSwitch = false
    }

    private fun onNotificationsToggled(enabled: Boolean) {
        if (!enabled) {
            sessionManager.setNotificationsEnabled(false)
            Toast.makeText(requireContext(), R.string.notifications_disabled, Toast.LENGTH_SHORT).show()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }

        sessionManager.setNotificationsEnabled(true)
        ReminderNotifier.ensureChannels(requireContext())
        Toast.makeText(requireContext(), R.string.notifications_enabled, Toast.LENGTH_SHORT).show()
    }

    private fun loadProfile(view: View) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val user = RemotePetRepository.getProfile()
                val token = sessionManager.getAccessToken()
                if (!token.isNullOrBlank()) {
                    sessionManager.saveAuthSession(
                        token,
                        user,
                        sessionManager.getRefreshToken(),
                    )
                }
                bindUser(
                    view,
                    user.name,
                    user.email.orEmpty(),
                    user.phone?.takeIf { it.isNotBlank() } ?: getString(R.string.empty_phone)
                )

                val profileImage = view.findViewById<ImageView>(R.id.profileImage)
                var photoUrl = user.photo?.takeIf { it.isNotBlank() && !it.startsWith("asset:") }
                if (photoUrl == null && !user.photoAssetId.isNullOrBlank()) {
                    photoUrl = runCatching {
                        RemotePetRepository.getMediaUrl(user.photoAssetId)
                    }.getOrNull()
                } else if (user.photo?.startsWith("asset:") == true) {
                    val assetId = user.photo.removePrefix("asset:")
                    photoUrl = runCatching { RemotePetRepository.getMediaUrl(assetId) }.getOrNull()
                }
                if (profileImage != null) {
                    PetImageLoader.loadInto(profileImage, photoUrl, R.drawable.ic_profile)
                }
            } catch (_: Exception) {
                bindUser(
                    view,
                    sessionManager.getUserName().orEmpty(),
                    sessionManager.getUserEmail().orEmpty(),
                    sessionManager.getUserPhone()?.takeIf { it.isNotBlank() }
                        ?: getString(R.string.empty_phone)
                )
            }
        }
    }

    private fun bindUser(view: View, name: String, email: String, phone: String) {
        view.findViewById<TextView>(R.id.tvUserName)?.apply {
            text = name.ifBlank { "—" }
            setTextColor(ContextCompat.getColor(requireContext(), R.color.ink))
        }
        view.findViewById<TextView>(R.id.tvUserEmail)?.apply {
            text = email.ifBlank { "—" }
            setTextColor(ContextCompat.getColor(requireContext(), R.color.ink))
        }
        view.findViewById<TextView>(R.id.tvUserPhone)?.apply {
            text = phone.ifBlank { getString(R.string.empty_phone) }
            setTextColor(ContextCompat.getColor(requireContext(), R.color.ink))
        }
    }
}
