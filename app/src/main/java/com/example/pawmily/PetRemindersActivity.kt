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
    private var petCode: String? = null
    private var petBackendId: String? = null
    private var loadedPet: Pet? = null
    private var remoteReminders: List<ReminderDto> = emptyList()
    private var petAppointments: List<AppointmentDto> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPetRemindersBinding.inflate(layoutInflater)
        setContentView(binding.root)
        ImmersiveMode.applyAfterContent(this)

        petCode = intent.getStringExtra("PET_ID")
        petBackendId = intent.getStringExtra("PET_BACKEND_ID")

        binding.btnBack.setOnClickListener { finish() }

        binding.addPetReminderDetailCard.setOnClickListener {
            if (binding.reminderTabs.selectedTabPosition == 1) {
                openRequestAppointment()
            } else {
                startActivity(
                    Intent(this, NewReminderActivity::class.java)
                        .putExtra(NewReminderActivity.EXTRA_PET_CODE, petCode)
                        .putExtra(
                            NewReminderActivity.EXTRA_PET_BACKEND_ID,
                            petBackendId ?: loadedPet?.backendId
                        )
                )
            }
        }

        binding.reminderTabs.addOnTabSelectedListener(object :
            com.google.android.material.tabs.TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: com.google.android.material.tabs.TabLayout.Tab?) {
                binding.addPetReminderDetailCard.visibility = View.VISIBLE
                renderList(showReminders = tab?.position != 1)
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

    private fun openRequestAppointment() {
        val pet = loadedPet
        val backendId = pet?.backendId ?: petBackendId
        if (backendId.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_pet_id, Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(
            Intent(this, RequestAppointmentActivity::class.java)
                .putExtra(RequestAppointmentActivity.EXTRA_PET_BACKEND_ID, backendId)
                .putExtra(RequestAppointmentActivity.EXTRA_PET_NAME, pet?.name.orEmpty())
        )
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
                val all = RemotePetRepository.listMyAppointments()
                petAppointments = all.filter { appt ->
                    appt.patientId == pet.backendId ||
                        appt.petName.equals(pet.name, ignoreCase = true)
                }.filterNot {
                    it.status.equals("Eliminada", ignoreCase = true) ||
                        it.status.equals("Cancelada", ignoreCase = true)
                }.sortedBy { "${it.date} ${it.time}" }
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
                binding.llRemindersList.addView(emptyText(getString(R.string.empty_reminders)))
                return
            }
            remoteReminders.forEach { reminder ->
                val v = LayoutInflater.from(this)
                    .inflate(R.layout.item_reminder, binding.llRemindersList, false)
                v.findViewById<TextView>(R.id.reminderTitle).text = reminder.title
                v.findViewById<TextView>(R.id.reminderDate).text =
                    listOfNotNull(reminder.date, reminder.time?.takeIf { it.isNotBlank() })
                        .joinToString(" · ")
                val star = v.findViewById<ImageView>(R.id.ivPriorityStar)
                val alta = ReminderPriority.isAlta(reminder.priority)
                star.setImageResource(if (alta) R.drawable.star_on else R.drawable.star_off)
                star.setOnClickListener { togglePriority(reminder) }
                v.findViewById<Button>(R.id.btnDetails).setOnClickListener {
                    startActivity(NewReminderActivity.intentFor(this, pet, reminder))
                }
                binding.llRemindersList.addView(v)
            }
        } else {
            if (petAppointments.isEmpty()) {
                binding.llRemindersList.addView(
                    emptyText(getString(R.string.empty_appointment_reminders))
                )
                return
            }
            petAppointments.forEach { appt ->
                binding.llRemindersList.addView(appointmentCard(appt))
            }
        }
    }

    private fun appointmentCard(appt: AppointmentDto): View {
        val v = LayoutInflater.from(this)
            .inflate(R.layout.item_appointment, binding.llRemindersList, false)
        v.findViewById<TextView>(R.id.tvAppointmentPet).text = appt.petName
        v.findViewById<TextView>(R.id.tvAppointmentWhen).text =
            listOf(appt.date, appt.time).joinToString(" · ")
        val statusLabel = appt.status?.takeIf { it.isNotBlank() } ?: "—"
        val attendance = appt.attendanceStatus?.takeIf { it.isNotBlank() }
        v.findViewById<TextView>(R.id.tvAppointmentStatus).text =
            if (attendance != null && !attendance.equals(statusLabel, true)) {
                getString(R.string.appointment_status_line, statusLabel, attendance)
            } else {
                getString(R.string.appointment_status_simple, statusLabel)
            }
        v.findViewById<TextView>(R.id.tvAppointmentNotes).text =
            appt.notes?.takeIf { it.isNotBlank() } ?: getString(R.string.no_appointment_notes)

        val confirm = v.findViewById<Button>(R.id.btnConfirmAppointment)
        val postpone = v.findViewById<Button>(R.id.btnPostponeAppointment)
        val canConfirm = appt.status.equals("Programada", ignoreCase = true) ||
            appt.status.equals("Reagendada", ignoreCase = true)
        val canPostpone = !appt.status.equals("Completada", ignoreCase = true) &&
            !appt.status.equals("Eliminada", ignoreCase = true) &&
            !appt.status.equals("Cancelada", ignoreCase = true)
        confirm.visibility = if (canConfirm) View.VISIBLE else View.GONE
        postpone.visibility = if (canPostpone) View.VISIBLE else View.GONE
        confirm.setOnClickListener { confirmAppointment(appt.id) }
        postpone.setOnClickListener { showPostponeSuggestions(appt) }
        return v
    }

    private fun showPostponeSuggestions(appt: AppointmentDto) {
        fun labelFor(daysAhead: Int): Pair<String, String> {
            val c = java.util.Calendar.getInstance()
            c.add(java.util.Calendar.DAY_OF_YEAR, daysAhead)
            val date = String.format(
                "%04d-%02d-%02d",
                c.get(java.util.Calendar.YEAR),
                c.get(java.util.Calendar.MONTH) + 1,
                c.get(java.util.Calendar.DAY_OF_MONTH)
            )
            return date to (appt.time.ifBlank { "09:00" })
        }
        val opt2 = labelFor(2)
        val opt5 = labelFor(5)
        val opt7 = labelFor(7)
        val labels = arrayOf(
            getString(R.string.postpone_option, opt2.first, opt2.second),
            getString(R.string.postpone_option, opt5.first, opt5.second),
            getString(R.string.postpone_option, opt7.first, opt7.second)
        )
        val choices = listOf(opt2, opt5, opt7)
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(R.string.postpone_pick_title)
            .setItems(labels) { _, which ->
                val picked = choices[which]
                postponeAppointment(appt.id, picked.first, picked.second)
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun postponeAppointment(id: String, date: String, time: String) {
        lifecycleScope.launch {
            try {
                RemotePetRepository.postponeAppointment(id, date, time)
                Toast.makeText(
                    this@PetRemindersActivity,
                    R.string.appointment_postpone_sent,
                    Toast.LENGTH_LONG
                ).show()
                reloadFromApi()
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetRemindersActivity,
                    e.message ?: getString(R.string.error_postpone_appointment),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun confirmAppointment(id: String) {
        lifecycleScope.launch {
            try {
                RemotePetRepository.confirmAppointment(id)
                Toast.makeText(this@PetRemindersActivity, R.string.appointment_confirmed, Toast.LENGTH_SHORT)
                    .show()
                reloadFromApi()
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetRemindersActivity,
                    e.message ?: getString(R.string.error_confirm_appointment),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun emptyText(message: String): TextView =
        TextView(this).apply {
            text = message
            setTextColor(getColor(R.color.text_muted))
            setPadding(0, 32, 0, 0)
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
