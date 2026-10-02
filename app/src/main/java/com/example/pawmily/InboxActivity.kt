package com.example.pawmily

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class InboxActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_inbox)
        ImmersiveMode.applyAfterContent(this)

        findViewById<View>(R.id.btnBack).setOnClickListener { finish() }
        findViewById<AppCompatButton>(R.id.btnMarkRead).setOnClickListener {
            InboxStore.markAllRead(this)
            lifecycleScope.launch {
                runCatching { RemotePetRepository.markAllInboxRead() }
            }
            render()
        }
        syncAndRender()
    }

    override fun onResume() {
        super.onResume()
        syncAndRender()
    }

    private fun syncAndRender() {
        lifecycleScope.launch {
            try {
                val remote = RemotePetRepository.listInbox()
                InboxStore.syncFromClinicMessages(this@InboxActivity, remote)
            } catch (_: Exception) {
                // Offline: keep local
            }
            render()
        }
    }

    private fun canActOnAppointment(msg: InboxStore.Message): Boolean {
        if (msg.appointmentId.isNullOrBlank()) return false
        if (msg.action == "none") return false
        val outcome = msg.outcome.orEmpty().lowercase()
        if (outcome == "accepted" || outcome == "rejected" || outcome == "suggested" ||
            outcome == "owner_confirmed"
        ) {
            return false
        }
        val type = msg.type.orEmpty()
        return type == "appointment_request" || type == "appointment_update"
    }

    private fun outcomeLabel(outcome: String?): String? {
        return when (outcome?.lowercase()) {
            "accepted" -> getString(R.string.inbox_status_accepted)
            "rejected" -> getString(R.string.inbox_status_rejected)
            "suggested" -> getString(R.string.inbox_status_suggested)
            "owner_confirmed" -> getString(R.string.inbox_status_owner_confirmed)
            else -> if (outcome.isNullOrBlank()) null else getString(R.string.inbox_status_resolved)
        }
    }

    private fun render() {
        val list = findViewById<LinearLayout>(R.id.llInboxMessages)
        val empty = findViewById<TextView>(R.id.tvInboxEmpty)
        list.removeAllViews()
        val messages = InboxStore.list(this)
        empty.visibility = if (messages.isEmpty()) View.VISIBLE else View.GONE
        val fmt = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        messages.forEach { msg ->
            val row = LayoutInflater.from(this).inflate(R.layout.item_inbox_message, list, false)
            row.findViewById<TextView>(R.id.tvInboxTitle).text = msg.title
            val body = buildString {
                append(msg.body)
                if (msg.type == "prescription" && !msg.recordId.isNullOrBlank()) {
                    append("\n")
                    append(getString(R.string.inbox_tap_schedule))
                }
            }
            row.findViewById<TextView>(R.id.tvInboxBody).text = body
            row.findViewById<TextView>(R.id.tvInboxWhen).text = fmt.format(Date(msg.createdAtMs))
            if (!msg.read) {
                row.findViewById<TextView>(R.id.tvInboxTitle)
                    .setTypeface(null, android.graphics.Typeface.BOLD)
            }

            val actions = row.findViewById<LinearLayout>(R.id.llInboxActions)
            val outcomeTv = row.findViewById<TextView>(R.id.tvInboxOutcome)
            val btnAccept = row.findViewById<AppCompatButton>(R.id.btnInboxAccept)
            val btnReject = row.findViewById<AppCompatButton>(R.id.btnInboxReject)
            val btnSuggest = row.findViewById<AppCompatButton>(R.id.btnInboxSuggest)

            if (canActOnAppointment(msg)) {
                actions.visibility = View.VISIBLE
                outcomeTv.visibility = View.GONE
                btnAccept.setOnClickListener { acceptAppointment(msg) }
                btnReject.setOnClickListener { rejectAppointment(msg) }
                btnSuggest.setOnClickListener { suggestAppointment(msg) }
            } else {
                actions.visibility = View.GONE
                val label = outcomeLabel(msg.outcome)
                if (label != null && !msg.appointmentId.isNullOrBlank()) {
                    outcomeTv.visibility = View.VISIBLE
                    outcomeTv.text = label
                } else {
                    outcomeTv.visibility = View.GONE
                }
                row.setOnClickListener {
                    if (msg.type == "prescription" &&
                        !msg.patientId.isNullOrBlank() &&
                        !msg.recordId.isNullOrBlank()
                    ) {
                        startActivity(
                            Intent(this, ScheduleMedicationActivity::class.java)
                                .putExtra(
                                    ScheduleMedicationActivity.EXTRA_PET_BACKEND_ID,
                                    msg.patientId
                                )
                                .putExtra(ScheduleMedicationActivity.EXTRA_RECORD_ID, msg.recordId)
                                .putExtra(
                                    ScheduleMedicationActivity.EXTRA_MEDICATION,
                                    msg.medication.orEmpty()
                                )
                        )
                    }
                }
            }
            list.addView(row)
        }
    }

    private fun acceptAppointment(msg: InboxStore.Message) {
        val id = msg.appointmentId ?: return
        lifecycleScope.launch {
            try {
                RemotePetRepository.acceptAppointment(id)
                InboxStore.resolveAppointment(this@InboxActivity, id, "accepted", msg.id)
                runCatching { RemotePetRepository.markInboxRead(msg.id) }
                Toast.makeText(this@InboxActivity, R.string.inbox_accept_ok, Toast.LENGTH_SHORT)
                    .show()
                syncAndRender()
            } catch (e: Exception) {
                Toast.makeText(
                    this@InboxActivity,
                    e.message ?: getString(R.string.error_inbox_action),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun rejectAppointment(msg: InboxStore.Message) {
        val id = msg.appointmentId ?: return
        lifecycleScope.launch {
            try {
                RemotePetRepository.rejectAppointment(id)
                InboxStore.resolveAppointment(this@InboxActivity, id, "rejected", msg.id)
                runCatching { RemotePetRepository.markInboxRead(msg.id) }
                Toast.makeText(this@InboxActivity, R.string.inbox_reject_ok, Toast.LENGTH_SHORT)
                    .show()
                syncAndRender()
            } catch (e: Exception) {
                Toast.makeText(
                    this@InboxActivity,
                    e.message ?: getString(R.string.error_inbox_action),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun suggestAppointment(msg: InboxStore.Message) {
        val id = msg.appointmentId ?: return
        val calendar = Calendar.getInstance()
        DatePickerDialog(
            this,
            { _, y, m, d ->
                val date = String.format("%04d-%02d-%02d", y, m + 1, d)
                TimePickerDialog(
                    this,
                    { _, h, min ->
                        val time = String.format("%02d:%02d", h, min)
                        lifecycleScope.launch {
                            try {
                                RemotePetRepository.suggestAppointment(id, date, time)
                                InboxStore.resolveAppointment(
                                    this@InboxActivity,
                                    id,
                                    "suggested",
                                    msg.id
                                )
                                runCatching { RemotePetRepository.markInboxRead(msg.id) }
                                Toast.makeText(
                                    this@InboxActivity,
                                    R.string.inbox_suggest_ok,
                                    Toast.LENGTH_SHORT
                                ).show()
                                syncAndRender()
                            } catch (e: Exception) {
                                Toast.makeText(
                                    this@InboxActivity,
                                    e.message ?: getString(R.string.error_inbox_action),
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    },
                    calendar.get(Calendar.HOUR_OF_DAY),
                    calendar.get(Calendar.MINUTE),
                    true
                ).show()
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        ).apply {
            datePicker.minDate = calendar.timeInMillis
        }.show()
    }
}
