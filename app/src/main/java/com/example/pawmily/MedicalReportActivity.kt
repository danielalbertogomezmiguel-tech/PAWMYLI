package com.example.pawmily

import android.net.Uri
import android.os.Bundle
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
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
        val petImageUri = intent.getStringExtra("PET_IMAGE_URI")

        binding.tvReportHeader.text = "$date - $doctor"
        binding.tvPetNameReport.text = petName
        binding.tvReasonText.text = reason
        binding.tvDiagnosisText.text = diagnosis
        binding.tvTreatmentText.text = treatment

        if (petImageUri != null) {
            try {
                binding.ivPet.setImageURI(Uri.parse(petImageUri))
            } catch (_: Exception) {}
        }
    }
}
