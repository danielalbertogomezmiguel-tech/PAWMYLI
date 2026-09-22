package com.example.pawmily

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
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
                    val uriText = imageUri.toString()
                    petCode?.let { sessionManager.savePetImageUri(it, uriText) }
                    petBackendId?.let { sessionManager.savePetImageUri(it, uriText) }
                    loadedPet?.let { pet ->
                        sessionManager.savePetImageUri(pet.id, uriText)
                        pet.backendId?.let { sessionManager.savePetImageUri(it, uriText) }
                    }
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
        PetsMemoryCache.find(code)?.let { cached ->
            loadedPet = cached
            petCode = cached.id
            petBackendId = cached.backendId ?: petBackendId
            bindHeader(cached)
        }
        lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(code)
                loadedPet = pet
                petCode = pet.id
                petBackendId = pet.backendId
                bindHeader(pet)
            } catch (e: Exception) {
                if (loadedPet != null) return@launch
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

        val savedUri = sessionManager.getPetImageUri(pet.id, pet.backendId)
        if (savedUri != null) {
            try {
                binding.detailPetImage.setImageURI(Uri.parse(savedUri))
            } catch (_: Exception) {
                lifecycleScope.launch {
                    PetImageLoader.loadInto(
                        binding.detailPetImage,
                        pet.imageUrl,
                        cacheKey = pet.backendId ?: pet.id,
                    )
                }
            }
        } else {
            lifecycleScope.launch {
                PetImageLoader.loadInto(
                    binding.detailPetImage,
                    pet.imageUrl,
                    cacheKey = pet.backendId ?: pet.id,
                )
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
                    val id = pet.backendId
                    if (!id.isNullOrBlank()) appt.patientId == id
                    else false
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
        runCatching {
            BarcodeBitmap.code128(pet.id)?.let { iv.setImageBitmap(it) }
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
            try {
                MedicalReportDraft.open(
                    requireContext(),
                    MedicalReportDraft.Content(
                        petName = pet.name,
                        date = date,
                        doctor = doctor,
                        reason = reason,
                        diagnosis = diagnosis,
                        treatment = treatment,
                        medication = medication,
                        observations = observations,
                        followUp = followUp,
                        number = consultationNumber,
                        type = consultType,
                        petId = pet.id,
                        petBackendId = pet.backendId,
                    )
                )
            } catch (_: Exception) {
                Toast.makeText(
                    requireContext(),
                    getString(R.string.error_load_pet_detail),
                    Toast.LENGTH_SHORT
                ).show()
            }
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
    private var planStatus: String = "ACTIVE"
    private var rootView: View? = null
    private var currentFeeding: FeedingDto? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rootView = view
        reload()
    }

    override fun onResume() {
        super.onResume()
        if (patientId != null) reload()
    }

    private fun reload() {
        val view = rootView ?: return
        val petCode = arguments?.getString(ARG_PET_CODE).orEmpty()
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(petCode)
                patientId = pet.backendId ?: pet.id
                val feeding = RemotePetRepository.getFeeding(patientId!!)
                currentFeeding = feeding
                planStatus = feeding?.status ?: "ACTIVE"
                val form = view.findViewById<View>(R.id.feedingForm)
                if (form != null) {
                    if (feeding == null) {
                        form.visibility = View.GONE
                    } else {
                        FeedingFormHelper.bind(form, feeding, editable = false)
                        form.visibility = View.VISIBLE
                    }
                }
                view.findViewById<TextView>(R.id.tvEmptyFeeding)?.apply {
                    visibility = if (feeding == null) View.VISIBLE else View.GONE
                    if (feeding == null) text = getString(R.string.empty_feeding_owner)
                }
                view.findViewById<TextView>(R.id.tvDietReadOnly)?.apply {
                    visibility = if (feeding != null) View.VISIBLE else View.GONE
                    text = getString(R.string.diet_read_only_owner)
                }

                val today = MealClock.localIsoDate()
                val (weekFrom, _) = MealClock.localWeekRange(today)
                val logs = try {
                    RemotePetRepository.listFeedingLogs(patientId!!, weekFrom, today)
                } catch (_: Exception) {
                    emptyList()
                }
                val summary = try {
                    RemotePetRepository.getFeedingSummary(
                        patientId!!,
                        from = weekFrom,
                        to = today,
                        asOf = today
                    )
                } catch (_: Exception) {
                    null
                }
                val logsToday = logs.filter { it.scheduledDate == today }
                bindPlanHeader(view, feeding, logsToday, logs, summary, today)
                renderMealsToday(view, feeding, logsToday, today)
            } catch (e: Exception) {
                Toast.makeText(
                    requireContext(),
                    e.message ?: getString(R.string.error_load_pet_detail),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun bindPlanHeader(
        view: View,
        feeding: FeedingDto?,
        logsToday: List<FeedingLogDto>,
        weekLogs: List<FeedingLogDto>,
        summary: FeedingSummaryDto?,
        today: String
    ) {
        val card = view.findViewById<View>(R.id.cardPlanHeader) ?: return
        if (feeding == null) {
            card.visibility = View.GONE
            return
        }
        card.visibility = View.VISIBLE
        val statusTv = view.findViewById<TextView>(R.id.tvPlanStatus)
        statusTv?.text = when (feeding.status?.uppercase()) {
            "PAUSED" -> getString(R.string.feeding_plan_paused)
            "FINISHED" -> getString(R.string.feeding_plan_finished)
            else -> getString(R.string.feeding_plan_active)
        }
        val objectiveMap = mapOf(
            "control_peso" to "Control de peso",
            "mantenimiento" to "Mantenimiento",
            "crecimiento" to "Crecimiento",
            "otro" to "Otro",
        )
        val objectiveTv = view.findViewById<TextView>(R.id.tvPlanObjective)
        val obj = feeding.objective?.let { objectiveMap[it] ?: it }
        if (obj.isNullOrBlank()) {
            objectiveTv?.visibility = View.GONE
        } else {
            objectiveTv?.visibility = View.VISIBLE
            objectiveTv?.text = getString(R.string.feeding_objective, obj)
        }
        val weightsTv = view.findViewById<TextView>(R.id.tvPlanWeights)
        val current = feeding.weightKg?.let { "$it kg" } ?: "—"
        val target = feeding.targetWeightKg?.let { "$it kg" } ?: "—"
        weightsTv?.text = getString(R.string.feeding_weights, current, target)

        val meals = feeding.meals.orEmpty()
        val doneToday = logsToday.count {
            it.status.equals("EATEN", true) || it.status.equals("PARTIAL", true)
        }
        val dueToday = meals.count { MealClock.hasTimePassed(it.time) }.coerceAtLeast(0)
        val totalToday = if (dueToday > 0) dueToday else meals.size.coerceAtLeast(1)
        view.findViewById<TextView>(R.id.tvTodayProgress)?.text =
            getString(R.string.feeding_progress_today, doneToday, meals.size)
        view.findViewById<ProgressBar>(R.id.progressToday)?.apply {
            max = 100
            progress = ((doneToday.toFloat() / totalToday) * 100).toInt().coerceIn(0, 100)
        }
        val (weekFrom, _) = MealClock.localWeekRange(today)
        val localPercent = MealClock.dueCompliancePercent(meals, weekLogs, weekFrom, today)
        val apiPercent = summary?.compliance?.percent
        val percent = when {
            meals.any { !it.id.isNullOrBlank() } -> localPercent
            apiPercent != null -> apiPercent
            else -> 0
        }
        view.findViewById<TextView>(R.id.tvWeekCompliance)?.text =
            getString(R.string.feeding_week_compliance, percent)
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
        val planActive = (feeding?.status ?: "ACTIVE").equals("ACTIVE", true)
        val byMeal = logs.associateBy { it.mealId }
        meals.sortedBy { it.sortOrder ?: 0 }.forEach { meal ->
            val mealId = meal.id ?: return@forEach
            val row = LayoutInflater.from(requireContext())
                .inflate(R.layout.item_meal_status, mealsContainer, false)
            val nameView = row.findViewById<TextView>(R.id.tvMealName)
            val timeView = row.findViewById<TextView>(R.id.tvMealTime)
            val ivYes = row.findViewById<ImageView>(R.id.ivYes)
            val ivNo = row.findViewById<ImageView>(R.id.ivNo)
            nameView?.text = buildString {
                append(meal.label?.takeIf { it.isNotBlank() } ?: "Comida")
                meal.amount?.takeIf { it.isNotBlank() }?.let { append(" · $it") }
            }
            val status = byMeal[mealId]?.status
            val late = MealClock.isMealLate(meal.time, today) && status.isNullOrBlank()
            timeView?.text = buildString {
                append(meal.time.orEmpty())
                when {
                    status.equals("EATEN", true) -> append(" · hecha")
                    status.equals("PARTIAL", true) -> append(" · parcial")
                    status.equals("UNLOGGED", true) -> append(" · incompleta")
                    late -> append(" · atrasada")
                    else -> append(" · pendiente")
                }
            }
            applyMealIcons(ivYes, ivNo, status)
            val openDialog = View.OnClickListener {
                if (!planActive) {
                    Toast.makeText(requireContext(), R.string.meal_plan_not_active, Toast.LENGTH_SHORT).show()
                    return@OnClickListener
                }
                showMealDialog(mealId, today, meal.time)
            }
            ivYes?.setOnClickListener(openDialog)
            ivNo?.setOnClickListener(openDialog)
            row.setOnClickListener(openDialog)
            mealsContainer.addView(row)
        }
    }

    private fun showMealDialog(mealId: String, today: String, mealTime: String?) {
        val options = arrayOf(
            getString(R.string.meal_option_normal),
            getString(R.string.meal_option_less),
            getString(R.string.meal_option_refused),
            getString(R.string.meal_option_skipped),
        )
        androidx.appcompat.app.AlertDialog.Builder(requireContext())
            .setTitle(R.string.meal_what_happened)
            .setItems(options) { _, which ->
                val (status, reason) = when (which) {
                    0 -> "EATEN" to "NORMAL"
                    1 -> "PARTIAL" to "LESS"
                    2 -> "UNLOGGED" to "REFUSED"
                    else -> "UNLOGGED" to "SKIPPED"
                }
                if (which == 0) {
                    markMeal(mealId, today, status, reason, null)
                } else {
                    val noteInput = android.widget.EditText(requireContext()).apply {
                        hint = getString(R.string.meal_option_note_hint)
                        setPadding(48, 32, 48, 32)
                    }
                    androidx.appcompat.app.AlertDialog.Builder(requireContext())
                        .setTitle(options[which])
                        .setView(noteInput)
                        .setPositiveButton(android.R.string.ok) { _, _ ->
                            markMeal(
                                mealId,
                                today,
                                status,
                                reason,
                                noteInput.text?.toString()?.trim()
                            )
                        }
                        .setNegativeButton(android.R.string.cancel, null)
                        .show()
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun applyMealIcons(ivYes: ImageView?, ivNo: ImageView?, status: String?) {
        val eaten = status.equals("EATEN", true) || status.equals("PARTIAL", true)
        val missed = status.equals("UNLOGGED", true)
        ivYes?.alpha = if (eaten) 1f else 0.35f
        ivNo?.alpha = if (missed) 1f else 0.35f
    }

    private fun markMeal(
        mealId: String,
        today: String,
        status: String,
        reason: String?,
        notes: String?
    ) {
        val pid = patientId ?: return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                RemotePetRepository.markFeedingLog(
                    pid,
                    FeedingLogCreateDto(
                        mealId = mealId,
                        scheduledDate = today,
                        status = status,
                        reason = reason,
                        notes = notes?.ifBlank { null },
                    )
                )
                val msg = when (status) {
                    "EATEN" -> R.string.meal_marked_eaten
                    "PARTIAL" -> R.string.meal_marked_partial
                    else -> R.string.meal_marked_missed
                }
                Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                reload()
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

