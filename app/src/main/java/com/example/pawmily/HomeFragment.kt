package com.example.pawmily

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {
    private lateinit var barcodeCard: View
    private lateinit var petSummaryCard: View
    private lateinit var remindersList: LinearLayout
    private lateinit var emptyStateText: TextView
    private lateinit var sessionManager: SessionManager

    private lateinit var summaryPetName: TextView
    private lateinit var summaryPetBreed: TextView
    private lateinit var summaryPetDetails: TextView
    private lateinit var summaryPetImage: ImageView

    private var currentPetIndex = 0
    private var linkedPets = mutableListOf<Pet>()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_home, container, false)

        sessionManager = SessionManager(requireContext())
        barcodeCard = view.findViewById(R.id.barcodeCard)
        petSummaryCard = view.findViewById(R.id.petSummaryCard)
        remindersList = view.findViewById(R.id.remindersList)
        emptyStateText = view.findViewById(R.id.emptyStateText)

        summaryPetName = view.findViewById(R.id.summaryPetName)
        summaryPetBreed = view.findViewById(R.id.summaryPetBreed)
        summaryPetDetails = view.findViewById(R.id.summaryPetDetails)
        summaryPetImage = view.findViewById(R.id.summaryPetImage)

        barcodeCard.setOnClickListener {
            startActivity(Intent(requireContext(), BarcodeScanActivity::class.java))
        }
        view.findViewById<View>(R.id.petCodeLayout).setOnClickListener {
            startActivity(Intent(requireContext(), BarcodeScanActivity::class.java))
        }

        view.findViewById<View>(R.id.btnLeft).setOnClickListener {
            navigateCarousel(-1)
        }

        view.findViewById<View>(R.id.btnRight).setOnClickListener {
            navigateCarousel(1)
        }

        refreshPetInfo()

        return view
    }

    override fun onResume() {
        super.onResume()
        refreshPetInfo()
    }

    private fun refreshPetInfo() {
        linkedPets.clear()
        updateCarouselDisplay()

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pets = RemotePetRepository.listMyPets()
                sessionManager.cachePetCodes(pets.map { it.id })
                linkedPets.clear()
                linkedPets.addAll(pets)
                if (currentPetIndex >= linkedPets.size + 1) {
                    currentPetIndex = 0
                }
                updateCarouselDisplay()
            } catch (e: ApiException) {
                Toast.makeText(requireContext(), e.message, Toast.LENGTH_SHORT).show()
                updateCarouselDisplay()
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "No se pudo cargar tus mascotas", Toast.LENGTH_SHORT).show()
                updateCarouselDisplay()
            }
        }
    }

    private fun navigateCarousel(direction: Int) {
        val totalItems = linkedPets.size + 1
        if (totalItems <= 0) return
        currentPetIndex = (currentPetIndex + direction + totalItems) % totalItems
        updateCarouselDisplay()
    }

    private fun updateCarouselDisplay() {
        if (linkedPets.isEmpty()) {
            barcodeCard.visibility = View.VISIBLE
            petSummaryCard.visibility = View.GONE
            remindersList.removeAllViews()
            emptyStateText.visibility = View.VISIBLE
            emptyStateText.text = getString(R.string.empty_pets)
            return
        }

        emptyStateText.visibility = View.GONE

        if (currentPetIndex < linkedPets.size) {
            val pet = linkedPets[currentPetIndex]
            displayPetInfo(pet)
        } else {
            barcodeCard.visibility = View.VISIBLE
            petSummaryCard.visibility = View.GONE
            remindersList.removeAllViews()
        }
    }

    private fun showAddPetDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_add_pet, null)
        val dialog = AlertDialog.Builder(requireContext())
            .setView(dialogView)
            .create()

        val etPetCode = dialogView.findViewById<EditText>(R.id.etPetCode)
        val btnAdd = dialogView.findViewById<Button>(R.id.btnDialogAdd)

        btnAdd.setOnClickListener {
            val code = etPetCode.text.toString().trim()
            if (code.isEmpty()) {
                Toast.makeText(requireContext(), "Introduce un código", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            btnAdd.isEnabled = false
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val pet = RemotePetRepository.linkPet(code)
                    sessionManager.savePetCode(pet.id)
                    refreshPetInfo()
                    currentPetIndex = 0
                    dialog.dismiss()
                    Toast.makeText(requireContext(), "Mascota vinculada", Toast.LENGTH_SHORT).show()
                } catch (e: ApiException) {
                    Toast.makeText(requireContext(), e.message ?: "Código no encontrado", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {
                    Toast.makeText(requireContext(), "No se pudo vincular la mascota", Toast.LENGTH_SHORT).show()
                } finally {
                    btnAdd.isEnabled = true
                }
            }
        }
        dialog.show()
    }

    private fun displayPetInfo(pet: Pet) {
        barcodeCard.visibility = View.GONE
        petSummaryCard.visibility = View.VISIBLE
        emptyStateText.visibility = View.GONE

        summaryPetName.text = pet.name
        summaryPetBreed.text = pet.breed
        summaryPetDetails.text = "${pet.age} - ${pet.weight}"

        val savedUri = sessionManager.getPetImageUri(pet.id)
        if (savedUri != null) {
            try {
                summaryPetImage.setImageURI(Uri.parse(savedUri))
            } catch (_: Exception) {
                summaryPetImage.setImageResource(android.R.drawable.ic_menu_gallery)
            }
        } else {
            summaryPetImage.setImageResource(android.R.drawable.ic_menu_gallery)
        }

        petSummaryCard.setOnClickListener {
            val intent = Intent(requireContext(), PetDetailActivity::class.java)
            intent.putExtra("PET_ID", pet.id)
            startActivity(intent)
        }

        remindersList.removeAllViews()
        val priorityItems = mutableListOf<View>()

        val today = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
        val todayRecord = pet.feeding.dailyRecords.find { it.date == today }
        if (todayRecord?.isPriority == true) {
            priorityItems.add(
                homeReminderCard(
                    title = "Alimentación",
                    whenText = todayRecord.date,
                    onClick = {
                        startActivity(
                            Intent(requireContext(), FeedingDetailActivity::class.java)
                                .putExtra("PET_CODE", pet.id)
                                .putExtra("RECORD_DATE", todayRecord.date)
                        )
                    }
                )
            )
        }

        pet.reminders.filter { it.isPriority && !it.completed }.forEach { reminder ->
            priorityItems.add(
                homeReminderCard(
                    title = reminder.title,
                    whenText = reminder.time,
                    message = reminder.notificationMessage,
                    onClick = {
                        startActivity(
                            Intent(requireContext(), PetRemindersActivity::class.java)
                                .putExtra("PET_ID", pet.id)
                                .putExtra("PET_BACKEND_ID", pet.backendId)
                        )
                    }
                )
            )
        }

        pet.medicalHistory.filter { (it as? MedicalRecordWithPriority)?.isPriority == true }.forEach { medical ->
            priorityItems.add(
                homeReminderCard(
                    title = medical.type,
                    whenText = medical.date,
                    onClick = {
                        startActivity(
                            Intent(requireContext(), MedicalReportActivity::class.java).apply {
                                putExtra("PET_NAME", pet.name)
                                putExtra("RECORD_DATE", medical.date)
                                putExtra("RECORD_DOCTOR", medical.doctor)
                                putExtra("RECORD_REASON", medical.reason)
                                putExtra("RECORD_DIAGNOSIS", medical.diagnosis)
                                putExtra("RECORD_TREATMENT", medical.treatment)
                            }
                        )
                    }
                )
            )
        }

        if (priorityItems.isEmpty()) {
            emptyStateText.visibility = View.VISIBLE
            emptyStateText.text = getString(R.string.empty_reminders)
        }

        priorityItems.take(3).forEach { remindersList.addView(it) }
    }

    private fun homeReminderCard(
        title: String,
        whenText: String,
        message: String? = null,
        onClick: () -> Unit
    ): View {
        val v = LayoutInflater.from(requireContext()).inflate(R.layout.item_reminder, remindersList, false)
        v.findViewById<TextView>(R.id.reminderTitle).text = title
        v.findViewById<TextView>(R.id.reminderDate).text = whenText
        v.findViewById<View>(R.id.reminderActions).visibility = View.GONE
        val messageView = v.findViewById<TextView>(R.id.reminderMessage)
        if (!message.isNullOrBlank()) {
            messageView.visibility = View.VISIBLE
            messageView.text = message
        }
        v.setOnClickListener { onClick() }
        return v
    }
}
