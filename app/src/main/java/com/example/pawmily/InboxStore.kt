package com.example.pawmily

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Local "correo" / inbox for clinic notifications (appointment changes, requests).
 * Survives offline; no push server required for school demo.
 */
object InboxStore {
    private const val PREFS = "PawMilyInbox"
    private const val KEY_MESSAGES = "messages"
    private const val KEY_APPT_SNAPSHOT = "appt_status_snapshot"
    private const val MAX = 80

    data class Message(
        val id: String,
        val title: String,
        val body: String,
        val createdAtMs: Long,
        val read: Boolean,
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
                        )
                    )
                }
            }.sortedByDescending { it.createdAtMs }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun add(context: Context, title: String, body: String) {
        val messages = list(context).toMutableList()
        messages.add(
            0,
            Message(
                id = "msg_${System.currentTimeMillis()}_${messages.size}",
                title = title,
                body = body,
                createdAtMs = System.currentTimeMillis(),
                read = false,
            )
        )
        while (messages.size > MAX) messages.removeAt(messages.lastIndex)
        save(context, messages)
        ReminderNotifier.notifyInbox(context, title, body)
    }

    fun markAllRead(context: Context) {
        save(context, list(context).map { it.copy(read = true) })
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
        // Detect appointments that disappeared from the active list (soft-deleted filtered out).
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
            )
        }
        prefs(context).edit().putString(KEY_MESSAGES, arr.toString()).apply()
    }
}
