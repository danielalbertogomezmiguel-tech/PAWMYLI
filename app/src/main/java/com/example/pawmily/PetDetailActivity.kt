package com.example.pawmily

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.example.pawmily.databinding.ActivityPetDetailBinding
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.launch

class PetDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPetDetailBinding
    private lateinit var sessionManager: SessionManager
    private var petCode: String? = null
    private var petBackendId: String? = null
    private var loadedPet: Pet? = null

    private val selectImageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val imageUri: Uri? = result.data?.data
            if (imageUri != null) {
                try {
                    contentResolver.takePersistableUriPermission(
                        imageUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                    )
                    binding.detailPetImage.setImageURI(imageUri)
                    petCode?.let { sessionManager.savePetImageUri(it, imageUri.toString()) }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPetDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        ImmersiveMode.applyAfterContent(this)
        KeyboardDismissHelper.attach(this, binding.root)

        sessionManager = SessionManager(this)
        petCode = intent.getStringExtra("PET_ID") ?: sessionManager.getPetCode()
        petBackendId = intent.getStringExtra("PET_BACKEND_ID")


        binding.btnBack.setOnClickListener { finish() }

        binding.detailPetImage.setOnClickListener {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }
            selectImageLauncher.launch(intent)
        }

        val code = petCode
        if (code.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_load_pet_detail, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val adapter = PetDetailPagerAdapter(this, code)
        binding.viewPager.adapter = adapter
        val tabTitles = listOf("Resumen", "Historial", "Alimentación")
        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = tabTitles[position]
        }.attach()

        loadPetHeader(code)
    }

    private fun loadPetHeader(code: String) {
        lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(code)
                loadedPet = pet
                petCode = pet.id
                petBackendId = pet.backendId
                bindHeader(pet)
            } catch (e: Exception) {
                Toast.makeText(
                    this@PetDetailActivity,
                    e.message ?: getString(R.string.error_load_pet_detail),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun bindHeader(pet: Pet) {
        binding.detailPetName.text = pet.name
        binding.detailPetBreed.text = pet.breed

        val savedUri = sessionManager.getPetImageUri(pet.id)
        if (savedUri != null) {
            try {
                binding.detailPetImage.setImageURI(Uri.parse(savedUri))
            } catch (_: Exception) {
                lifecycleScope.launch {
                    PetImageLoader.loadInto(binding.detailPetImage, pet.imageUrl)
                }
            }
        } else {
            lifecycleScope.launch {
                PetImageLoader.loadInto(binding.detailPetImage, pet.imageUrl)
            }
        }
    }

    class PetDetailPagerAdapter(
        activity: AppCompatActivity,
        private val petCode: String
    ) : FragmentStateAdapter(activity) {
        override fun getItemCount(): Int = 3
        override fun createFragment(position: Int): Fragment {
            return when (position) {
                0 -> SummaryFragment.newInstance(petCode)
                1 -> HistoryFragment.newInstance(petCode)
                else -> FeedingFragment.newInstance(petCode)
            }
        }
    }
}

class SummaryFragment : Fragment(R.layout.fragment_pet_summary) {
    companion object {
        private const val ARG_PET_CODE = "pet_code"
        fun newInstance(petCode: String) = SummaryFragment().apply {
            arguments = Bundle().apply { putString(ARG_PET_CODE, petCode) }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val petCode = arguments?.getString(ARG_PET_CODE).orEmpty()
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(petCode)
                bindSummary(view, pet)
                loadBarcode(view, pet)
                loadNextAppointment(view, pet)
            } catch (e: Exception) {
                Toast.makeText(
                    requireContext(),
                    e.message ?: getString(R.string.error_load_pet_detail),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun bindSummary(view: View, pet: Pet) {
        view.findViewById<TextView>(R.id.tvSpecies).text = "Especie: ${pet.species.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvBreed).text = "Raza: ${pet.breed.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvGender).text = "Género: ${pet.gender.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvAge).text = "Edad: ${pet.age.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvColor).text = "Color: ${pet.color.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvMicrochip).text = "Microchip: ${pet.microchip.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvOwner).text = "Propietario: ${pet.owner.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvCurrentWeight).text =
            "Peso actual: ${pet.weight.ifBlank { "—" }}"
        view.findViewById<TextView>(R.id.tvPreviousWeight).text =
            pet.previousWeight?.takeIf { it.isNotBlank() }?.let { "Peso anterior: $it" }.orEmpty()
        view.findViewById<TextView>(R.id.tvPetCode).text = pet.id
        view.findViewById<TextView>(R.id.tvNextAppointment).text =
            getString(R.string.no_next_appointment)
    }

    private suspend fun loadNextAppointment(view: View, pet: Pet) {
        val tv = view.findViewById<TextView>(R.id.tvNextAppointment) ?: return
        try {
            val next = RemotePetRepository.listMyAppointments()
                .filter { appt ->
                    appt.patientId == pet.backendId ||
                        appt.petName.equals(pet.name, ignoreCase = true)
                }
                .filterNot {
                    val s = it.status.orEmpty()
                    s.equals("Eliminada", true) ||
                        s.equals("Cancelada", true) ||
                        s.equals("Completada", true) ||
                        s.equals("No asistió", true)
                }
                .sortedBy { "${it.date} ${it.time}" }
                .firstOrNull()
            tv.text = if (next == null) {
                getString(R.string.no_next_appointment)
            } else {
                getString(
                    R.string.next_appointment_line,
                    next.date,
                    next.time,
                    next.status ?: "—"
                )
            }
        } catch (_: Exception) {
            tv.text = getString(R.string.no_next_appointment)
        }
    }

    private suspend fun loadBarcode(view: View, pet: Pet) {
        val iv = view.findViewById<ImageView>(R.id.ivPetBarcode) ?: return
        val patientId = pet.backendId ?: return
        try {
            val barcode = RemotePetRepository.getBarcode(patientId)
            val payload = barcode.code?.takeIf { it.isNotBlank() } ?: pet.id
            val bmp = BarcodeBitmap.code128(payload)
            if (bmp != null) iv.setImageBitmap(bmp)
        } catch (_: Exception) {
            runCatching {
                BarcodeBitmap.code128(pet.id)?.let { iv.setImageBitmap(it) }
            }
        }
    }

}

class HistoryFragment : Fragment(R.layout.fragment_pet_history) {
    companion object {
        private const val ARG_PET_CODE = "pet_code"
        fun newInstance(petCode: String) = HistoryFragment().apply {
            arguments = Bundle().apply { putString(ARG_PET_CODE, petCode) }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val petCode = arguments?.getString(ARG_PET_CODE).orEmpty()
        val container = view.findViewById<LinearLayout>(R.id.historyContainer) ?: return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(petCode)
                val patientId = pet.backendId ?: pet.id
                val records = try {
                    RemotePetRepository.getMedicalRecords(patientId)
                } catch (_: Exception) {
                    emptyList()
                }
                val fromPet = pet.medicalHistory
                container.removeAllViews()
                if (records.isEmpty() && fromPet.isEmpty()) {
                    val empty = TextView(requireContext()).apply {
                        text = getString(R.string.empty_medical_history)
                        setTextColor(resources.getColor(R.color.text_muted, null))
                        setPadding(0, 32, 0, 0)
                    }
                    container.addView(empty)
                    return@launch
                }

                if (records.isNotEmpty()) {
                    records.forEach { record ->
                        val typeLabel = record.type?.takeIf { it.isNotBlank() }
                            ?: record.status?.takeIf { it.isNotBlank() }
                            ?: record.reason.orEmpty()
                        val whenLabel = listOfNotNull(
                            record.date,
                            record.time?.takeIf { it.isNotBlank() }
                        ).joinToString(" · ")
                        addRecordRow(
                            container,
                            pet,
                            date = whenLabel.ifBlank { record.date.orEmpty() },
                            type = listOfNotNull(
                                record.consultationNumber,
                                typeLabel
                            ).joinToString(" · "),
                            doctor = record.vetName.orEmpty(),
                            reason = record.motivo ?: record.reason.orEmpty(),
                            diagnosis = record.diagnosis.orEmpty(),
                            treatment = record.recomendaciones
                                ?: record.treatment.orEmpty(),
                            medication = record.medication.orEmpty(),
                            observations = record.observations.orEmpty(),
                            followUp = listOfNotNull(
                                record.followUpDate,
                                record.followUpTime?.takeIf { it.isNotBlank() }
                            ).joinToString(" · "),
                            consultationNumber = record.consultationNumber.orEmpty(),
                            consultType = record.type.orEmpty()
                        )
                    }
                } else {
                    fromPet.forEach { record ->
                        addRecordRow(
                            container,
                            pet,
                            date = record.date,
                            type = record.type,
                            doctor = record.doctor,
                            reason = record.reason,
                            diagnosis = record.diagnosis,
                            treatment = record.treatment
                        )
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(
                    requireContext(),
                    e.message ?: getString(R.string.error_load_pet_detail),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun addRecordRow(
        container: LinearLayout,
        pet: Pet,
        date: String,
        type: String,
        doctor: String,
        reason: String,
        diagnosis: String,
        treatment: String,
        medication: String = "",
        observations: String = "",
        followUp: String = "",
        consultationNumber: String = "",
        consultType: String = ""
    ) {
        val row = LayoutInflater.from(requireContext())
            .inflate(R.layout.item_medical_record, container, false)
        row.findViewById<TextView>(R.id.tvRecordDate).text = date
        row.findViewById<TextView>(R.id.tvRecordType).text = type
        row.findViewById<TextView>(R.id.tvRecordDoctor).text = doctor
        row.findViewById<View>(R.id.ivReportIcon).setOnClickListener {
            val intent = Intent(requireContext(), MedicalReportActivity::class.java).apply {
                putExtra("PET_NAME", pet.name)
                putExtra("RECORD_DATE", date)
                putExtra("RECORD_DOCTOR", doctor)
                putExtra("RECORD_REASON", reason)
                putExtra("RECORD_DIAGNOSIS", diagnosis)
                putExtra("RECORD_TREATMENT", treatment)
                putExtra("RECORD_MEDICATION", medication)
                putExtra("RECORD_OBSERVATIONS", observations)
                putExtra("RECORD_FOLLOW_UP", followUp)
                putExtra("RECORD_NUMBER", consultationNumber)
                putExtra("RECORD_TYPE", consultType)
                putExtra("PET_IMAGE_URI", SessionManager(requireContext()).getPetImageUri(pet.id))
            }
            startActivity(intent)
        }
        container.addView(row)
    }
}

class FeedingFragment : Fragment(R.layout.fragment_pet_feeding) {
    companion object {
        private const val ARG_PET_CODE = "pet_code"
        fun newInstance(petCode: String) = FeedingFragment().apply {
            arguments = Bundle().apply { putString(ARG_PET_CODE, petCode) }
        }
    }

    private var patientId: String? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val petCode = arguments?.getString(ARG_PET_CODE).orEmpty()
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(petCode)
                patientId = pet.backendId ?: pet.id
                val feeding = RemotePetRepository.getFeeding(patientId!!)
                val form = view.findViewById<View>(R.id.feedingForm)
                if (form != null) {
                    FeedingFormHelper.bind(form, feeding, editable = false)
                    form.visibility = View.VISIBLE
                }
                view.findViewById<TextView>(R.id.tvEmptyFeeding)?.visibility =
                    if (feeding == null) View.VISIBLE else View.GONE

                val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                    .format(java.util.Date())
                val logs = try {
                    RemotePetRepository.listFeedingLogs(patientId!!, today, today)
                } catch (_: Exception) {
                    emptyList()
                }
                renderMealsToday(view, feeding, logs, today)
            } catch (e: Exception) {
                Toast.makeText(
                    requireContext(),
                    e.message ?: getString(R.string.error_load_pet_detail),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun renderMealsToday(
        view: View,
        feeding: FeedingDto?,
        logs: List<FeedingLogDto>,
        today: String
    ) {
        val title = view.findViewById<TextView>(R.id.tvMealsTodayTitle)
        val mealsContainer = view.findViewById<LinearLayout>(R.id.mealsContainer) ?: return
        mealsContainer.removeAllViews()
        val meals = feeding?.meals.orEmpty()
        if (meals.isEmpty()) {
            title?.visibility = View.GONE
            return
        }
        title?.visibility = View.VISIBLE
        val byMeal = logs.associateBy { it.mealId }
        meals.sortedBy { it.sortOrder ?: 0 }.forEach { meal ->
            val mealId = meal.id ?: return@forEach
            val row = LayoutInflater.from(requireContext())
                .inflate(R.layout.item_meal_status, mealsContainer, false)
            val nameView = row.findViewById<TextView>(R.id.tvMealName)
            val timeView = row.findViewById<TextView>(R.id.tvMealTime)
            val ivYes = row.findViewById<ImageView>(R.id.ivYes)
            val ivNo = row.findViewById<ImageView>(R.id.ivNo)
            nameView?.text = meal.label?.takeIf { it.isNotBlank() } ?: "Comida"
            val status = byMeal[mealId]?.status
            val late = isMealLate(meal.time, today) && status.isNullOrBlank()
            timeView?.text = buildString {
                append(meal.time.orEmpty())
                when {
                    status.equals("EATEN", true) -> append(" · hecha")
                    status.equals("UNLOGGED", true) -> append(" · incompleta")
                    late -> append(" · atrasada")
                    else -> append(" · pendiente")
                }
            }
            applyMealIcons(ivYes, ivNo, status)
            ivYes?.setOnClickListener {
                markMeal(mealId, today, "EATEN", nameView, timeView, meal.time, ivYes, ivNo)
            }
            ivNo?.setOnClickListener {
                markMeal(mealId, today, "UNLOGGED", nameView, timeView, meal.time, ivYes, ivNo)
            }
            mealsContainer.addView(row)
        }
    }

    private fun applyMealIcons(ivYes: ImageView?, ivNo: ImageView?, status: String?) {
        val eaten = status.equals("EATEN", true)
        val missed = status.equals("UNLOGGED", true)
        ivYes?.alpha = if (eaten) 1f else 0.35f
        ivNo?.alpha = if (missed) 1f else 0.35f
    }

    private fun isMealLate(time: String?, today: String): Boolean {
        if (time.isNullOrBlank()) return false
        val todayCheck = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            .format(java.util.Date())
        if (today != todayCheck) return false
        val parts = time.split(":")
        if (parts.size < 2) return false
        val hour = parts[0].toIntOrNull() ?: return false
        val minute = parts[1].take(2).toIntOrNull() ?: return false
        val now = java.util.Calendar.getInstance()
        val mealCal = java.util.Calendar.getInstance()
        mealCal.set(java.util.Calendar.HOUR_OF_DAY, hour)
        mealCal.set(java.util.Calendar.MINUTE, minute)
        mealCal.set(java.util.Calendar.SECOND, 0)
        return now.after(mealCal)
    }

    private fun markMeal(
        mealId: String,
        today: String,
        status: String,
        nameView: TextView?,
        timeView: TextView?,
        mealTime: String?,
        ivYes: ImageView?,
        ivNo: ImageView?
    ) {
        val pid = patientId ?: return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                RemotePetRepository.markFeedingLog(
                    pid,
                    FeedingLogCreateDto(mealId = mealId, scheduledDate = today, status = status)
                )
                applyMealIcons(ivYes, ivNo, status)
                timeView?.text = buildString {
                    append(mealTime.orEmpty())
                    append(if (status == "EATEN") " · hecha" else " · incompleta")
                }
                Toast.makeText(
                    requireContext(),
                    if (status == "EATEN") R.string.meal_marked_eaten else R.string.meal_marked_missed,
                    Toast.LENGTH_SHORT
                ).show()
            } catch (e: Exception) {
                Toast.makeText(
                    requireContext(),
                    e.message ?: getString(R.string.error_mark_meal),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
}
