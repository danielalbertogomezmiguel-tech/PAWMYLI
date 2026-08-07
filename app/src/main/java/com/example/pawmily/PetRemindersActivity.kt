package com.example.pawmily

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.pawmily.databinding.ActivityPetRemindersBinding
import kotlinx.coroutines.launch

class PetRemindersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPetRemindersBinding
    private var petCode: String? = null
    private var petBackendId: String? = null
    private var currentPet: Pet? = null
    private var reminders: List<ReminderDto> = emptyList()

    private val newReminderLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            Toast.makeText(this, R.string.reminder_saved, Toast.LENGTH_SHORT).show()
            reload()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPetRemindersBinding.inflate(layoutInflater)
        setContentView(binding.root)

        petCode = intent.getStringExtra("PET_ID")
        petBackendId = intent.getStringExtra("PET_BACKEND_ID")
        SessionManager(this)

        binding.btnBack.setOnClickListener { finish() }
        binding.addPetReminderDetailCard.setOnClickListener {
            val intent = Intent(this, NewReminderActivity::class.java).apply {
                putExtra(NewReminderActivity.EXTRA_PET_CODE, petCode)
                putExtra(NewReminderActivity.EXTRA_PET_BACKEND_ID, petBackendId)
            }
            newReminderLauncher.launch(intent)
        }

        binding.reminderTabs.addOnTabSelectedListener(object : com.google.android.material.tabs.TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: com.google.android.material.tabs.TabLayout.Tab?) {
                val personal = tab?.position != 1
                binding.addPetReminderDetailCard.visibility = if (personal) View.VISIBLE else View.GONE
                renderList(personal)
            }

            override fun onTabUnselected(tab: com.google.android.material.tabs.TabLayout.Tab?) {}
            override fun onTabReselected(tab: com.google.android.material.tabs.TabLayout.Tab?) {}
        })

        reload()
    }

    override fun onResume() {
        super.onResume()
        reload()
    }

    private fun reload() {
        val code = petCode ?: return
        lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(code)
                currentPet = pet
                petBackendId = pet.backendId
                val backendId = pet.backendId
                reminders = if (backendId.isNullOrBlank()) {
                    emptyList()
                } else {
                    RemotePetRepository.listReminders(backendId)
                }
                renderList(binding.reminderTabs.selectedTabPosition != 1)
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetRemindersActivity,
                    e.message ?: getString(R.string.error_load_reminders),
                    Toast.LENGTH_SHORT
                ).show()
                reminders = emptyList()
                renderList(binding.reminderTabs.selectedTabPosition != 1)
            }
        }
    }

    private fun renderList(personalTab: Boolean) {
        binding.llRemindersList.removeAllViews()
        val filtered = if (personalTab) {
            reminders.filter { !it.type.equals("cita", ignoreCase = true) }
        } else {
            reminders.filter { it.type.equals("cita", ignoreCase = true) }
        }

        if (filtered.isEmpty()) {
            val empty = TextView(this).apply {
                text = getString(
                    if (personalTab) R.string.empty_personal_reminders else R.string.empty_appointment_reminders
                )
                setTextColor(getColor(R.color.text_muted))
                setPadding(24, 48, 24, 24)
                textAlignment = View.TEXT_ALIGNMENT_CENTER
            }
            binding.llRemindersList.addView(empty)
            return
        }

        filtered.forEach { reminder ->
            binding.llRemindersList.addView(buildReminderView(reminder, personalTab))
        }
    }

    private fun buildReminderView(reminder: ReminderDto, personal: Boolean): View {
        val v = LayoutInflater.from(this).inflate(R.layout.item_reminder, binding.llRemindersList, false)
        v.findViewById<TextView>(R.id.reminderTitle).text = reminder.title
        val whenText = listOfNotNull(reminder.date, reminder.time).joinToString(" · ")
        v.findViewById<TextView>(R.id.reminderDate).text = whenText
        val meta = buildList {
            reminder.category?.takeIf { it.isNotBlank() }?.let { add(it.replaceFirstChar(Char::uppercase)) }
            reminder.priority?.takeIf { it.isNotBlank() }?.let { add("Prioridad: $it") }
            if (reminder.completed == true) add(getString(R.string.status_completed))
        }.joinToString(" · ")
        v.findViewById<TextView>(R.id.reminderCategory).text = meta

        val messageView = v.findViewById<TextView>(R.id.reminderMessage)
        val message = reminder.notificationMessage?.takeIf { it.isNotBlank() }
            ?: reminder.description?.takeIf { it.isNotBlank() }
            ?: reminder.notes?.takeIf { it.isNotBlank() }
        if (message != null) {
            messageView.visibility = View.VISIBLE
            messageView.text = message
        } else {
            messageView.visibility = View.GONE
        }

        val btnComplete = v.findViewById<View>(R.id.btnComplete)
        val btnEdit = v.findViewById<View>(R.id.btnEdit)
        val btnDelete = v.findViewById<View>(R.id.btnDelete)
        val btnConfirm = v.findViewById<View>(R.id.btnConfirmAttendance)

        if (personal) {
            btnComplete.visibility = if (reminder.completed == true) View.GONE else View.VISIBLE
            btnEdit.visibility = View.VISIBLE
            btnDelete.visibility = View.VISIBLE
            btnConfirm.visibility = View.GONE

            btnComplete.setOnClickListener { completeReminder(reminder.id) }
            btnEdit.setOnClickListener { openEdit(reminder) }
            btnDelete.setOnClickListener { confirmDelete(reminder) }
        } else {
            btnComplete.visibility = View.GONE
            btnEdit.visibility = View.GONE
            btnDelete.visibility = View.GONE
            btnConfirm.visibility = View.VISIBLE
            btnConfirm.setOnClickListener {
                val appointmentId = reminder.appointmentId
                if (appointmentId.isNullOrBlank()) {
                    Toast.makeText(this, R.string.error_no_appointment, Toast.LENGTH_SHORT).show()
                } else {
                    confirmAppointment(appointmentId)
                }
            }
        }
        return v
    }

    private fun openEdit(reminder: ReminderDto) {
        val intent = Intent(this, NewReminderActivity::class.java).apply {
            putExtra(NewReminderActivity.EXTRA_REMINDER_ID, reminder.id)
            putExtra(NewReminderActivity.EXTRA_PET_CODE, petCode)
            putExtra(NewReminderActivity.EXTRA_PET_BACKEND_ID, petBackendId)
            putExtra(NewReminderActivity.EXTRA_TITLE, reminder.title)
            putExtra(NewReminderActivity.EXTRA_DESCRIPTION, reminder.description)
            putExtra(NewReminderActivity.EXTRA_NOTES, reminder.notes)
            putExtra(NewReminderActivity.EXTRA_DATE, reminder.date)
            putExtra(NewReminderActivity.EXTRA_TIME, reminder.time)
            putExtra(NewReminderActivity.EXTRA_CATEGORY, reminder.category)
            putExtra(NewReminderActivity.EXTRA_RECURRENCE, reminder.recurrence)
            putExtra(NewReminderActivity.EXTRA_PRIORITY, reminder.priority)
            putExtra(NewReminderActivity.EXTRA_COLOR, reminder.color)
            putExtra(NewReminderActivity.EXTRA_ICON, reminder.icon)
            putExtra(NewReminderActivity.EXTRA_NOTIFY, reminder.notifyEnabled ?: true)
        }
        newReminderLauncher.launch(intent)
    }

    private fun confirmDelete(reminder: ReminderDto) {
        AlertDialog.Builder(this)
            .setTitle(R.string.btn_delete)
            .setMessage(getString(R.string.confirm_delete_reminder, reminder.title))
            .setPositiveButton(R.string.btn_delete) { _, _ ->
                lifecycleScope.launch {
                    try {
                        RemotePetRepository.deleteReminder(reminder.id)
                        reload()
                    } catch (e: Exception) {
                        Toast.makeText(
                            this@PetRemindersActivity,
                            e.message ?: getString(R.string.error_delete_reminder),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun completeReminder(id: String) {
        lifecycleScope.launch {
            try {
                RemotePetRepository.completeReminder(id)
                Toast.makeText(this@PetRemindersActivity, R.string.reminder_completed, Toast.LENGTH_SHORT).show()
                reload()
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetRemindersActivity,
                    e.message ?: getString(R.string.error_complete_reminder),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun confirmAppointment(appointmentId: String) {
        lifecycleScope.launch {
            try {
                RemotePetRepository.confirmAppointment(appointmentId)
                Toast.makeText(this@PetRemindersActivity, R.string.appointment_confirmed, Toast.LENGTH_SHORT).show()
                reload()
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetRemindersActivity,
                    e.message ?: getString(R.string.error_confirm_appointment),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}
