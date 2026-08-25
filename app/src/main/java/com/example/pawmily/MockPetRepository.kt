package com.example.pawmily

object MockPetRepository {
    private val pets = mutableMapOf<String, Pet>()

    init {
        // Mascota: KAISER (Sin recordatorios, sin historial con prioridad)
        val kaiser = Pet(
            id = "KAISER",
            name = "Kaiser",
            breed = "Pastor Aleman",
            age = "9 Meses",
            weight = "30 kg",
            species = "Perro",
            gender = "Masculino",
            color = "Tricolor",
            microchip = "No",
            owner = "José Alberto Lemus MIjango",
            feeding = FeedingInfo(
                recommendedAmount = "350 gm",
                totalMeals = 2,
                schedule = listOf(
                    FeedingPlate("1° Plato", "8:00 AM"),
                    FeedingPlate("2° Plato", "6:00 PM")
                ),
                specialInstructions = listOf("No dar huesos"),
                dailyRecords = emptyList()
            ),
            medicalHistory = emptyList(),
            family = listOf(FamilyMember("Ana Lopez", "ana.lopez@gmail.com")),
            reminders = emptyList()
        )
        pets["KAISER"] = kaiser

        // Mascota: SHADOW (Con datos y recordatorios)
        val shadow = Pet(
            id = "SHADOW",
            name = "Shadow",
            breed = "Bombay",
            age = "5 AÑOS",
            weight = "5 Kg",
            species = "Gato",
            gender = "Masculino",
            color = "Negro",
            microchip = "No",
            owner = "Brittany Joyce Monge Cordero",
            feeding = FeedingInfo(
                recommendedAmount = "150 gm",
                totalMeals = 2,
                schedule = listOf(
                    FeedingPlate("1° Plato", "7:00 AM"),
                    FeedingPlate("2° Plato", "7:00 PM")
                ),
                specialInstructions = listOf("No dar leche", "Poca comida húmeda"),
                dailyRecords = listOf(
                    FeedingRecord(
                        "30/07/2026",
                        listOf(MealStatus("1° Plato", "7:00 AM", true), MealStatus("2° Plato", "7:00 PM", null)),
                        isPriority = true
                    )
                )
            ),
            medicalHistory = listOf(
                MedicalRecordWithPriority("15/04/2026", "Desparasitación", "Dr. Daniel Ozuna", "Rutina", "Sano", "Ninguno", isPriority = true),
                MedicalRecordWithPriority("10/02/2026", "Vacuna Triple", "Dr. Daniel Ozuna", "Refuerzo", "Sano", "Ninguno"),
                MedicalRecordWithPriority("01/12/2025", "Consulta General", "Dr. Daniel Ozuna", "Chequeo", "Sano", "Ninguno")
            ),
            family = listOf(FamilyMember("Brittany Joyce", "brittany@gmail.com")),
            reminders = listOf(
                Reminder(title = "Alimentacion", time = "7:00 AM", date = "Hoy", iconType = "food", isPriority = true),
                Reminder(title = "Juego", time = "6:00 PM", date = "Hoy", iconType = "play")
            )
        )
        pets["SHADOW"] = shadow

        // Mascota: SIETE
        val siete = Pet(
            id = "SIETE",
            name = "Siete",
            breed = "Aguacatero",
            age = "5 años",
            weight = "15.6 kg",
            species = "Perro",
            gender = "Masculino",
            color = "Café",
            microchip = "No",
            owner = "Daniel Alberto Gómez M",
            feeding = FeedingInfo(
                recommendedAmount = "200 gm",
                totalMeals = 2,
                schedule = listOf(
                    FeedingPlate("Mañana", "8:00 AM"),
                    FeedingPlate("Noche", "8:00 PM")
                ),
                specialInstructions = emptyList(),
                dailyRecords = emptyList()
            ),
            medicalHistory = emptyList(),
            family = emptyList(),
            reminders = listOf(
                Reminder(title = "Baño", time = "17:23", date = "2026-08-17", iconType = "bath", isPriority = true)
            )
        )
        pets["SIETE"] = siete
    }

    fun getPet(code: String): Pet? = pets[code.uppercase()]
    
    val linkedPets = mutableListOf<Pet>()
}