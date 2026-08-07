package com.example.pawmily

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.LayoutInflater
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.google.android.material.tabs.TabLayoutMediator
import com.example.pawmily.databinding.ActivityPetDetailBinding
import kotlinx.coroutines.launch

class PetDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPetDetailBinding
    private lateinit var sessionManager: SessionManager
    private var petId: String? = null
    private var petCode: String? = null

    private val selectImageLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val imageUri: Uri? = result.data?.data
            if (imageUri != null) {
                try {
                    val contentResolver = applicationContext.contentResolver
                    val takeFlags: Int = Intent.FLAG_GRANT_READ_URI_PERMISSION
                    contentResolver.takePersistableUriPermission(imageUri, takeFlags)

                    binding.detailPetImage.setImageURI(imageUri)
                    petId?.let { sessionManager.savePetImageUri(it, imageUri.toString()) }
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

        sessionManager = SessionManager(this)

        val intentPetId = intent.getStringExtra("PET_ID")
        val sessionPetId = sessionManager.getPetCode()
        petCode = intentPetId ?: sessionPetId

        binding.btnBack.setOnClickListener { finish() }

        binding.detailPetImage.setOnClickListener {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }
            selectImageLauncher.launch(intent)
        }

        petCode?.let { code ->
            lifecycleScope.launch {
                val pet = runCatching { RemotePetRepository.getPet(code) }.getOrNull() ?: return@launch
                petId = pet.id
                binding.detailPetName.text = pet.name
                binding.detailPetBreed.text = pet.breed
                val savedUri = sessionManager.getPetImageUri(pet.id)
                if (savedUri != null) {
                    try {
                        binding.detailPetImage.setImageURI(Uri.parse(savedUri))
                    } catch (_: Exception) {
                        binding.detailPetImage.setImageResource(android.R.drawable.ic_menu_gallery)
                    }
                }
            }

            val adapter = PetDetailPagerAdapter(this, code)
            binding.viewPager.adapter = adapter

            val tabTitles = listOf("Resumen", "Historial", "Alimentación", "Familia")
            TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
                tab.text = tabTitles[position]
            }.attach()
        }
    }

    class PetDetailPagerAdapter(activity: AppCompatActivity, private val petCode: String) : FragmentStateAdapter(activity) {
        override fun getItemCount(): Int = 4
        override fun createFragment(position: Int): Fragment {
            return when (position) {
                0 -> SummaryFragment.newInstance(petCode)
                1 -> HistoryFragment.newInstance(petCode)
                2 -> FeedingFragment.newInstance(petCode)
                else -> FamilyFragment.newInstance(petCode)
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
        val petCode = arguments?.getString(ARG_PET_CODE) ?: return

        viewLifecycleOwner.lifecycleScope.launch {
            val pet = runCatching { RemotePetRepository.getPet(petCode) }.getOrNull() ?: return@launch
            view.findViewById<TextView>(R.id.tvSpecies).text = "Especie: ${pet.species}"
            view.findViewById<TextView>(R.id.tvBreed).text = "Raza: ${pet.breed}"
            view.findViewById<TextView>(R.id.tvGender).text = "Genero: ${pet.gender}"
            view.findViewById<TextView>(R.id.tvAge).text = "Edad: ${pet.age}"
            view.findViewById<TextView>(R.id.tvColor).text = "Color: ${pet.color}"
            view.findViewById<TextView>(R.id.tvMicrochip).text = "Micro Chip: ${pet.microchip}"
            view.findViewById<TextView>(R.id.tvOwner).text = "Propietario: ${pet.owner}"
            view.findViewById<TextView>(R.id.tvCurrentWeight).text = "Peso Actual: ${pet.weight}"
            view.findViewById<TextView>(R.id.tvPreviousWeight).text = "Peso Anterior: ${pet.previousWeight ?: "Sin registro"}"

            val nextDate = java.time.LocalDate.now().plusDays(14)
            val formatter = java.time.format.DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", java.util.Locale("es"))
            view.findViewById<TextView>(R.id.tvNextAppointment).text =
                nextDate.format(formatter).replaceFirstChar { it.uppercase() }
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
        val petCode = arguments?.getString(ARG_PET_CODE) ?: return
        val container = view.findViewById<LinearLayout>(R.id.historyContainer) ?: return
        container.removeAllViews()

        viewLifecycleOwner.lifecycleScope.launch {
            val pet = runCatching { RemotePetRepository.getPet(petCode) }.getOrNull() ?: return@launch
            container.removeAllViews()

            pet.medicalHistory.forEach { record ->
                val recordView = LayoutInflater.from(requireContext()).inflate(R.layout.item_medical_record, container, false)

                recordView.findViewById<TextView>(R.id.tvRecordDate).text = record.date
                recordView.findViewById<TextView>(R.id.tvRecordType).text = "Tipo de Consulta: ${record.type}"
                recordView.findViewById<TextView>(R.id.tvRecordDoctor).text = "Dr: ${record.doctor}"

                val savedUri = SessionManager(requireContext()).getPetImageUri(pet.id)

                recordView.findViewById<View>(R.id.ivReportIcon).setOnClickListener {
                    val intent = Intent(requireContext(), MedicalReportActivity::class.java).apply {
                        putExtra("PET_NAME", pet.name)
                        putExtra("PET_BREED", pet.breed)
                        putExtra("RECORD_DATE", record.date)
                        putExtra("RECORD_DOCTOR", record.doctor)
                        putExtra("RECORD_REASON", record.reason)
                        putExtra("RECORD_DIAGNOSIS", record.diagnosis)
                        putExtra("RECORD_TREATMENT", record.treatment)
                        putExtra("PET_IMAGE_URI", savedUri)
                    }
                    startActivity(intent)
                }
                container.addView(recordView)
            }
        }
    }
}

class FeedingFragment : Fragment(R.layout.fragment_pet_feeding) {
    private var petBackendId: String? = null

    companion object {
        private const val ARG_PET_CODE = "pet_code"
        fun newInstance(petCode: String) = FeedingFragment().apply {
            arguments = Bundle().apply { putString(ARG_PET_CODE, petCode) }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        view.findViewById<View>(R.id.btnSaveFeeding).setOnClickListener { saveFeeding(view) }
        loadFeeding(view)
    }

    override fun onResume() {
        super.onResume()
        view?.let { loadFeeding(it) }
    }

    private fun loadFeeding(view: View) {
        val petCode = arguments?.getString(ARG_PET_CODE) ?: return
        val formRoot = view.findViewById<View>(R.id.feedingForm)
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(petCode)
                petBackendId = pet.backendId
                val feeding = pet.backendId?.let { id ->
                    runCatching { RemotePetRepository.getFeeding(id) }.getOrNull()
                }
                view.findViewById<TextView>(R.id.tvEmptyFeeding).visibility =
                    if (feeding == null) View.VISIBLE else View.GONE
                FeedingFormHelper.bind(formRoot, feeding)
            } catch (_: Exception) {
                view.findViewById<TextView>(R.id.tvEmptyFeeding).visibility = View.VISIBLE
            }
        }
    }

    private fun saveFeeding(view: View) {
        val backendId = petBackendId
        if (backendId.isNullOrBlank()) {
            Toast.makeText(requireContext(), R.string.error_pet_id, Toast.LENGTH_SHORT).show()
            return
        }
        val btn = view.findViewById<View>(R.id.btnSaveFeeding)
        btn.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val body = FeedingFormHelper.collect(view.findViewById(R.id.feedingForm))
                RemotePetRepository.updateFeeding(backendId, body)
                view.findViewById<TextView>(R.id.tvEmptyFeeding).visibility = View.GONE
                Toast.makeText(requireContext(), R.string.feeding_saved, Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(
                    requireContext(),
                    e.message ?: getString(R.string.error_save_feeding),
                    Toast.LENGTH_LONG
                ).show()
            } finally {
                btn.isEnabled = true
            }
        }
    }
}

class FamilyFragment : Fragment(R.layout.fragment_pet_family) {
    companion object {
        private const val ARG_PET_CODE = "pet_code"
        fun newInstance(petCode: String) = FamilyFragment().apply {
            arguments = Bundle().apply { putString(ARG_PET_CODE, petCode) }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val petCode = arguments?.getString(ARG_PET_CODE) ?: return
        val container = view.findViewById<LinearLayout>(R.id.familyMembersContainer) ?: return
        container.removeAllViews()

        viewLifecycleOwner.lifecycleScope.launch {
            val pet = runCatching { RemotePetRepository.getPet(petCode) }.getOrNull() ?: return@launch
            container.removeAllViews()

            pet.family.forEach { member ->
                val memberView = LayoutInflater.from(requireContext()).inflate(R.layout.item_family_member, container, false)
                memberView.findViewById<TextView>(R.id.memberName).text = member.name
                memberView.findViewById<TextView>(R.id.memberEmail).text = member.email
                memberView.findViewById<TextView>(R.id.btnUnlink).setOnClickListener {
                    androidx.appcompat.app.AlertDialog.Builder(requireContext())
                        .setTitle("Desvincular familiar")
                        .setMessage("¿Eliminar a ${member.name} de esta mascota?")
                        .setPositiveButton("Eliminar") { _, _ ->
                            Toast.makeText(requireContext(), "${member.name} eliminado", Toast.LENGTH_SHORT).show()
                        }
                        .setNegativeButton("Cancelar", null)
                        .show()
                }
                container.addView(memberView)
            }

            view.findViewById<TextView>(R.id.tvPetCode)?.text = pet.id

            view.findViewById<Button>(R.id.btnCopyCode)?.setOnClickListener {
                val clipboard = requireContext().getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val clip = android.content.ClipData.newPlainText("Pet Code", pet.id)
                clipboard.setPrimaryClip(clip)
                Toast.makeText(requireContext(), "Código copiado", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
