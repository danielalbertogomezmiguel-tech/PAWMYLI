package com.example.pawmily

import java.util.Calendar
import java.util.Locale

/**
 * Parses feeding meal times and decides if a plate is late.
 *
 * [java.text.SimpleDateFormat] with pattern `H:mm` is unsafe here: it accepts the
 * prefix of `8:00 PM` as 08:00, so afternoon meals look late in the morning.
 */
object MealClock {
    fun parseHourMinute(raw: String?): Pair<Int, Int>? {
        if (raw.isNullOrBlank()) return null
        var cleaned = raw.trim()
            .replace('\u00a0', ' ')
            .replace('.', ' ')
            .lowercase(Locale.ROOT)
        cleaned = cleaned
            .replace("hrs", " ")
            .replace("horas", " ")
            .replace(Regex("\\s+"), " ")
            .trim()

        val withMarker = Regex(
            """^(\d{1,2})\s*[:h]\s*(\d{2})(?:\s*:\s*\d{2})?\s*(a\s*m|p\s*m|am|pm)$"""
        ).find(cleaned)
        if (withMarker != null) {
            var hour = withMarker.groupValues[1].toIntOrNull() ?: return null
            val minute = withMarker.groupValues[2].toIntOrNull() ?: return null
            if (minute !in 0..59) return null
            val pm = withMarker.groupValues[3].contains('p')
            if (hour !in 1..12) return null
            hour = when {
                pm && hour < 12 -> hour + 12
                !pm && hour == 12 -> 0
                else -> hour
            }
            return hour to minute
        }

        val hourOnlyMarker = Regex("""^(\d{1,2})\s*(a\s*m|p\s*m|am|pm)$""").find(cleaned)
        if (hourOnlyMarker != null) {
            var hour = hourOnlyMarker.groupValues[1].toIntOrNull() ?: return null
            if (hour !in 1..12) return null
            val pm = hourOnlyMarker.groupValues[2].contains('p')
            hour = when {
                pm && hour < 12 -> hour + 12
                !pm && hour == 12 -> 0
                else -> hour
            }
            return hour to 0
        }

        val twentyFour = Regex("""^(\d{1,2})\s*[:h]\s*(\d{2})(?:\s*:\s*\d{2})?$""").find(cleaned)
        if (twentyFour != null) {
            val hour = twentyFour.groupValues[1].toIntOrNull() ?: return null
            val minute = twentyFour.groupValues[2].toIntOrNull() ?: return null
            if (hour !in 0..23 || minute !in 0..59) return null
            return hour to minute
        }
        return null
    }

    /**
     * Late only after the scheduled time has passed on the device's local [todayIso].
     * Future plates and unparseable times are never late.
     */
    fun isMealLate(
        time: String?,
        todayIso: String,
        nowMillis: Long = System.currentTimeMillis()
    ): Boolean {
        if (time.isNullOrBlank() || todayIso.isBlank()) return false
        val todayCheck = localIsoDate(nowMillis)
        if (todayIso != todayCheck) return false
        return hasTimePassed(time, nowMillis)
    }

    fun hasTimePassed(time: String?, nowMillis: Long = System.currentTimeMillis()): Boolean {
        val hm = parseHourMinute(time) ?: return false
        val now = Calendar.getInstance().apply { timeInMillis = nowMillis }
        val mealCal = Calendar.getInstance().apply {
            timeInMillis = nowMillis
            set(Calendar.HOUR_OF_DAY, hm.first)
            set(Calendar.MINUTE, hm.second)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return now.timeInMillis > mealCal.timeInMillis
    }

    fun localIsoDate(nowMillis: Long = System.currentTimeMillis()): String {
        val cal = Calendar.getInstance().apply { timeInMillis = nowMillis }
        return String.format(
            Locale.US,
            "%04d-%02d-%02d",
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }

    /** Monday-start week covering [todayIso]. */
    fun localWeekRange(todayIso: String = localIsoDate()): Pair<String, String> {
        val parts = todayIso.split("-")
        if (parts.size != 3) return todayIso to todayIso
        val cal = Calendar.getInstance().apply {
            set(Calendar.YEAR, parts[0].toInt())
            set(Calendar.MONTH, parts[1].toInt() - 1)
            set(Calendar.DAY_OF_MONTH, parts[2].toInt())
            set(Calendar.HOUR_OF_DAY, 12)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val day = cal.get(Calendar.DAY_OF_WEEK)
        val mondayOffset = if (day == Calendar.SUNDAY) -6 else Calendar.MONDAY - day
        cal.add(Calendar.DAY_OF_MONTH, mondayOffset)
        val from = localIsoDate(cal.timeInMillis)
        cal.add(Calendar.DAY_OF_MONTH, 6)
        val to = localIsoDate(cal.timeInMillis)
        return from to to
    }

    fun enumerateDays(fromIso: String, toIso: String): List<String> {
        val out = mutableListOf<String>()
        var cur = fromIso
        var guard = 0
        while (cur <= toIso && guard < 62) {
            out += cur
            val parts = cur.split("-")
            if (parts.size != 3) break
            val cal = Calendar.getInstance().apply {
                set(Calendar.YEAR, parts[0].toInt())
                set(Calendar.MONTH, parts[1].toInt() - 1)
                set(Calendar.DAY_OF_MONTH, parts[2].toInt())
                set(Calendar.HOUR_OF_DAY, 12)
            }
            cal.add(Calendar.DAY_OF_MONTH, 1)
            cur = localIsoDate(cal.timeInMillis)
            guard++
        }
        return out
    }

    /**
     * Weekly compliance using only meals already due (past days + today's plates
     * whose time has passed), so upcoming dinners do not pull the percent down.
     */
    fun dueCompliancePercent(
        meals: List<FeedingMealDto>,
        logs: List<FeedingLogDto>,
        fromIso: String,
        todayIso: String,
        nowMillis: Long = System.currentTimeMillis()
    ): Int {
        if (meals.isEmpty()) return 0
        val byKey = logs.associateBy { "${it.mealId}|${it.scheduledDate}" }
        var scheduled = 0
        var done = 0
        for (day in enumerateDays(fromIso, todayIso)) {
            for (meal in meals) {
                val mealId = meal.id ?: continue
                val due = day < todayIso || (day == todayIso && hasTimePassed(meal.time, nowMillis))
                if (!due) continue
                scheduled++
                val status = byKey["$mealId|$day"]?.status
                if (status.equals("EATEN", true) || status.equals("PARTIAL", true)) {
                    done++
                }
            }
        }
        if (scheduled == 0) return if (meals.isNotEmpty()) 100 else 0
        return ((done.toFloat() / scheduled) * 100).toInt().coerceIn(0, 100)
    }
}
