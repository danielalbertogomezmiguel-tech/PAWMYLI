package com.example.pawmily

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.pawmily.databinding.ActivityMedicalReportBinding
import kotlinx.coroutines.launch

class MedicalReportActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMedicalReportBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMedicalReportBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener { finish() }

        val draft = MedicalReportDraft.current
        val petName = draft?.petName ?: intent.getStringExtra("PET_NAME") ?: "Mascota"
        val date = draft?.date ?: intent.getStringExtra("RECORD_DATE").orEmpty()
        val doctor = draft?.doctor ?: intent.getStringExtra("RECORD_DOCTOR").orEmpty()
        val reason = draft?.reason ?: intent.getStringExtra("RECORD_REASON").orEmpty()
        val diagnosis = draft?.diagnosis ?: intent.getStringExtra("RECORD_DIAGNOSIS").orEmpty()
        val treatment = draft?.treatment ?: intent.getStringExtra("RECORD_TREATMENT").orEmpty()
        val medication = draft?.medication ?: intent.getStringExtra("RECORD_MEDICATION").orEmpty()
        val observations = draft?.observations ?: intent.getStringExtra("RECORD_OBSERVATIONS").orEmpty()
        val followUp = draft?.followUp ?: intent.getStringExtra("RECORD_FOLLOW_UP").orEmpty()
        val number = draft?.number ?: intent.getStringExtra("RECORD_NUMBER").orEmpty()
        val type = draft?.type ?: intent.getStringExtra("RECORD_TYPE").orEmpty()
        val petId = draft?.petId ?: intent.getStringExtra("PET_ID")
        val petBackendId = draft?.petBackendId ?: intent.getStringExtra("PET_BACKEND_ID")

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

        lifecycleScope.launch {
            runCatching {
                val session = SessionManager(this@MedicalReportActivity)
                val source = session.getPetImageUri(petId, petBackendId)
                    ?: PetsMemoryCache.find(petId)?.imageUrl
                    ?: PetsMemoryCache.find(petBackendId)?.imageUrl
                if (isFinishing || isDestroyed) return@runCatching
                PetImageLoader.loadInto(
                    binding.ivPet,
                    source,
                    cacheKey = petId ?: petBackendId,
                )
            }
        }
    }
}
