package com.example.pawmily

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar

class MealClockTest {
    private fun millis(year: Int, month: Int, day: Int, hour: Int, minute: Int): Long {
        return Calendar.getInstance().apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, month - 1)
            set(Calendar.DAY_OF_MONTH, day)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    @Test
    fun parse24hAnd12h() {
        assertEquals(8 to 0, MealClock.parseHourMinute("08:00"))
        assertEquals(16 to 0, MealClock.parseHourMinute("16:00"))
        assertEquals(8 to 0, MealClock.parseHourMinute("8:00 AM"))
        assertEquals(20 to 0, MealClock.parseHourMinute("8:00 PM"))
        assertEquals(20 to 0, MealClock.parseHourMinute("8:00 p. m."))
        assertEquals(0 to 0, MealClock.parseHourMinute("12:00 a.m."))
        assertEquals(12 to 0, MealClock.parseHourMinute("12:00 PM"))
    }

    @Test
    fun pmMealIsNotLateInTheMorning() {
        val now = millis(2026, 9, 18, 10, 0)
        assertFalse(MealClock.isMealLate("8:00 PM", "2026-09-18", now))
        assertFalse(MealClock.isMealLate("20:00", "2026-09-18", now))
        assertTrue(MealClock.isMealLate("8:00 AM", "2026-09-18", now))
        assertFalse(MealClock.isMealLate("11:00", "2026-09-18", now))
    }

    @Test
    fun duePercentIgnoresFuturePlatesToday() {
        val meals = listOf(
            FeedingMealDto(id = "m1", time = "08:00"),
            FeedingMealDto(id = "m2", time = "20:00"),
        )
        val logs = listOf(
            FeedingLogDto(mealId = "m1", scheduledDate = "2026-09-18", status = "EATEN")
        )
        val now = millis(2026, 9, 18, 10, 0)
        val percent = MealClock.dueCompliancePercent(
            meals,
            logs,
            fromIso = "2026-09-18",
            todayIso = "2026-09-18",
            nowMillis = now
        )
        assertEquals(100, percent)
    }
}
