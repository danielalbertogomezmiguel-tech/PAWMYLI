package com.example.pawmily

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.pawmily.databinding.ActivityPetRemindersBinding
import kotlinx.coroutines.launch

class PetRemindersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPetRemindersBinding
    private lateinit var sessionManager: SessionManager
    private var petCode: String? = null
    private var petBackendId: String? = null
    private var loadedPet: Pet? = null
    private var remoteReminders: List<ReminderDto> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPetRemindersBinding.inflate(layoutInflater)
        setContentView(binding.root)
        ImmersiveMode.applyAfterContent(this)

        sessionManager = SessionManager(this)
        petCode = intent.getStringExtra("PET_ID")
        petBackendId = intent.getStringExtra("PET_BACKEND_ID")


        binding.btnBack.setOnClickListener { finish() }

        binding.addPetReminderDetailCard.setOnClickListener {
            val intent = Intent(this, NewReminderActivity::class.java).apply {
                putExtra("PET_ID", petCode)
                putExtra("PET_BACKEND_ID", petBackendId ?: loadedPet?.backendId)
            }
            startActivity(intent)
        }

        binding.reminderTabs.addOnTabSelectedListener(object :
            com.google.android.material.tabs.TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: com.google.android.material.tabs.TabLayout.Tab?) {
                if (tab?.position == 1) {
                    binding.addPetReminderDetailCard.visibility = View.GONE
                    renderList(showReminders = false)
                } else {
                    binding.addPetReminderDetailCard.visibility = View.VISIBLE
                    renderList(showReminders = true)
                }
            }

            override fun onTabUnselected(tab: com.google.android.material.tabs.TabLayout.Tab?) {}
            override fun onTabReselected(tab: com.google.android.material.tabs.TabLayout.Tab?) {}
        })

        reloadFromApi()
    }

    override fun onResume() {
        super.onResume()
        if (loadedPet != null) reloadFromApi()
    }

    private fun reloadFromApi() {
        val code = petCode
        if (code.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_load_pet_detail, Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(code)
                loadedPet = pet
                petBackendId = pet.backendId ?: petBackendId
                val key = pet.backendId ?: pet.id
                remoteReminders = RemotePetRepository.listReminders(key)
                renderList(showReminders = binding.reminderTabs.selectedTabPosition != 1)
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetRemindersActivity,
                    e.message ?: getString(R.string.error_load_pet_detail),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun renderList(showReminders: Boolean) {
        val pet = loadedPet ?: return
        binding.llRemindersList.removeAllViews()

        if (showReminders) {
            if (remoteReminders.isEmpty()) {
                val empty = TextView(this).apply {
                    text = getString(R.string.empty_reminders)
                    setTextColor(getColor(R.color.text_muted))
                    setPadding(0, 32, 0, 0)
                }
                binding.llRemindersList.addView(empty)
                return
            }
            remoteReminders.forEach { reminder ->
                val v = LayoutInflater.from(this).inflate(R.layout.item_reminder, binding.llRemindersList, false)
                v.findViewById<TextView>(R.id.reminderTitle).text = reminder.title
                v.findViewById<TextView>(R.id.reminderDate).text =
                    listOfNotNull(reminder.date, reminder.time?.takeIf { it.isNotBlank() })
                        .joinToString(" · ")
                val star = v.findViewById<ImageView>(R.id.ivPriorityStar)
                val alta = ReminderPriority.isAlta(reminder.priority)
                star.setImageResource(if (alta) R.drawable.star_on else R.drawable.star_off)
                star.setOnClickListener {
                    togglePriority(reminder)
                }
                v.findViewById<Button>(R.id.btnDetails).setOnClickListener {
                    startActivity(
                        Intent(this, NewReminderActivity::class.java)
                            .putExtra("PET_ID", pet.id)
                            .putExtra("PET_BACKEND_ID", pet.backendId)
                            .putExtra("REMINDER_ID", reminder.id)
                    )
                }
                binding.llRemindersList.addView(v)
            }
        } else {
            val history = pet.medicalHistory
            if (history.isEmpty()) {
                val empty = TextView(this).apply {
                    text = getString(R.string.empty_medical_history)
                    setTextColor(getColor(R.color.text_muted))
                    setPadding(0, 32, 0, 0)
                }
                binding.llRemindersList.addView(empty)
                return
            }
            history.take(10).forEach { medical ->
                val v = LayoutInflater.from(this).inflate(R.layout.item_reminder, binding.llRemindersList, false)
                v.findViewById<TextView>(R.id.reminderTitle).text = medical.type
                v.findViewById<TextView>(R.id.reminderDate).text = medical.date
                v.findViewById<ImageView>(R.id.ivPriorityStar).visibility = View.GONE
                v.findViewById<Button>(R.id.btnDetails).setOnClickListener {
                    startActivity(
                        Intent(this, MedicalReportActivity::class.java)
                            .putExtra("PET_NAME", pet.name)
                            .putExtra("RECORD_DATE", medical.date)
                            .putExtra("RECORD_DOCTOR", medical.doctor)
                            .putExtra("RECORD_REASON", medical.reason)
                            .putExtra("RECORD_DIAGNOSIS", medical.diagnosis)
                            .putExtra("RECORD_TREATMENT", medical.treatment)
                    )
                }
                binding.llRemindersList.addView(v)
            }
        }
    }

    private fun togglePriority(reminder: ReminderDto) {
        lifecycleScope.launch {
            try {
                val next = ReminderPriority.toggleTarget(reminder.priority)
                if (ReminderPriority.isAlta(next) &&
                    !ReminderPriority.canPromoteToAlta(remoteReminders, reminder.id)
                ) {
                    Toast.makeText(
                        this@PetRemindersActivity,
                        "Máximo ${ReminderPriority.MAX_ALTA_PER_PET} con estrella",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@launch
                }
                RemotePetRepository.updateReminder(
                    reminder.id,
                    ReminderUpdateDto(priority = next)
                )
                PetsSyncBus.notifyRemindersChanged()
                reloadFromApi()
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetRemindersActivity,
                    e.message ?: "No se pudo actualizar",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
}
