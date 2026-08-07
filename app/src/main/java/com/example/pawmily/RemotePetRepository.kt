package com.example.pawmily

import retrofit2.Response

object RemotePetRepository {

    suspend fun linkPet(code: String): Pet {
        val response = RetrofitClient.instance.linkPatient(LinkPatientRequest(code.trim().uppercase()))
        return unwrap(response, "Error al vincular mascota").toPet()
    }

    suspend fun listMyPets(page: Int = 1, limit: Int = 50): List<Pet> {
        val response = RetrofitClient.instance.myPatients(page, limit)
        val body = unwrap(response, "Error al cargar mascotas")
        return body.data.map { it.toPet() }
    }

    suspend fun getPet(idOrCode: String): Pet {
        val key = idOrCode.trim()
        if (key.isEmpty()) throw ApiException("Código o ID inválido")

        // UI still navigates with patient codes (PAW-xxxxxx)
        if (key.uppercase().startsWith("PAW-")) {
            return unwrap(
                RetrofitClient.instance.getPatientByCode(key.uppercase()),
                "Mascota no encontrada"
            ).toPet()
        }

        val byId = RetrofitClient.instance.getPatient(key)
        if (byId.isSuccessful && byId.body() != null) {
            return byId.body()!!.toPet()
        }

        return unwrap(
            RetrofitClient.instance.getPatientByCode(key.uppercase()),
            "Mascota no encontrada"
        ).toPet()
    }

    suspend fun unlink(id: String): Pet {
        val response = RetrofitClient.instance.unlinkPatient(id)
        return unwrap(response, "Error al desvincular mascota").toPet()
    }

    suspend fun getFeeding(patientId: String): FeedingDto? {
        val response = RetrofitClient.instance.getFeeding(patientId)
        if (response.isSuccessful) {
            return response.body()
        }
        if (response.code() == 404) return null
        throw ApiException(
            RetrofitClient.parseErrorMessage(response.errorBody()?.string())
                ?: "Error al cargar alimentación"
        )
    }

    suspend fun updateFeeding(patientId: String, body: FeedingUpdateDto): FeedingDto {
        val response = RetrofitClient.instance.updateFeeding(patientId, body)
        return unwrap(response, "Error al actualizar alimentación")
    }

    suspend fun listReminders(petId: String): List<ReminderDto> {
        val response = RetrofitClient.instance.getReminders(petId)
        return unwrap(response, "Error al cargar recordatorios")
    }

    suspend fun createReminder(petId: String, body: ReminderCreateDto): ReminderDto {
        val response = RetrofitClient.instance.createReminder(petId, body)
        return unwrap(response, "Error al crear recordatorio")
    }

    suspend fun updateReminder(id: String, body: ReminderUpdateDto): ReminderDto {
        val response = RetrofitClient.instance.updateReminder(id, body)
        return unwrap(response, "Error al actualizar recordatorio")
    }

    suspend fun completeReminder(id: String): ReminderDto {
        val response = RetrofitClient.instance.completeReminder(id)
        return unwrap(response, "Error al completar recordatorio")
    }

    suspend fun deleteReminder(id: String) {
        val response = RetrofitClient.instance.deleteReminder(id)
        if (!response.isSuccessful) {
            throw ApiException(
                RetrofitClient.parseErrorMessage(response.errorBody()?.string())
                    ?: "Error al eliminar recordatorio"
            )
        }
    }

    suspend fun listMyAppointments(page: Int = 1, limit: Int = 50): List<AppointmentDto> {
        val response = RetrofitClient.instance.myAppointments(page, limit)
        return unwrap(response, "Error al cargar citas").data
    }

    suspend fun confirmAppointment(id: String): AppointmentDto {
        val response = RetrofitClient.instance.confirmAppointment(id)
        return unwrap(response, "Error al confirmar cita")
    }

    suspend fun getMedicalRecords(patientId: String): List<MedicalRecordDto> {
        val response = RetrofitClient.instance.getMedicalRecords(patientId)
        return unwrap(response, "Error al cargar historial médico")
    }

    suspend fun getBarcode(patientId: String): BarcodeDto {
        val response = RetrofitClient.instance.getBarcode(patientId)
        return unwrap(response, "Error al cargar código de barras")
    }

    private fun <T> unwrap(response: Response<T>, fallback: String): T {
        if (response.isSuccessful) {
            val body = response.body()
            if (body != null) return body
            throw ApiException(fallback)
        }
        throw ApiException(
            RetrofitClient.parseErrorMessage(response.errorBody()?.string()) ?: fallback
        )
    }
}

class ApiException(message: String) : Exception(message)

fun PatientDto.toPet(): Pet {
    val feedingInfo = feeding?.toFeedingInfo() ?: FeedingInfo(
        recommendedAmount = "",
        totalMeals = 0,
        schedule = emptyList(),
        specialInstructions = emptyList(),
        dailyRecords = emptyList()
    )

    val history = medicalRecords?.map { record ->
        MedicalRecordWithPriority(
            date = record.date,
            type = record.status?.takeIf { it.isNotBlank() } ?: record.reason,
            doctor = record.vetName,
            reason = record.reason,
            diagnosis = record.diagnosis.orEmpty(),
            treatment = record.treatment.orEmpty()
        )
    }.orEmpty()

    val reminderList = reminders?.map { reminder ->
        Reminder(
            id = reminder.id,
            title = reminder.title,
            time = reminder.time.orEmpty(),
            date = reminder.date,
            iconType = reminder.type.orEmpty(),
            description = reminder.description,
            completed = reminder.completed == true,
            notificationMessage = reminder.notificationMessage,
            petId = reminder.petId ?: id,
            appointmentId = reminder.appointmentId
        )
    }.orEmpty()

    val family = buildList {
        if (ownerName.isNotBlank()) {
            add(FamilyMember(ownerName, ownerEmail.orEmpty()))
        }
    }

    return Pet(
        id = code.uppercase(),
        backendId = id,
        name = name,
        breed = breed,
        age = age,
        weight = weight.orEmpty(),
        species = species,
        gender = sex,
        color = color.orEmpty(),
        microchip = microchip.orEmpty(),
        owner = ownerName,
        imageUrl = photo,
        feeding = feedingInfo,
        medicalHistory = history,
        family = family,
        reminders = reminderList
    )
}

private fun FeedingDto.toFeedingInfo(): FeedingInfo {
    val meals = mealsPerDay ?: 1
    return FeedingInfo(
        recommendedAmount = recommendedAmount.orEmpty(),
        totalMeals = meals,
        schedule = parseFeedingSchedule(schedule, meals),
        specialInstructions = specialInstructions?.lines()
            ?.map { it.trim().removePrefix("-").trim() }
            ?.filter { it.isNotEmpty() }
            ?: emptyList(),
        dailyRecords = emptyList()
    )
}

private fun parseFeedingSchedule(schedule: String?, mealsPerDay: Int): List<FeedingPlate> {
    if (!schedule.isNullOrBlank()) {
        val parts = schedule.split(",", ";", "|").map { it.trim() }.filter { it.isNotEmpty() }
        if (parts.isNotEmpty()) {
            return parts.mapIndexed { index, time ->
                FeedingPlate("${index + 1}° Plato", time)
            }
        }
    }
    return (1..mealsPerDay.coerceAtLeast(1)).map { index ->
        FeedingPlate("${index}° Plato", "")
    }
}
