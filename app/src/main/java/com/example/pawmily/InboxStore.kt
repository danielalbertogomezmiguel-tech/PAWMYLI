package com.example.pawmily

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Local "correo" / inbox for clinic notifications (appointment changes, prescriptions).
 * Survives offline; merges server ClinicMessage rows when online.
 */
object InboxStore {
    private const val PREFS = "PawMilyInbox"
    private const val KEY_MESSAGES = "messages"
    private const val KEY_APPT_SNAPSHOT = "appt_status_snapshot"
    private const val KEY_SYNCED_SERVER_IDS = "synced_server_ids"
    private const val MAX = 80

    data class Message(
        val id: String,
        val title: String,
        val body: String,
        val createdAtMs: Long,
        val read: Boolean,
        val patientId: String? = null,
        val recordId: String? = null,
        val type: String? = null,
        val medication: String? = null,
        val appointmentId: String? = null,
        val suggestedDate: String? = null,
        val suggestedTime: String? = null,
        val action: String? = null,
        val outcome: String? = null,
    )

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun unreadCount(context: Context): Int = list(context).count { !it.read }

    fun list(context: Context): List<Message> {
        val raw = prefs(context).getString(KEY_MESSAGES, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        Message(
                            id = o.getString("id"),
                            title = o.getString("title"),
                            body = o.getString("body"),
                            createdAtMs = o.getLong("createdAtMs"),
                            read = o.optBoolean("read", false),
                            patientId = o.optString("patientId").takeIf { it.isNotBlank() },
                            recordId = o.optString("recordId").takeIf { it.isNotBlank() },
                            type = o.optString("type").takeIf { it.isNotBlank() },
                            medication = o.optString("medication").takeIf { it.isNotBlank() },
                            appointmentId = o.optString("appointmentId").takeIf { it.isNotBlank() },
                            suggestedDate = o.optString("suggestedDate").takeIf { it.isNotBlank() },
                            suggestedTime = o.optString("suggestedTime").takeIf { it.isNotBlank() },
                            action = o.optString("action").takeIf { it.isNotBlank() },
                            outcome = o.optString("outcome").takeIf { it.isNotBlank() },
                        )
                    )
                }
            }.sortedByDescending { it.createdAtMs }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun add(
        context: Context,
        title: String,
        body: String,
        id: String? = null,
        patientId: String? = null,
        recordId: String? = null,
        type: String? = null,
        medication: String? = null,
        notify: Boolean = true,
    ) {
        val messages = list(context).toMutableList()
        val msgId = id ?: "msg_${System.currentTimeMillis()}_${messages.size}"
        if (messages.any { it.id == msgId }) return
        messages.add(
            0,
            Message(
                id = msgId,
                title = title,
                body = body,
                createdAtMs = System.currentTimeMillis(),
                read = false,
                patientId = patientId,
                recordId = recordId,
                type = type,
                medication = medication,
            )
        )
        while (messages.size > MAX) messages.removeAt(messages.lastIndex)
        save(context, messages)
        if (notify) ReminderNotifier.notifyInbox(context, title, body)
    }

    fun markAllRead(context: Context) {
        save(context, list(context).map { it.copy(read = true) })
    }

    /** Optimistically clear action buttons for every local row of this appointment. */
    fun resolveAppointment(
        context: Context,
        appointmentId: String,
        outcome: String,
        markReadId: String? = null,
    ) {
        val next = list(context).map { msg ->
            if (msg.appointmentId != appointmentId) {
                if (markReadId != null && msg.id == markReadId) msg.copy(read = true) else msg
            } else {
                msg.copy(
                    action = "none",
                    outcome = outcome,
                    read = if (markReadId != null && msg.id == markReadId) true else msg.read,
                )
            }
        }
        save(context, next)
    }

    /** Merge server clinic messages into local inbox (idempotent by server id). */
    fun syncFromClinicMessages(context: Context, messages: List<ClinicMessageDto>) {
        val prefs = prefs(context)
        val synced = prefs.getStringSet(KEY_SYNCED_SERVER_IDS, emptySet())?.toMutableSet()
            ?: mutableSetOf()
        val local = list(context).toMutableList()
        messages.forEach { m ->
            val payload = m.payload
            val patientId = m.patientId ?: payload?.get("patientId")?.toString()
            val recordId = payload?.get("recordId")?.toString()
            val medication = payload?.get("medication")?.toString()
            val appointmentId = payload?.get("appointmentId")?.toString()
            val suggestedDate = payload?.get("date")?.toString()
            val suggestedTime = payload?.get("time")?.toString()
            val action = payload?.get("action")?.toString()
            val outcome = payload?.get("outcome")?.toString()
            val createdMs = runCatching {
                java.time.Instant.parse(m.createdAt).toEpochMilli()
            }.getOrElse { System.currentTimeMillis() }
            val idx = local.indexOfFirst { it.id == m.id }
            val isNew = idx < 0
            val msg = Message(
                id = m.id,
                title = m.title,
                body = m.body,
                createdAtMs = if (isNew) createdMs else local[idx].createdAtMs,
                read = if (isNew) !m.readAt.isNullOrBlank() else local[idx].read,
                patientId = patientId,
                recordId = recordId,
                type = m.type,
                medication = medication,
                appointmentId = appointmentId,
                suggestedDate = suggestedDate,
                suggestedTime = suggestedTime,
                action = action,
                outcome = outcome,
            )
            if (isNew) {
                local.add(0, msg)
                if (m.readAt.isNullOrBlank()) {
                    ReminderNotifier.notifyInbox(context, m.title, m.body)
                }
            } else {
                local[idx] = msg
            }
            synced.add(m.id)
        }
        while (local.size > MAX) local.removeAt(local.lastIndex)
        save(context, local)
        val store = if (synced.size > 200) synced.toList().takeLast(120).toSet() else synced
        prefs.edit().putStringSet(KEY_SYNCED_SERVER_IDS, store).apply()
    }

    /**
     * Compare appointment statuses with last snapshot and notify about cancellations / accepts.
     */
    fun syncFromAppointments(context: Context, appointments: List<AppointmentDto>) {
        val prefs = prefs(context)
        val prevRaw = prefs.getString(KEY_APPT_SNAPSHOT, "{}") ?: "{}"
        val prev = try {
            JSONObject(prevRaw)
        } catch (_: Exception) {
            JSONObject()
        }
        val next = JSONObject()
        appointments.forEach { appt ->
            val status = appt.status ?: ""
            next.put(appt.id, status)
            val old = prev.optString(appt.id, "")
            if (old.isBlank()) return@forEach
            if (old.equals(status, ignoreCase = true)) return@forEach

            val pet = appt.petName.ifBlank { "tu mascota" }
            when {
                status.equals("Eliminada", true) || status.equals("Cancelada", true) -> {
                    add(
                        context,
                        "Cita cancelada",
                        "La clínica canceló la cita de $pet (${appt.date} ${appt.time}).",
                    )
                }
                old.equals("Solicitada", true) &&
                    (status.equals("Programada", true) || status.equals("Reagendada", true)) -> {
                    add(
                        context,
                        "Cita aceptada",
                        "La clínica confirmó la cita de $pet para ${appt.date} a las ${appt.time}.",
                    )
                }
                status.equals("Solicitada", true) && old.isNotBlank() -> {
                    add(
                        context,
                        "Cita en revisión",
                        "Tu propuesta de aplazamiento para $pet (${appt.date} ${appt.time}) está pendiente.",
                    )
                }
            }
        }
        val vanished = mutableListOf<String>()
        prev.keys().forEach { id ->
            if (!next.has(id)) {
                val old = prev.optString(id)
                if (!old.equals("Eliminada", true) && !old.equals("Cancelada", true)) {
                    vanished.add(id)
                }
            }
        }
        if (vanished.size == 1) {
            add(
                context,
                "Cita eliminada",
                "La clínica canceló o eliminó una cita. Revisa Correo clínico.",
            )
        } else if (vanished.size > 1) {
            add(
                context,
                "Citas actualizadas",
                "La clínica eliminó ${vanished.size} citas. Revisa Correo clínico.",
            )
        }
        prefs.edit().putString(KEY_APPT_SNAPSHOT, next.toString()).apply()
    }

    private fun save(context: Context, messages: List<Message>) {
        val arr = JSONArray()
        messages.forEach { m ->
            arr.put(
                JSONObject()
                    .put("id", m.id)
                    .put("title", m.title)
                    .put("body", m.body)
                    .put("createdAtMs", m.createdAtMs)
                    .put("read", m.read)
                    .put("patientId", m.patientId)
                    .put("recordId", m.recordId)
                    .put("type", m.type)
                    .put("medication", m.medication)
                    .put("appointmentId", m.appointmentId)
                    .put("suggestedDate", m.suggestedDate)
                    .put("suggestedTime", m.suggestedTime)
                    .put("action", m.action)
                    .put("outcome", m.outcome)
            )
        }
        prefs(context).edit().putString(KEY_MESSAGES, arr.toString()).apply()
    }
}
