package com.example.pawmily

object ReminderPriority {
    const val ALTA = "alta"
    const val MEDIA = "media"
    const val MAX_ALTA_PER_PET = 3

    fun isAlta(priority: String?): Boolean =
        priority.equals(ALTA, ignoreCase = true)

    fun starGlyph(priority: String?): String =
        if (isAlta(priority)) "★" else "☆"

    fun starGlyph(isPriority: Boolean): String =
        if (isPriority) "★" else "☆"

    /** Count of other reminders with priority alta for the same pet list. */
    fun countAlta(reminders: List<ReminderDto>, excludeId: String? = null): Int =
        reminders.count { dto ->
            isAlta(dto.priority) && (excludeId == null || dto.id != excludeId)
        }

    fun canPromoteToAlta(reminders: List<ReminderDto>, reminderId: String?): Boolean {
        if (reminderId != null && reminders.any { it.id == reminderId && isAlta(it.priority) }) {
            return true
        }
        return countAlta(reminders, excludeId = reminderId) < MAX_ALTA_PER_PET
    }

    fun toggleTarget(currentPriority: String?): String =
        if (isAlta(currentPriority)) MEDIA else ALTA
}
