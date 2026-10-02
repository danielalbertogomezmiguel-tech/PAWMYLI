package com.example.pawmily

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.pawmily.databinding.ActivityScheduleMedicationBinding
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * Owner schedules dose reminders for a prescription — pet is fixed from intent (no picker).
 */
class ScheduleMedicationActivity : AppCompatActivity() {
    private lateinit var binding: ActivityScheduleMedicationBinding
    private var selectedDateIso: String? = null
    private var selectedTime: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityScheduleMedicationBinding.inflate(layoutInflater)
        setContentView(binding.root)
        ImmersiveMode.applyAfterContent(this)

        val petName = intent.getStringExtra(EXTRA_PET_NAME).orEmpty()
        val medication = intent.getStringExtra(EXTRA_MEDICATION).orEmpty()
        binding.tvPetLabel.text = if (petName.isBlank()) getString(R.string.schedule_med_title)
        else getString(R.string.schedule_med_for_pet, petName)
        binding.tvMedicationLabel.text =
            if (medication.isBlank()) getString(R.string.schedule_med_hint)
            else getString(R.string.report_medication, medication)

        binding.btnBack.setOnClickListener { finish() }
        binding.tvFirstDoseDate.setOnClickListener { showDatePicker() }
        binding.tvFirstDoseTime.setOnClickListener { showTimePicker() }
        binding.btnSchedule.setOnClickListener { submit() }

        val today = Calendar.getInstance()
        selectedDateIso = String.format(
            "%04d-%02d-%02d",
            today.get(Calendar.YEAR),
            today.get(Calendar.MONTH) + 1,
            today.get(Calendar.DAY_OF_MONTH)
        )
        binding.tvFirstDoseDate.text = selectedDateIso
        selectedTime = "09:00"
        binding.tvFirstDoseTime.text = selectedTime
        binding.etIntervalHours.setText("12")
        binding.etDurationDays.setText("7")
    }

    private fun showDatePicker() {
        val c = Calendar.getInstance()
        DatePickerDialog(
            this,
            { _, y, m, d ->
                selectedDateIso = String.format("%04d-%02d-%02d", y, m + 1, d)
                binding.tvFirstDoseDate.text = selectedDateIso
            },
            c.get(Calendar.YEAR),
            c.get(Calendar.MONTH),
            c.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    private fun showTimePicker() {
        val c = Calendar.getInstance()
        TimePickerDialog(
            this,
            { _, h, min ->
                selectedTime = String.format("%02d:%02d", h, min)
                binding.tvFirstDoseTime.text = selectedTime
            },
            c.get(Calendar.HOUR_OF_DAY),
            c.get(Calendar.MINUTE),
            true
        ).show()
    }

    private fun submit() {
        val petId = intent.getStringExtra(EXTRA_PET_BACKEND_ID).orEmpty()
        val recordId = intent.getStringExtra(EXTRA_RECORD_ID).orEmpty()
        val date = selectedDateIso
        val time = selectedTime
        if (petId.isBlank() || recordId.isBlank()) {
            Toast.makeText(this, R.string.error_pet_not_ready, Toast.LENGTH_LONG).show()
            return
        }
        if (date.isNullOrBlank() || time.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_schedule_med_fields, Toast.LENGTH_SHORT).show()
            return
        }
        val interval = binding.etIntervalHours.text?.toString()?.toIntOrNull()
        val days = binding.etDurationDays.text?.toString()?.toIntOrNull()

        binding.btnSchedule.isEnabled = false
        lifecycleScope.launch {
            try {
                val result = RemotePetRepository.scheduleMedication(
                    petId = petId,
                    recordId = recordId,
                    firstDoseDate = date,
                    firstDoseTime = time,
                    intervalHours = interval,
                    durationDays = days
                )
                Toast.makeText(
                    this@ScheduleMedicationActivity,
                    getString(
                        R.string.schedule_med_success,
                        result.created,
                        result.medication ?: getString(R.string.category_medication)
                    ),
                    Toast.LENGTH_LONG
                ).show()
                finish()
            } catch (e: Exception) {
                Toast.makeText(
                    this@ScheduleMedicationActivity,
                    e.message ?: getString(R.string.error_schedule_med),
                    Toast.LENGTH_LONG
                ).show()
                binding.btnSchedule.isEnabled = true
            }
        }
    }

    companion object {
        const val EXTRA_PET_BACKEND_ID = "PET_BACKEND_ID"
        const val EXTRA_PET_NAME = "PET_NAME"
        const val EXTRA_RECORD_ID = "RECORD_ID"
        const val EXTRA_MEDICATION = "MEDICATION"
    }
}
