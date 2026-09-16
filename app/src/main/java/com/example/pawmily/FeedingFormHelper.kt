package com.example.pawmily

import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView

object FeedingFormHelper {

    fun bind(root: View, feeding: FeedingDto?, editable: Boolean = false) {
        bindField(root, R.id.etFoodType, feeding?.foodType, editable)
        bindField(root, R.id.etBrand, feeding?.brand, editable)
        bindField(
            root,
            R.id.etQuantity,
            feeding?.quantity?.takeIf { it.isNotBlank() } ?: feeding?.recommendedAmount,
            editable,
        )
        bindField(
            root,
            R.id.etFrequency,
            feeding?.frequency
                ?: feeding?.mealsPerDay?.let { "$it veces/día" }
                ?: feeding?.status?.let { "Estado: $it" },
            editable,
        )
        val scheduleText = when {
            !feeding?.schedule.isNullOrBlank() -> feeding?.schedule
            !feeding?.meals.isNullOrEmpty() ->
                feeding!!.meals!!
                    .sortedBy { it.sortOrder ?: 0 }
                    .joinToString(", ") { m ->
                        listOfNotNull(m.label, m.time).joinToString(" ")
                    }
            else -> null
        }
        bindField(root, R.id.etSchedule, scheduleText, editable)
        bindField(
            root,
            R.id.etMealsPerDay,
            (feeding?.mealsPerDay ?: feeding?.meals?.size)?.toString(),
            editable,
        )
        bindField(
            root,
            R.id.etRecommendedAmount,
            feeding?.recommendedAmount?.takeIf { it.isNotBlank() } ?: feeding?.quantity,
            editable,
        )
        val restrictions = listOfNotNull(
            feeding?.restrictions?.takeIf { it.isNotBlank() },
            feeding?.forbiddenFoods?.takeIf { it.isNotBlank() }?.let { "Evitar: $it" },
        ).joinToString("\n").ifBlank { null }
        bindField(root, R.id.etRestrictions, restrictions, editable)
        bindField(
            root,
            R.id.etAllergies,
            feeding?.allergies?.takeIf { it.isNotBlank() }
                ?: feeding?.allowedFoods?.takeIf { it.isNotBlank() }?.let { "Permitidos: $it" },
            editable,
        )
        bindField(
            root,
            R.id.etObservations,
            listOfNotNull(
                feeding?.observations,
                feeding?.specialInstructions,
            ).filter { !it.isNullOrBlank() }.joinToString("\n").ifBlank { null },
            editable,
        )

        bindReadOnly(root.findViewById(R.id.labelVetNotes), root.findViewById(R.id.tvVetNotes), feeding?.vetNotes)
        bindReadOnly(
            root.findViewById(R.id.labelVetRecommendations),
            root.findViewById(R.id.tvVetRecommendations),
            feeding?.vetRecommendations,
        )
        setEditable(root, editable)
    }

    private fun bindField(root: View, editId: Int, value: String?, editable: Boolean) {
        val edit = root.findViewById<EditText>(editId) ?: return
        val text = value?.trim().orEmpty()
        edit.setText(text)
        // Hide empty optional rows for owners (read-only diet view).
        if (!editable) {
            val rowVisible = text.isNotEmpty()
            edit.visibility = if (rowVisible) View.VISIBLE else View.GONE
            // Hide preceding label TextView if it is the previous sibling conceptually —
            // walk parent and toggle label-like TextViews that sit just above this field.
            val parent = edit.parent as? ViewGroup
            if (parent != null) {
                val idx = parent.indexOfChild(edit)
                if (idx > 0) {
                    val prev = parent.getChildAt(idx - 1)
                    if (prev is TextView && prev.id == View.NO_ID) {
                        prev.visibility = if (rowVisible) View.VISIBLE else View.GONE
                    }
                }
            }
        }
    }

    /** Owners see vet diet as read-only; only vets edit via web. */
    fun setEditable(root: View, editable: Boolean) {
        fun walk(view: View) {
            if (view is EditText) {
                view.isEnabled = editable
                view.isFocusable = editable
                view.isFocusableInTouchMode = editable
                view.isCursorVisible = editable
            } else if (view is ViewGroup) {
                for (i in 0 until view.childCount) walk(view.getChildAt(i))
            }
        }
        walk(root)
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
            observations = root.findViewById<EditText>(R.id.etObservations).text.toString().trim().ifBlank { null },
        )
    }

    private fun bindReadOnly(label: TextView?, value: TextView?, text: String?) {
        if (label == null || value == null) return
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
