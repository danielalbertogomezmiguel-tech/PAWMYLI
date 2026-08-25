package com.example.pawmily

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    // Auth
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<AuthResponse>

    @POST("auth/logout")
    suspend fun logout(@Body body: LogoutRequest): Response<Map<String, Boolean>>

    @GET("auth/profile")
    suspend fun getProfile(): Response<UserDto>

    @PUT("auth/profile")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): Response<UserDto>

    // Patients
    @GET("patients/mine")
    suspend fun myPatients(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<PaginatedResponse<PatientDto>>

    @POST("patients/link")
    suspend fun linkPatient(@Body body: LinkPatientRequest): Response<PatientDto>

    @POST("patients/link-requests")
    suspend fun createLinkRequest(@Body body: LinkRequestBody): Response<LinkRequestDto>

    @GET("patients/link-requests/pending")
    suspend fun pendingLinkRequests(): Response<List<LinkRequestDto>>

    @POST("patients/link-requests/{id}/approve")
    suspend fun approveLinkRequest(@Path("id") id: String): Response<LinkRequestDto>

    @POST("patients/link-requests/{id}/reject")
    suspend fun rejectLinkRequest(@Path("id") id: String): Response<LinkRequestDto>

    @GET("patients/{id}/members")
    suspend fun patientMembers(@Path("id") id: String): Response<List<PatientMemberDto>>

    @DELETE("patients/{id}/members/{userId}")
    suspend fun revokeMember(@Path("id") id: String, @Path("userId") userId: String): Response<Unit>

    @DELETE("patients/{id}/link")
    suspend fun unlinkPatient(@Path("id") id: String): Response<PatientDto>

    @GET("patients/{id}")
    suspend fun getPatient(@Path("id") id: String): Response<PatientDto>

    @GET("patients/code/{code}")
    suspend fun getPatientByCode(@Path("code") code: String): Response<PatientDto>

    @GET("patients/{id}/barcode")
    suspend fun getBarcode(@Path("id") id: String): Response<BarcodeDto>

    // Medical
    @GET("patients/{id}/medical-records")
    suspend fun getMedicalRecords(@Path("id") patientId: String): Response<List<MedicalRecordDto>>

    // Feeding
    @GET("patients/{id}/feeding")
    suspend fun getFeeding(@Path("id") patientId: String): Response<FeedingDto>

    @PUT("patients/{id}/feeding")
    suspend fun updateFeeding(
        @Path("id") patientId: String,
        @Body body: FeedingUpdateDto
    ): Response<FeedingDto>

    @GET("patients/{id}/feeding/logs")
    suspend fun getFeedingLogs(
        @Path("id") patientId: String,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null
    ): Response<List<FeedingLogDto>>

    @POST("patients/{id}/feeding/logs")
    suspend fun createFeedingLog(
        @Path("id") patientId: String,
        @Body body: FeedingLogCreateDto
    ): Response<FeedingLogDto>

    // Favorites
    @GET("favorites")
    suspend fun listFavorites(): Response<List<FavoriteDto>>

    @POST("favorites")
    suspend fun addFavorite(@Body body: FavoriteCreateDto): Response<FavoriteDto>

    @DELETE("favorites/{id}")
    suspend fun removeFavorite(@Path("id") id: String): Response<Unit>

    // Media (avatar / photo upload stubs)
    @POST("media/upload-url")
    suspend fun createMediaUploadUrl(@Body body: MediaUploadUrlRequest): Response<MediaUploadUrlResponse>

    @POST("media/confirm")
    suspend fun confirmMediaUpload(@Body body: MediaConfirmRequest): Response<MediaAssetDto>

    @GET("media/{assetId}/url")
    suspend fun getMediaUrl(@Path("assetId") assetId: String): Response<MediaUrlResponse>

    // Reminders
    @GET("patients/{id}/reminders")
    suspend fun getReminders(@Path("id") petId: String): Response<List<ReminderDto>>

    @POST("patients/{id}/reminders")
    suspend fun createReminder(
        @Path("id") petId: String,
        @Body body: ReminderCreateDto
    ): Response<ReminderDto>

    @PUT("patients/reminders/{id}")
    suspend fun updateReminder(
        @Path("id") id: String,
        @Body body: ReminderUpdateDto
    ): Response<ReminderDto>

    @POST("patients/reminders/{id}/complete")
    suspend fun completeReminder(@Path("id") id: String): Response<ReminderDto>

    @DELETE("patients/reminders/{id}")
    suspend fun deleteReminder(@Path("id") id: String): Response<Unit>

    // Appointments
    @GET("appointments/mine")
    suspend fun myAppointments(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<PaginatedResponse<AppointmentDto>>

    @POST("appointments/{id}/confirm")
    suspend fun confirmAppointment(@Path("id") id: String): Response<AppointmentDto>
}

data class LoginRequest(
    val phone: String? = null,
    val email: String? = null,
    val password: String
)

data class RegisterRequest(
    val name: String,
    val phone: String? = null,
    val email: String? = null,
    val password: String,
    val role: String = "owner"
)

data class UpdateProfileRequest(
    val name: String? = null,
    val phone: String? = null,
    val clinic: String? = null,
    val address: String? = null,
    val license: String? = null,
    val photo: String? = null,
    val password: String? = null
)

data class AuthResponse(
    val accessToken: String,
    val refreshToken: String? = null,
    val user: UserDto
)

data class RefreshRequest(val refreshToken: String)

data class LogoutRequest(val refreshToken: String? = null)

data class UserDto(
    val id: String,
    val email: String? = null,
    val name: String,
    val role: String,
    val phone: String? = null,
    val clinic: String? = null,
    val address: String? = null,
    val license: String? = null,
    val photo: String? = null,
    val photoAssetId: String? = null
)

data class LinkPatientRequest(val code: String)

data class LinkRequestBody(
    val code: String,
    val requestedRole: String? = null
)

data class LinkRequestDto(
    val id: String,
    val requesterId: String? = null,
    val patientId: String? = null,
    val requestedRole: String? = null,
    val status: String? = null,
    val patientName: String? = null,
    val patientCode: String? = null,
    val requesterName: String? = null,
    val requesterEmail: String? = null
)

data class PatientMemberDto(
    val id: String? = null,
    val userId: String? = null,
    val patientId: String? = null,
    val role: String? = null,
    val status: String? = null,
    val userName: String? = null,
    val userEmail: String? = null,
    val legacy: Boolean? = null
)

data class PageMeta(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Int = 0
)

data class PaginatedResponse<T>(
    val data: List<T> = emptyList(),
    val meta: PageMeta? = null
)

data class PatientDto(
    val id: String,
    val code: String,
    val name: String,
    val species: String? = null,
    val breed: String? = null,
    val age: String? = null,
    val sex: String? = null,
    val weight: String? = null,
    val color: String? = null,
    val microchip: String? = null,
    val ownerName: String? = null,
    val ownerPhone: String? = null,
    val ownerEmail: String? = null,
    val photo: String? = null,
    val photoUrl: String? = null,
    val barcodePayload: String? = null,
    val ownerUserId: String? = null,
    val accessRole: String? = null,
    val previousCode: String? = null,
    val feeding: FeedingDto? = null,
    val medicalRecords: List<MedicalRecordDto>? = null,
    val reminders: List<ReminderDto>? = null
)

data class FeedingMealDto(
    val id: String? = null,
    val feedingId: String? = null,
    val label: String? = null,
    val time: String? = null,
    val amount: String? = null,
    val food: String? = null,
    val notes: String? = null,
    val sortOrder: Int? = null
)

data class FeedingDto(
    val id: String? = null,
    val petId: String? = null,
    val recommendedAmount: String? = null,
    val mealsPerDay: Int? = null,
    val specialInstructions: String? = null,
    val schedule: String? = null,
    val weightKg: Double? = null,
    val caloriesPerDay: Int? = null,
    val vetNotes: String? = null,
    val foodType: String? = null,
    val brand: String? = null,
    val quantity: String? = null,
    val frequency: String? = null,
    val restrictions: String? = null,
    val allergies: String? = null,
    val observations: String? = null,
    val vetRecommendations: String? = null,
    val allowedFoods: String? = null,
    val forbiddenFoods: String? = null,
    val meals: List<FeedingMealDto>? = null
)

data class FeedingLogDto(
    val id: String? = null,
    val mealId: String? = null,
    val patientId: String? = null,
    val scheduledDate: String? = null,
    val status: String? = null,
    val loggedAt: String? = null,
    val loggedByUserId: String? = null,
    val meal: FeedingMealDto? = null
)

data class FeedingLogCreateDto(
    val mealId: String,
    val scheduledDate: String,
    val status: String
)

data class FavoriteDto(
    val id: String,
    val userId: String? = null,
    val targetType: String,
    val targetId: String,
    val createdAt: String? = null
)

data class FavoriteCreateDto(
    val targetType: String,
    val targetId: String
)

data class MediaUploadUrlRequest(
    val mimeType: String,
    val sizeBytes: Long,
    val patientId: String? = null,
    val kind: String? = null
)

data class MediaUploadUrlResponse(
    val assetId: String? = null,
    val bucket: String? = null,
    val storageKey: String? = null
)

data class MediaConfirmRequest(
    val assetId: String,
    val setAsPatientPhoto: Boolean? = null,
    val setAsUserPhoto: Boolean? = null
)

data class MediaAssetDto(
    val id: String? = null,
    val kind: String? = null,
    val mimeType: String? = null,
    val url: String? = null
)

data class MediaUrlResponse(
    val url: String? = null
)

data class FeedingUpdateDto(
    val recommendedAmount: String,
    val mealsPerDay: Int,
    val specialInstructions: String? = null,
    val schedule: String? = null,
    val weightKg: Double? = null,
    val caloriesPerDay: Int? = null,
    val vetNotes: String? = null,
    val foodType: String? = null,
    val brand: String? = null,
    val quantity: String? = null,
    val frequency: String? = null,
    val restrictions: String? = null,
    val allergies: String? = null,
    val observations: String? = null,
    val vetRecommendations: String? = null
)

data class MedicalRecordDto(
    val id: String? = null,
    val date: String? = null,
    val reason: String? = null,
    val diagnosis: String? = null,
    val treatment: String? = null,
    val vetName: String? = null,
    val status: String? = null,
    val petId: String? = null
)

data class ReminderDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val date: String,
    val time: String? = null,
    val type: String? = null,
    val category: String? = null,
    val priority: String? = null,
    val color: String? = null,
    val icon: String? = null,
    val notifyEnabled: Boolean? = null,
    val notes: String? = null,
    val recurrence: String? = null,
    val completed: Boolean? = null,
    val notificationMessage: String? = null,
    val petId: String? = null,
    val appointmentId: String? = null
)

data class ReminderCreateDto(
    val title: String,
    val description: String? = null,
    val date: String,
    val time: String? = null,
    val type: String? = null,
    val category: String? = null,
    val priority: String? = null,
    val color: String? = null,
    val icon: String? = null,
    val notifyEnabled: Boolean? = null,
    val notes: String? = null,
    val recurrence: String? = null,
    val notificationMessage: String? = null,
    val appointmentId: String? = null
)

data class ReminderUpdateDto(
    val title: String? = null,
    val description: String? = null,
    val date: String? = null,
    val time: String? = null,
    val type: String? = null,
    val category: String? = null,
    val priority: String? = null,
    val color: String? = null,
    val icon: String? = null,
    val notifyEnabled: Boolean? = null,
    val notes: String? = null,
    val recurrence: String? = null,
    val completed: Boolean? = null,
    val notificationMessage: String? = null
)

data class AppointmentDto(
    val id: String,
    val petName: String,
    val ownerName: String,
    val date: String,
    val time: String,
    val notes: String? = null,
    val status: String? = null,
    val patientId: String? = null,
    val attendanceStatus: String? = null,
    val ownerConfirmedAt: String? = null
)

data class BarcodeDto(
    val code: String? = null,
    val format: String? = null,
    val imageUrl: String? = null
)

data class ApiErrorResponse(
    val error: String? = null,
    val message: String? = null
)
