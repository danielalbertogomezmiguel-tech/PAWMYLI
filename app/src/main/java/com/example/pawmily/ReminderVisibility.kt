package com.example.pawmily

object ReminderVisibility {
    fun isAppointment(reminder: ReminderDto): Boolean {
        val type = reminder.type.orEmpty().equals("cita", ignoreCase = true)
        val category = reminder.category.orEmpty().equals("cita", ignoreCase = true)
        return type || category
    }

    fun isFoodOrMedication(reminder: ReminderDto): Boolean {
        val category = reminder.category.orEmpty().lowercase()
        return category == "medicamento" ||
            category == "alimento" ||
            category == "alimentacion" ||
            category == "comida"
    }
}
