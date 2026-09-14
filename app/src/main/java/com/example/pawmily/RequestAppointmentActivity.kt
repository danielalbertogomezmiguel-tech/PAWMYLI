package com.example.pawmily

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.util.Calendar

class RequestAppointmentActivity : AppCompatActivity() {
    private var petBackendId: String? = null
    private var petName: String = ""
    private var selectedDateIso: String? = null
    private var selectedTime: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_request_appointment)
        ImmersiveMode.applyAfterContent(this)

        petBackendId = intent.getStringExtra(EXTRA_PET_BACKEND_ID)
        petName = intent.getStringExtra(EXTRA_PET_NAME).orEmpty()

        findViewById<TextView>(R.id.tvPetLabel).text =
            getString(R.string.request_appointment_for_pet, petName.ifBlank { "—" })
        findViewById<ImageButton>(R.id.btnBack).setOnClickListener { finish() }

        val tvDate = findViewById<TextView>(R.id.tvPreferredDate)
        val tvTime = findViewById<TextView>(R.id.tvPreferredTime)
        tvDate.setOnClickListener { showDatePicker(tvDate) }
        tvTime.setOnClickListener { showTimePicker(tvTime) }

        findViewById<AppCompatButton>(R.id.btnSubmitRequest).setOnClickListener {
            submitRequest()
        }
    }

    private fun submitRequest() {
        val patientId = petBackendId
        if (patientId.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_pet_id, Toast.LENGTH_SHORT).show()
            return
        }
        val date = selectedDateIso
        val time = selectedTime
        if (date.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_select_date, Toast.LENGTH_SHORT).show()
            return
        }
        if (time.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_select_time, Toast.LENGTH_SHORT).show()
            return
        }
        val reason = findViewById<EditText>(R.id.etReason).text.toString().trim()
            .ifBlank { null }

        val btn = findViewById<AppCompatButton>(R.id.btnSubmitRequest)
        btn.isEnabled = false
        lifecycleScope.launch {
            try {
                RemotePetRepository.requestAppointment(
                    patientId = patientId,
                    date = date,
                    time = time,
                    notes = reason
                )
                InboxStore.add(
                    this@RequestAppointmentActivity,
                    getString(R.string.request_appointment_title),
                    getString(R.string.appointment_request_sent) +
                        " ($petName · $date $time)"
                )
                Toast.makeText(
                    this@RequestAppointmentActivity,
                    R.string.appointment_request_sent,
                    Toast.LENGTH_LONG
                ).show()
                setResult(RESULT_OK)
                finish()
            } catch (e: Exception) {
                Toast.makeText(
                    this@RequestAppointmentActivity,
                    e.message ?: getString(R.string.error_request_appointment),
                    Toast.LENGTH_LONG
                ).show()
            } finally {
                btn.isEnabled = true
            }
        }
    }

    private fun showDatePicker(target: TextView) {
        val calendar = Calendar.getInstance()
        val dialog = DatePickerDialog(this, { _, year, month, dayOfMonth ->
            selectedDateIso = String.format("%04d-%02d-%02d", year, month + 1, dayOfMonth)
            target.text = selectedDateIso
        }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH))
        dialog.datePicker.minDate = calendar.timeInMillis
        dialog.show()
    }

    private fun showTimePicker(target: TextView) {
        val calendar = Calendar.getInstance()
        TimePickerDialog(this, { _, hourOfDay, minute ->
            selectedTime = String.format("%02d:%02d", hourOfDay, minute)
            target.text = selectedTime
        }, calendar.get(Calendar.HOUR_OF_DAY), calendar.get(Calendar.MINUTE), true).show()
    }

    companion object {
        const val EXTRA_PET_BACKEND_ID = "PET_BACKEND_ID"
        const val EXTRA_PET_NAME = "PET_NAME"
    }
}
