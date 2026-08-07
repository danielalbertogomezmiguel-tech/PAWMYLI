package com.example.pawmily

import android.view.View
import android.widget.EditText
import android.widget.TextView

object FeedingFormHelper {

    fun bind(root: View, feeding: FeedingDto?) {
        root.findViewById<EditText>(R.id.etFoodType).setText(feeding?.foodType.orEmpty())
        root.findViewById<EditText>(R.id.etBrand).setText(feeding?.brand.orEmpty())
        root.findViewById<EditText>(R.id.etQuantity).setText(feeding?.quantity.orEmpty())
        root.findViewById<EditText>(R.id.etFrequency).setText(feeding?.frequency.orEmpty())
        root.findViewById<EditText>(R.id.etSchedule).setText(feeding?.schedule.orEmpty())
        root.findViewById<EditText>(R.id.etMealsPerDay).setText((feeding?.mealsPerDay ?: 2).toString())
        root.findViewById<EditText>(R.id.etRecommendedAmount).setText(
            feeding?.recommendedAmount?.takeIf { it.isNotBlank() } ?: feeding?.quantity.orEmpty()
        )
        root.findViewById<EditText>(R.id.etRestrictions).setText(feeding?.restrictions.orEmpty())
        root.findViewById<EditText>(R.id.etAllergies).setText(feeding?.allergies.orEmpty())
        root.findViewById<EditText>(R.id.etObservations).setText(feeding?.observations.orEmpty())

        bindReadOnly(root.findViewById(R.id.labelVetNotes), root.findViewById(R.id.tvVetNotes), feeding?.vetNotes)
        bindReadOnly(
            root.findViewById(R.id.labelVetRecommendations),
            root.findViewById(R.id.tvVetRecommendations),
            feeding?.vetRecommendations
        )
    }

    fun collect(root: View): FeedingUpdateDto {
        val recommended = root.findViewById<EditText>(R.id.etRecommendedAmount).text.toString().trim()
            .ifBlank { root.findViewById<EditText>(R.id.etQuantity).text.toString().trim() }
            .ifBlank { "Por definir" }
        val meals = root.findViewById<EditText>(R.id.etMealsPerDay).text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 2

        return FeedingUpdateDto(
            recommendedAmount = recommended,
            mealsPerDay = meals,
            specialInstructions = null,
            schedule = root.findViewById<EditText>(R.id.etSchedule).text.toString().trim().ifBlank { null },
            foodType = root.findViewById<EditText>(R.id.etFoodType).text.toString().trim().ifBlank { null },
            brand = root.findViewById<EditText>(R.id.etBrand).text.toString().trim().ifBlank { null },
            quantity = root.findViewById<EditText>(R.id.etQuantity).text.toString().trim().ifBlank { null },
            frequency = root.findViewById<EditText>(R.id.etFrequency).text.toString().trim().ifBlank { null },
            restrictions = root.findViewById<EditText>(R.id.etRestrictions).text.toString().trim().ifBlank { null },
            allergies = root.findViewById<EditText>(R.id.etAllergies).text.toString().trim().ifBlank { null },
            observations = root.findViewById<EditText>(R.id.etObservations).text.toString().trim().ifBlank { null }
        )
    }

    private fun bindReadOnly(label: TextView, value: TextView, text: String?) {
        if (text.isNullOrBlank()) {
            label.visibility = View.GONE
            value.visibility = View.GONE
        } else {
            label.visibility = View.VISIBLE
            value.visibility = View.VISIBLE
            value.text = text
        }
    }
}
