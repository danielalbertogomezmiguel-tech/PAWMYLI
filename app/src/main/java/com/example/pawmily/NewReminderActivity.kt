package com.example.pawmily

import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.pawmily.databinding.ActivityNewReminderBinding
import kotlinx.coroutines.launch
import java.util.Calendar

class NewReminderActivity : AppCompatActivity() {
    private lateinit var binding: ActivityNewReminderBinding
    private var selectedDateIso: String? = null
    private var selectedTime: String? = null
    private var pets: List<Pet> = emptyList()
    private var editingReminderId: String? = null

    private val categories = listOf("baño", "paseo", "alimento", "medicamento", "vitaminas", "uñas", "otro")
    private val recurrences = listOf("none", "daily", "weekly")
    private val recurrenceLabels = listOf("Ninguna", "Diaria", "Semanal")
    private val priorities = listOf("baja", "media", "alta")
    private val colors = listOf("teal", "coral", "sage", "blue", "amber")
    private val icons = listOf("bell", "paw", "pill", "food", "walk", "bath", "other")

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* channel still created; user can enable later in settings */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNewReminderBinding.inflate(layoutInflater)
        setContentView(binding.root)
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        KeyboardDismissHelper.attach(this, binding.root)
        ReminderNotifier.ensureChannels(this)
        maybeRequestNotificationPermission()

        editingReminderId = intent.getStringExtra(EXTRA_REMINDER_ID)
        binding.tvScreenTitle.text = if (editingReminderId != null) {
            getString(R.string.edit_reminder_title)
        } else {
            getString(R.string.new_reminder_title)
        }

        binding.btnBack.setOnClickListener { finish() }
        binding.tvSelectedDate.setOnClickListener { showDatePicker() }
        binding.tvSelectedTime.setOnClickListener { showTimePicker() }
        binding.btnSaveReminder.setOnClickListener { saveReminder() }

        setupStaticSpinners()
        prefillFromIntent()
        loadPets()
    }

    private fun setupStaticSpinners() {
        binding.spinnerCategory.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, categories)
        binding.spinnerRecurrence.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, recurrenceLabels)
        binding.spinnerPriority.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, priorities)
        binding.spinnerColor.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, colors)
        binding.spinnerIcon.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, icons)
        binding.spinnerPriority.setSelection(priorities.indexOf("media").coerceAtLeast(0))
    }

    private fun prefillFromIntent() {
        intent.getStringExtra(EXTRA_TITLE)?.let { binding.etReminderTitle.setText(it) }
        intent.getStringExtra(EXTRA_DESCRIPTION)?.let { binding.etReminderDescription.setText(it) }
        intent.getStringExtra(EXTRA_NOTES)?.let { binding.etReminderNotes.setText(it) }
        intent.getStringExtra(EXTRA_DATE)?.let {
            selectedDateIso = it
            binding.tvSelectedDate.text = it
        }
        intent.getStringExtra(EXTRA_TIME)?.let {
            selectedTime = it
            binding.tvSelectedTime.text = it
        }
        intent.getStringExtra(EXTRA_CATEGORY)?.let { cat ->
            val idx = categories.indexOf(cat)
            if (idx >= 0) binding.spinnerCategory.setSelection(idx)
        }
        intent.getStringExtra(EXTRA_RECURRENCE)?.let { rec ->
            val idx = recurrences.indexOf(rec)
            if (idx >= 0) binding.spinnerRecurrence.setSelection(idx)
        }
        intent.getStringExtra(EXTRA_PRIORITY)?.let { pri ->
            val idx = priorities.indexOf(pri)
            if (idx >= 0) binding.spinnerPriority.setSelection(idx)
        }
        intent.getStringExtra(EXTRA_COLOR)?.let { color ->
            val idx = colors.indexOf(color)
            if (idx >= 0) binding.spinnerColor.setSelection(idx)
        }
        intent.getStringExtra(EXTRA_ICON)?.let { icon ->
            val idx = icons.indexOf(icon)
            if (idx >= 0) binding.spinnerIcon.setSelection(idx)
        }
        if (intent.hasExtra(EXTRA_NOTIFY)) {
            binding.switchNotify.isChecked = intent.getBooleanExtra(EXTRA_NOTIFY, true)
        }
    }

    private fun loadPets() {
        lifecycleScope.launch {
            try {
                pets = RemotePetRepository.listMyPets()
                if (pets.isEmpty()) {
                    Toast.makeText(this@NewReminderActivity, R.string.empty_pets, Toast.LENGTH_LONG).show()
                    finish()
                    return@launch
                }
                val names = pets.map { "${it.name} (${it.id})" }
                binding.spinnerPet.adapter = ArrayAdapter(
                    this@NewReminderActivity,
                    android.R.layout.simple_spinner_dropdown_item,
                    names
                )
                val preferredCode = intent.getStringExtra(EXTRA_PET_CODE)
                val preferredBackendId = intent.getStringExtra(EXTRA_PET_BACKEND_ID)
                val index = pets.indexOfFirst {
                    it.id.equals(preferredCode, true) || it.backendId == preferredBackendId
                }
                if (index >= 0) binding.spinnerPet.setSelection(index)
            } catch (e: Exception) {
                Toast.makeText(
                    this@NewReminderActivity,
                    e.message ?: getString(R.string.error_load_pets),
                    Toast.LENGTH_SHORT
                ).show()
                finish()
            }
        }
    }

    private fun saveReminder() {
        val title = binding.etReminderTitle.text.toString().trim()
        if (title.isEmpty()) {
            Toast.makeText(this, R.string.error_reminder_title, Toast.LENGTH_SHORT).show()
            return
        }
        if (selectedDateIso.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_select_date, Toast.LENGTH_SHORT).show()
            return
        }
        if (selectedTime.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_select_time, Toast.LENGTH_SHORT).show()
            return
        }
        if (pets.isEmpty()) {
            Toast.makeText(this, R.string.empty_pets, Toast.LENGTH_SHORT).show()
            return
        }

        val pet = pets[binding.spinnerPet.selectedItemPosition]
        val backendId = pet.backendId
        if (backendId.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_pet_id, Toast.LENGTH_SHORT).show()
            return
        }

        val bodyCreate = ReminderCreateDto(
            title = title,
            description = binding.etReminderDescription.text.toString().trim().ifBlank { null },
            date = selectedDateIso!!,
            time = selectedTime,
            type = "recordatorio",
            category = categories[binding.spinnerCategory.selectedItemPosition],
            priority = priorities[binding.spinnerPriority.selectedItemPosition],
            color = colors[binding.spinnerColor.selectedItemPosition],
            icon = icons[binding.spinnerIcon.selectedItemPosition],
            notifyEnabled = binding.switchNotify.isChecked,
            notes = binding.etReminderNotes.text.toString().trim().ifBlank { null },
            recurrence = recurrences[binding.spinnerRecurrence.selectedItemPosition]
        )

        binding.btnSaveReminder.isEnabled = false
        lifecycleScope.launch {
            try {
                if (ReminderPriority.isAlta(bodyCreate.priority)) {
                    val existing = RemotePetRepository.listReminders(backendId)
                    if (!ReminderPriority.canPromoteToAlta(existing, editingReminderId)) {
                        Toast.makeText(
                            this@NewReminderActivity,
                            R.string.toast_max_priority_reminders,
                            Toast.LENGTH_SHORT
                        ).show()
                        return@launch
                    }
                }

                val reminderId = editingReminderId
                val saved = if (reminderId != null) {
                    RemotePetRepository.updateReminder(
                        reminderId,
                        ReminderUpdateDto(
                            title = bodyCreate.title,
                            description = bodyCreate.description,
                            date = bodyCreate.date,
                            time = bodyCreate.time,
                            type = bodyCreate.type,
                            category = bodyCreate.category,
                            priority = bodyCreate.priority,
                            color = bodyCreate.color,
                            icon = bodyCreate.icon,
                            notifyEnabled = bodyCreate.notifyEnabled,
                            notes = bodyCreate.notes,
                            recurrence = bodyCreate.recurrence
                        )
                    )
                } else {
                    RemotePetRepository.createReminder(backendId, bodyCreate)
                }

                ReminderNotifier.schedule(
                    context = this@NewReminderActivity,
                    reminderId = saved.id,
                    title = saved.title,
                    message = saved.notificationMessage ?: saved.description ?: saved.title,
                    dateIso = saved.date,
                    timeHm = saved.time ?: bodyCreate.time.orEmpty(),
                    priority = saved.priority ?: bodyCreate.priority,
                    notifyEnabled = (saved.notifyEnabled ?: true) && (bodyCreate.notifyEnabled != false)
                )

                PetsSyncBus.notifyRemindersChanged()
                setResult(RESULT_OK, android.content.Intent().putExtra("REMINDER_TITLE", title))
                Toast.makeText(this@NewReminderActivity, R.string.reminder_saved, Toast.LENGTH_SHORT).show()
                finish()
            } catch (e: ApiException) {
                Toast.makeText(this@NewReminderActivity, e.message, Toast.LENGTH_LONG).show()
            } catch (_: Exception) {
                Toast.makeText(this@NewReminderActivity, R.string.error_save_reminder, Toast.LENGTH_SHORT).show()
            } finally {
                binding.btnSaveReminder.isEnabled = true
            }
        }
    }

    private fun showDatePicker() {
        val calendar = Calendar.getInstance()
        DatePickerDialog(this, { _, year, month, dayOfMonth ->
            selectedDateIso = String.format("%04d-%02d-%02d", year, month + 1, dayOfMonth)
            binding.tvSelectedDate.text = selectedDateIso
        }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH)).show()
    }

    private fun showTimePicker() {
        val calendar = Calendar.getInstance()
        TimePickerDialog(this, { _, hourOfDay, minute ->
            selectedTime = String.format("%02d:%02d", hourOfDay, minute)
            binding.tvSelectedTime.text = selectedTime
        }, calendar.get(Calendar.HOUR_OF_DAY), calendar.get(Calendar.MINUTE), true).show()
    }

    private fun maybeRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    companion object {
        const val EXTRA_PET_CODE = "PET_CODE"
        const val EXTRA_PET_BACKEND_ID = "PET_BACKEND_ID"
        const val EXTRA_REMINDER_ID = "REMINDER_ID"
        const val EXTRA_TITLE = "TITLE"
        const val EXTRA_DESCRIPTION = "DESCRIPTION"
        const val EXTRA_NOTES = "NOTES"
        const val EXTRA_DATE = "DATE"
        const val EXTRA_TIME = "TIME"
        const val EXTRA_CATEGORY = "CATEGORY"
        const val EXTRA_RECURRENCE = "RECURRENCE"
        const val EXTRA_PRIORITY = "PRIORITY"
        const val EXTRA_COLOR = "COLOR"
        const val EXTRA_ICON = "ICON"
        const val EXTRA_NOTIFY = "NOTIFY"
    }
}
