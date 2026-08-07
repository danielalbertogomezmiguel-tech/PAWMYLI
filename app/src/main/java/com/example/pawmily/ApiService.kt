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
    val user: UserDto
)

data class UserDto(
    val id: String,
    val email: String? = null,
    val name: String,
    val role: String,
    val phone: String? = null,
    val clinic: String? = null,
    val address: String? = null,
    val license: String? = null,
    val photo: String? = null
)

data class LinkPatientRequest(val code: String)

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
    val species: String,
    val breed: String,
    val age: String,
    val sex: String,
    val weight: String? = null,
    val color: String? = null,
    val microchip: String? = null,
    val ownerName: String,
    val ownerPhone: String? = null,
    val ownerEmail: String? = null,
    val photo: String? = null,
    val feeding: FeedingDto? = null,
    val medicalRecords: List<MedicalRecordDto>? = null,
    val reminders: List<ReminderDto>? = null
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
    val vetRecommendations: String? = null
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
    val id: String,
    val date: String,
    val reason: String,
    val diagnosis: String? = null,
    val treatment: String? = null,
    val vetName: String,
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
