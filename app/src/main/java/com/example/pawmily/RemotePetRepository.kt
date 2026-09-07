package com.example.pawmily

import retrofit2.Response

object RemotePetRepository {

    /** Creates a pending link request; returns a human status message. */
    suspend fun linkPet(code: String): String {
        val request = requestLink(code)
        return "Solicitud enviada (${request.requestedRole ?: "pendiente"}). " +
            if (request.requestedRole == "OWNER") "Espera aprobación del veterinario."
            else "Espera aprobación del dueño."
    }

    suspend fun requestLink(code: String, requestedRole: String? = null): LinkRequestDto {
        return unwrap(
            RetrofitClient.instance.createLinkRequest(
                LinkRequestBody(code = code.trim().uppercase(), requestedRole = requestedRole)
            ),
            "Error al solicitar vinculación"
        )
    }

    suspend fun pendingLinkRequests(): List<LinkRequestDto> {
        return unwrap(
            RetrofitClient.instance.pendingLinkRequests(),
            "Error al cargar solicitudes pendientes"
        )
    }

    /**
     * Approves a link request. Caller should clear local pet cache and reload [listMyPets].
     */
    suspend fun approveLinkRequest(id: String): LinkRequestDto {
        val result = unwrap(
            RetrofitClient.instance.approveLinkRequest(id),
            "Error al aprobar solicitud"
        )
        PetsMemoryCache.invalidate()
        return result
    }

    suspend fun rejectLinkRequest(id: String): LinkRequestDto {
        return unwrap(
            RetrofitClient.instance.rejectLinkRequest(id),
            "Error al rechazar solicitud"
        )
    }

    suspend fun listMyPets(page: Int = 1, limit: Int = 50, forceRefresh: Boolean = false): List<Pet> {
        if (!forceRefresh && PetsMemoryCache.isFresh()) {
            PetsMemoryCache.snapshot()?.let { return it }
        }
        val response = RetrofitClient.instance.myPatients(page, limit)
        val body = unwrap(response, "Error al cargar mascotas")
        val pets = body.data.map { it.toPet() }
        PetsMemoryCache.put(pets)
        return pets
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

    suspend fun listFeedingLogs(
        patientId: String,
        from: String? = null,
        to: String? = null
    ): List<FeedingLogDto> {
        return unwrap(
            RetrofitClient.instance.getFeedingLogs(patientId, from, to),
            "Error al cargar registros de alimentación"
        )
    }

    suspend fun markFeedingLog(patientId: String, body: FeedingLogCreateDto): FeedingLogDto {
        return unwrap(
            RetrofitClient.instance.createFeedingLog(patientId, body),
            "Error al registrar comida"
        )
    }

    suspend fun listFavorites(): List<FavoriteDto> {
        return unwrap(RetrofitClient.instance.listFavorites(), "Error al cargar favoritos")
    }

    suspend fun addFavorite(targetType: String, targetId: String): FavoriteDto {
        return unwrap(
            RetrofitClient.instance.addFavorite(
                FavoriteCreateDto(targetType = targetType, targetId = targetId)
            ),
            "Error al agregar favorito"
        )
    }

    suspend fun removeFavorite(id: String) {
        val response = RetrofitClient.instance.removeFavorite(id)
        if (!response.isSuccessful && response.code() != 204) {
            throw ApiException(
                RetrofitClient.parseErrorMessage(response.errorBody()?.string())
                    ?: "Error al quitar favorito"
            )
        }
    }

    suspend fun getProfile(): UserDto {
        return unwrap(RetrofitClient.instance.getProfile(), "Error al cargar perfil")
    }

    /** Stub: request a signed upload URL (e.g. kind = user_avatar). */
    suspend fun createMediaUploadUrl(body: MediaUploadUrlRequest): MediaUploadUrlResponse {
        return unwrap(
            RetrofitClient.instance.createMediaUploadUrl(body),
            "Error al preparar subida de imagen"
        )
    }

    /** Stub: confirm upload and optionally set as user/patient photo. */
    suspend fun confirmMediaUpload(body: MediaConfirmRequest): MediaAssetDto {
        return unwrap(
            RetrofitClient.instance.confirmMediaUpload(body),
            "Error al confirmar imagen"
        )
    }

    suspend fun getMediaUrl(assetId: String): String? {
        return unwrap(
            RetrofitClient.instance.getMediaUrl(assetId),
            "Error al obtener URL de imagen"
        ).url
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

    suspend fun requestAppointment(
        patientId: String,
        date: String,
        time: String,
        notes: String?
    ): AppointmentDto {
        val response = RetrofitClient.instance.requestAppointment(
            AppointmentRequestDto(
                patientId = patientId,
                date = date,
                time = time,
                notes = notes
            )
        )
        return unwrap(response, "Error al solicitar cita")
    }

    suspend fun postponeAppointment(
        appointmentId: String,
        date: String,
        time: String,
        notes: String? = null
    ): AppointmentDto {
        val response = RetrofitClient.instance.postponeAppointment(
            appointmentId,
            AppointmentPostponeDto(date = date, time = time, notes = notes)
        )
        return unwrap(response, "Error al aplazar cita")
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
        val raw = response.errorBody()?.string()
        val parsed = RetrofitClient.parseErrorMessage(raw)
        val tokenish = (parsed ?: "").contains("Token", ignoreCase = true) ||
            (parsed ?: "").contains("autorizado", ignoreCase = true) ||
            response.code() == 401
        if (tokenish) {
            throw ApiException("Tu sesión expiró o no es válida. Vuelve a iniciar sesión.")
        }
        throw ApiException(parsed ?: fallback)
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
            date = record.date.orEmpty(),
            type = record.status?.takeIf { it.isNotBlank() } ?: record.reason.orEmpty(),
            doctor = record.vetName.orEmpty(),
            reason = record.reason.orEmpty(),
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
            isPriority = ReminderPriority.isAlta(reminder.priority),
            description = reminder.description,
            completed = reminder.completed == true,
            notificationMessage = reminder.notificationMessage,
            petId = reminder.petId ?: id,
            appointmentId = reminder.appointmentId
        )
    }.orEmpty()

    return Pet(
        id = code.uppercase(),
        backendId = id,
        name = name,
        breed = breed.orEmpty(),
        age = age.orEmpty(),
        weight = weight.orEmpty(),
        species = species.orEmpty(),
        gender = sex.orEmpty(),
        color = color.orEmpty(),
        microchip = microchip.orEmpty(),
        owner = ownerName.orEmpty(),
        imageUrl = listOf(photo, photoUrl)
            .firstOrNull { url ->
                !url.isNullOrBlank() &&
                    !url.startsWith("asset:") &&
                    !url.startsWith("../") &&
                    !url.startsWith("./") &&
                    (url.startsWith("http://") ||
                        url.startsWith("https://") ||
                        url.startsWith("data:") ||
                        url.startsWith("blob:"))
            },
        feeding = feedingInfo,
        medicalHistory = history,
        reminders = reminderList,
        accessRole = accessRole
    )
}

private fun FeedingDto.toFeedingInfo(): FeedingInfo {
    val mealDtos = meals.orEmpty()
    val mealsCount = mealsPerDay ?: mealDtos.size.coerceAtLeast(1)
    val plates = if (mealDtos.isNotEmpty()) {
        mealDtos.mapIndexed { index, m ->
            FeedingPlate(
                name = m.label?.takeIf { it.isNotBlank() } ?: "${index + 1}° Plato",
                time = m.time.orEmpty()
            )
        }
    } else {
        parseFeedingSchedule(this.schedule, mealsCount)
    }
    return FeedingInfo(
        recommendedAmount = recommendedAmount.orEmpty(),
        totalMeals = mealsCount,
        schedule = plates,
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
