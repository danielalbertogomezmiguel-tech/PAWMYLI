package com.example.pawmily

import com.example.pawmily.data.LocalCacheStore
import retrofit2.Response

object RemotePetRepository {

    private const val PETS_TTL_MS = 10 * 60_000L
    private const val REMINDERS_TTL_MS = 5 * 60_000L
    private const val APPOINTMENTS_TTL_MS = 5 * 60_000L
    private const val DETAIL_TTL_MS = 5 * 60_000L

    private data class Timed<T>(val at: Long, val value: T) {
        fun fresh(ttl: Long = DETAIL_TTL_MS) = System.currentTimeMillis() - at < ttl
    }

    private val medicalCache = java.util.concurrent.ConcurrentHashMap<String, Timed<List<MedicalRecordDto>>>()
    private val feedingCache = java.util.concurrent.ConcurrentHashMap<String, Timed<FeedingDto?>>()
    private val feedingLogsCache = java.util.concurrent.ConcurrentHashMap<String, Timed<List<FeedingLogDto>>>()
    private val feedingSummaryCache = java.util.concurrent.ConcurrentHashMap<String, Timed<FeedingSummaryDto>>()

    /** Creates a pending link request; returns a human status message. */
    suspend fun linkPet(code: String): String {
        val request = requestLink(code)
        return "Solicitud enviada. Cuando la clínica la apruebe, la mascota aparecerá en tu lista."
            .let { base ->
                val roleHint = when (request.requestedRole?.uppercase()) {
                    "OWNER" -> " Espera aprobación del veterinario."
                    else -> " Espera aprobación del dueño o de la clínica."
                }
                base + roleHint
            }
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
        runCatching { listMyPets(forceRefresh = true) }
        return result
    }

    suspend fun rejectLinkRequest(id: String): LinkRequestDto {
        return unwrap(
            RetrofitClient.instance.rejectLinkRequest(id),
            "Error al rechazar solicitud"
        )
    }

    /**
     * Local-first pets list: memory → Room → API.
     * Network failures return the last local snapshot when available.
     */
    suspend fun listMyPets(page: Int = 1, limit: Int = 50, forceRefresh: Boolean = false): List<Pet> {
        if (!forceRefresh && PetsMemoryCache.isFresh(PETS_TTL_MS)) {
            PetsMemoryCache.snapshot()?.let { return it }
        }

        if (!forceRefresh) {
            runCatching { LocalCacheStore.loadPetsIntoMemory() }
            if (PetsMemoryCache.isFresh(PETS_TTL_MS)) {
                PetsMemoryCache.snapshot()?.let { return it }
            }
            val disk = runCatching { LocalCacheStore.getPets() }.getOrDefault(emptyList())
            val syncAt = runCatching { LocalCacheStore.petsSyncAt() }.getOrDefault(0L)
            if (disk.isNotEmpty() && !LocalCacheStore.isStale(syncAt, PETS_TTL_MS)) {
                PetsMemoryCache.putFromDisk(disk, syncAt)
                return disk
            }
        }

        return try {
            val response = RetrofitClient.instance.myPatients(page, limit)
            val body = unwrap(response, "Error al cargar mascotas")
            val pets = body.data.map { it.toPet() }
            runCatching { LocalCacheStore.savePets(pets) }
            PetsMemoryCache.put(pets)
            pets
        } catch (e: Exception) {
            val fallback = PetsMemoryCache.snapshot()
                ?: runCatching { LocalCacheStore.getPets() }.getOrDefault(emptyList())
            if (fallback.isNotEmpty()) {
                val syncAt = runCatching { LocalCacheStore.petsSyncAt() }
                    .getOrDefault(System.currentTimeMillis())
                PetsMemoryCache.putFromDisk(fallback, syncAt)
                return fallback
            }
            throw e
        }
    }

    suspend fun getPet(idOrCode: String, forceRefresh: Boolean = false): Pet {
        val key = idOrCode.trim()
        if (key.isEmpty()) throw ApiException("Código o ID inválido")

        val cached = PetsMemoryCache.find(key)
            ?: runCatching { LocalCacheStore.getPet(key) }.getOrNull()
        if (cached != null && !forceRefresh && PetsMemoryCache.isFresh(PETS_TTL_MS)) {
            return cached
        }

        return try {
            fetchPetRemote(key).also { mergePetIntoCache(it) }
        } catch (e: Exception) {
            cached ?: throw e
        }
    }

    private suspend fun fetchPetRemote(key: String): Pet {
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

    private suspend fun mergePetIntoCache(pet: Pet) {
        PetsMemoryCache.upsert(pet)
        val current = runCatching { LocalCacheStore.getPets() }.getOrDefault(emptyList()).toMutableList()
        val idx = current.indexOfFirst {
            it.backendId == pet.backendId || it.id.equals(pet.id, ignoreCase = true)
        }
        if (idx >= 0) current[idx] = pet else current.add(pet)
        runCatching { LocalCacheStore.savePets(current) }
    }

    suspend fun unlink(id: String): Pet {
        val response = RetrofitClient.instance.unlinkPatient(id)
        val pet = unwrap(response, "Error al desvincular mascota").toPet()
        PetsMemoryCache.invalidate()
        runCatching { listMyPets(forceRefresh = true) }
        return pet
    }

    suspend fun getFeeding(patientId: String): FeedingDto? {
        feedingCache[patientId]?.takeIf { it.fresh() }?.let { return it.value }
        val response = RetrofitClient.instance.getFeeding(patientId)
        if (response.isSuccessful) {
            val body = response.body()
            feedingCache[patientId] = Timed(System.currentTimeMillis(), body)
            return body
        }
        if (response.code() == 404) {
            feedingCache[patientId] = Timed(System.currentTimeMillis(), null)
            return null
        }
        throw ApiException(
            RetrofitClient.parseErrorMessage(response.errorBody()?.string())
                ?: "Error al cargar alimentación"
        )
    }

    suspend fun updateFeeding(patientId: String, body: FeedingUpdateDto): FeedingDto {
        val response = RetrofitClient.instance.updateFeeding(patientId, body)
        val updated = unwrap(response, "Error al actualizar alimentación")
        feedingCache.remove(patientId)
        feedingLogsCache.keys.filter { it.startsWith("$patientId|") }
            .forEach { feedingLogsCache.remove(it) }
        feedingSummaryCache.keys.filter { it.startsWith("$patientId|") }
            .forEach { feedingSummaryCache.remove(it) }
        return updated
    }

    suspend fun listFeedingLogs(
        patientId: String,
        from: String? = null,
        to: String? = null
    ): List<FeedingLogDto> {
        val cacheKey = "$patientId|$from|$to"
        feedingLogsCache[cacheKey]?.takeIf { it.fresh() }?.let { return it.value }
        val list = unwrap(
            RetrofitClient.instance.getFeedingLogs(patientId, from, to),
            "Error al cargar registros de alimentación"
        )
        feedingLogsCache[cacheKey] = Timed(System.currentTimeMillis(), list)
        return list
    }

    suspend fun getFeedingSummary(
        patientId: String,
        from: String? = null,
        to: String? = null,
        asOf: String? = null
    ): FeedingSummaryDto {
        val cacheKey = "$patientId|$from|$to|$asOf"
        feedingSummaryCache[cacheKey]?.takeIf { it.fresh() }?.let { return it.value }
        val summary = unwrap(
            RetrofitClient.instance.getFeedingSummary(patientId, from, to, asOf),
            "Error al cargar seguimiento de alimentación"
        )
        feedingSummaryCache[cacheKey] = Timed(System.currentTimeMillis(), summary)
        return summary
    }

    suspend fun markFeedingLog(patientId: String, body: FeedingLogCreateDto): FeedingLogDto {
        val result = unwrap(
            RetrofitClient.instance.createFeedingLog(patientId, body),
            "Error al registrar comida"
        )
        feedingLogsCache.keys.filter { it.startsWith("$patientId|") }
            .forEach { feedingLogsCache.remove(it) }
        feedingSummaryCache.keys.filter { it.startsWith("$patientId|") }
            .forEach { feedingSummaryCache.remove(it) }
        feedingCache.remove(patientId)
        return result
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

    suspend fun getProfile(forceRefresh: Boolean = false): UserDto {
        if (!forceRefresh) {
            val cached = runCatching { LocalCacheStore.getProfile() }.getOrNull()
            if (cached != null) return cached
        }
        return try {
            val remote = unwrap(RetrofitClient.instance.getProfile(), "Error al cargar perfil")
            runCatching { LocalCacheStore.saveProfile(remote) }
            remote
        } catch (e: Exception) {
            runCatching { LocalCacheStore.getProfile() }.getOrNull() ?: throw e
        }
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

    suspend fun listReminders(
        petId: String,
        forceRefresh: Boolean = false,
    ): List<ReminderDto> {
        if (!forceRefresh) {
            val syncAt = runCatching { LocalCacheStore.remindersSyncAt(petId) }.getOrDefault(0L)
            val cached = runCatching { LocalCacheStore.getReminders(petId) }.getOrDefault(emptyList())
            if (!LocalCacheStore.isStale(syncAt, REMINDERS_TTL_MS)) {
                return cached
            }
        }
        return try {
            val response = RetrofitClient.instance.getReminders(petId)
            val list = unwrap(response, "Error al cargar recordatorios")
                .filterNot { ReminderVisibility.isAppointment(it) }
            runCatching { LocalCacheStore.saveReminders(petId, list) }
            list
        } catch (e: Exception) {
            val fallback = runCatching { LocalCacheStore.getReminders(petId) }.getOrDefault(emptyList())
            if (fallback.isNotEmpty()) return fallback
            throw e
        }
    }

    suspend fun createReminder(petId: String, body: ReminderCreateDto): ReminderDto {
        val response = RetrofitClient.instance.createReminder(petId, body)
        val created = unwrap(response, "Error al crear recordatorio")
        runCatching { listReminders(petId, forceRefresh = true) }
        return created
    }

    suspend fun updateReminder(id: String, body: ReminderUpdateDto): ReminderDto {
        val response = RetrofitClient.instance.updateReminder(id, body)
        val updated = unwrap(response, "Error al actualizar recordatorio")
        updated.petId?.let { petId ->
            runCatching { listReminders(petId, forceRefresh = true) }
        }
        return updated
    }

    suspend fun completeReminder(id: String): ReminderDto {
        val response = RetrofitClient.instance.completeReminder(id)
        val updated = unwrap(response, "Error al completar recordatorio")
        updated.petId?.let { petId ->
            runCatching { listReminders(petId, forceRefresh = true) }
        }
        return updated
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

    suspend fun listMyAppointments(
        page: Int = 1,
        limit: Int = 50,
        forceRefresh: Boolean = false,
    ): List<AppointmentDto> {
        fun activeOnly(list: List<AppointmentDto>) = list.filterNot {
            it.status.equals("Eliminada", ignoreCase = true) ||
                it.status.equals("Cancelada", ignoreCase = true)
        }
        if (!forceRefresh) {
            val syncAt = runCatching { LocalCacheStore.appointmentsSyncAt() }.getOrDefault(0L)
            val cached = activeOnly(
                runCatching { LocalCacheStore.getAppointments() }.getOrDefault(emptyList())
            )
            if (!LocalCacheStore.isStale(syncAt, APPOINTMENTS_TTL_MS)) {
                return cached
            }
        }
        return try {
            val response = RetrofitClient.instance.myAppointments(page, limit)
            val list = activeOnly(unwrap(response, "Error al cargar citas").data)
            runCatching { LocalCacheStore.saveAppointments(list) }
            list
        } catch (e: Exception) {
            val fallback = activeOnly(
                runCatching { LocalCacheStore.getAppointments() }.getOrDefault(emptyList())
            )
            if (fallback.isNotEmpty()) return fallback
            throw e
        }
    }

    suspend fun confirmAppointment(id: String): AppointmentDto {
        val response = RetrofitClient.instance.confirmAppointment(id)
        val result = unwrap(response, "Error al confirmar cita")
        runCatching { listMyAppointments(forceRefresh = true) }
        return result
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
        val result = unwrap(response, "Error al solicitar cita")
        runCatching { listMyAppointments(forceRefresh = true) }
        return result
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
        val result = unwrap(response, "Error al aplazar cita")
        runCatching { listMyAppointments(forceRefresh = true) }
        return result
    }

    suspend fun getMedicalRecords(patientId: String): List<MedicalRecordDto> {
        medicalCache[patientId]?.takeIf { it.fresh() }?.let { return it.value }
        val list = unwrap(
            RetrofitClient.instance.getMedicalRecords(patientId),
            "Error al cargar historial médico"
        )
        medicalCache[patientId] = Timed(System.currentTimeMillis(), list)
        return list
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

    val reminderList = reminders?.filterNot { ReminderVisibility.isAppointment(it) }?.map { reminder ->
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
