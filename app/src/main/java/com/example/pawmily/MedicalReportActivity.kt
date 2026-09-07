package com.example.pawmily

import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.example.pawmily.databinding.ActivityMedicalReportBinding

class MedicalReportActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMedicalReportBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMedicalReportBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener { finish() }

        val petName = intent.getStringExtra("PET_NAME") ?: "Mascota"
        val date = intent.getStringExtra("RECORD_DATE") ?: ""
        val doctor = intent.getStringExtra("RECORD_DOCTOR") ?: ""
        val reason = intent.getStringExtra("RECORD_REASON") ?: ""
        val diagnosis = intent.getStringExtra("RECORD_DIAGNOSIS") ?: ""
        val treatment = intent.getStringExtra("RECORD_TREATMENT") ?: ""
        val medication = intent.getStringExtra("RECORD_MEDICATION").orEmpty()
        val observations = intent.getStringExtra("RECORD_OBSERVATIONS").orEmpty()
        val followUp = intent.getStringExtra("RECORD_FOLLOW_UP").orEmpty()
        val number = intent.getStringExtra("RECORD_NUMBER").orEmpty()
        val type = intent.getStringExtra("RECORD_TYPE").orEmpty()
        val petImageUri = intent.getStringExtra("PET_IMAGE_URI")

        binding.tvReportHeader.text = listOf(date, doctor).filter { it.isNotBlank() }.joinToString(" - ")
        binding.tvPetNameReport.text = petName
        binding.tvReasonText.text = reason.ifBlank { "—" }
        binding.tvDiagnosisText.text = diagnosis.ifBlank { "—" }
        binding.tvTreatmentText.text = treatment.ifBlank { "—" }

        val meta = listOfNotNull(
            number.takeIf { it.isNotBlank() }?.let { "Nº $it" },
            type.takeIf { it.isNotBlank() }
        ).joinToString(" · ")
        binding.tvExtraMeta.text = meta
        binding.tvExtraMeta.visibility = if (meta.isBlank()) View.GONE else View.VISIBLE

        binding.tvMedicationText.text =
            if (medication.isBlank()) "" else getString(R.string.report_medication, medication)
        binding.tvMedicationText.visibility =
            if (medication.isBlank()) View.GONE else View.VISIBLE

        binding.tvObservationsText.text =
            if (observations.isBlank()) "" else getString(R.string.report_observations, observations)
        binding.tvObservationsText.visibility =
            if (observations.isBlank()) View.GONE else View.VISIBLE

        binding.tvFollowUpText.text =
            if (followUp.isBlank()) "" else getString(R.string.report_follow_up, followUp)
        binding.tvFollowUpText.visibility =
            if (followUp.isBlank()) View.GONE else View.VISIBLE

        if (petImageUri != null) {
            try {
                binding.ivPet.setImageURI(Uri.parse(petImageUri))
            } catch (_: Exception) {
            }
        }
    }
}
