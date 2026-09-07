package com.example.pawmily

data class Pet(
    val id: String,
    val backendId: String? = null,
    val name: String,
    val breed: String,
    val age: String,
    val weight: String,
    val previousWeight: String? = null,
    val species: String,
    val gender: String,
    val color: String,
    val microchip: String,
    val owner: String,
    val imageUrl: String? = null,
    val feeding: FeedingInfo,
    val medicalHistory: List<MedicalRecord>,
    val reminders: List<Reminder>,
    val accessRole: String? = null
)

data class FeedingInfo(
    val recommendedAmount: String,
    val totalMeals: Int,
    val schedule: List<FeedingPlate>,
    val specialInstructions: List<String>,
    val dailyRecords: List<FeedingRecord>
)

data class FeedingRecord(
    val date: String,
    val meals: List<MealStatus>,
    var isPriority: Boolean = false
)

data class MealStatus(
    val plateName: String,
    val time: String,
    var isFed: Boolean? = null // null = pending, true = check, false = X
)

data class FeedingPlate(val name: String, val time: String)

open class MedicalRecord(
    open val date: String,
    open val type: String,
    open val doctor: String,
    open val reason: String,
    open val diagnosis: String,
    open val treatment: String
)

open class MedicalRecordWithPriority(
    date: String, type: String, doctor: String, reason: String, diagnosis: String, treatment: String,
    var isPriority: Boolean = false
) : MedicalRecord(date, type, doctor, reason, diagnosis, treatment)

data class Reminder(
    val id: String? = null,
    val title: String,
    val time: String,
    val date: String,
    val iconType: String,
    var isPriority: Boolean = false,
    val description: String? = null,
    val completed: Boolean = false,
    val notificationMessage: String? = null,
    val petId: String? = null,
    val appointmentId: String? = null
)
