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
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class HomeFragment : Fragment(), PetsSyncBus.Listener {
    private lateinit var barcodeCard: View
    private lateinit var petSummaryCard: View
    private lateinit var favoritesList: LinearLayout
    private lateinit var emptyFavoritesText: TextView
    private lateinit var emptyStateText: TextView
    private lateinit var favoritesTitle: TextView
    private lateinit var sessionManager: SessionManager

    private lateinit var summaryPetName: TextView
    private lateinit var summaryPetBreed: TextView
    private lateinit var summaryPetDetails: TextView
    private lateinit var summaryPetImage: ImageView

    private var currentPetIndex = 0
    private var linkedPets = mutableListOf<Pet>()
    private var remindersJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_home, container, false)

        sessionManager = SessionManager(requireContext())
        barcodeCard = view.findViewById(R.id.barcodeCard)
        petSummaryCard = view.findViewById(R.id.petSummaryCard)
        favoritesList = view.findViewById(R.id.favoritesList)
        emptyFavoritesText = view.findViewById(R.id.emptyFavoritesText)
        emptyStateText = view.findViewById(R.id.emptyStateText)
        favoritesTitle = view.findViewById(R.id.favoritesTitle)

        summaryPetName = view.findViewById(R.id.summaryPetName)
        summaryPetBreed = view.findViewById(R.id.summaryPetBreed)
        summaryPetDetails = view.findViewById(R.id.summaryPetDetails)
        summaryPetImage = view.findViewById(R.id.summaryPetImage)

        view.findViewById<View>(R.id.petCodeLayout).setOnClickListener {
            showAddPetDialog()
        }

        view.findViewById<View>(R.id.btnLeft).setOnClickListener {
            navigateCarousel(-1)
        }

        view.findViewById<View>(R.id.btnRight).setOnClickListener {
            navigateCarousel(1)
        }

        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        refreshPetInfo(force = false)
    }

    override fun onStart() {
        super.onStart()
        PetsSyncBus.addListener(this)
    }

    override fun onStop() {
        PetsSyncBus.removeListener(this)
        super.onStop()
    }

    override fun onPetsShouldRefresh() {
        if (isAdded) refreshPetInfo(force = PetsMemoryCache.isStale())
    }

    override fun onResume() {
        super.onResume()
        refreshPetInfo(force = false)
    }

    private fun refreshPetInfo(force: Boolean = false) {
        val cached = PetsMemoryCache.snapshot()
        if (cached != null) {
            linkedPets.clear()
            linkedPets.addAll(cached)
            updateCarouselDisplay()
        } else {
            linkedPets.clear()
            updateCarouselDisplay()
        }

        if (!force && PetsMemoryCache.shouldSkipNetwork()) {
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pets = RemotePetRepository.listMyPets(forceRefresh = force)
                sessionManager.cachePetCodes(pets.map { it.id })
                linkedPets.clear()
                linkedPets.addAll(pets)
                if (currentPetIndex >= linkedPets.size + 1) currentPetIndex = 0
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
            emptyStateText.visibility = View.VISIBLE
            emptyStateText.text = getString(R.string.empty_pets)
            favoritesTitle.visibility = View.GONE
            clearRemindersSection()
            return
        }

        emptyStateText.visibility = View.GONE
        favoritesTitle.visibility = View.VISIBLE
        if (currentPetIndex < linkedPets.size) {
            displayPetInfo(linkedPets[currentPetIndex])
        } else {
            barcodeCard.visibility = View.VISIBLE
            petSummaryCard.visibility = View.GONE
            clearRemindersSection()
            emptyFavoritesText.visibility = View.VISIBLE
            emptyFavoritesText.text = getString(R.string.empty_favorites)
        }
    }

    private fun clearRemindersSection() {
        remindersJob?.cancel()
        favoritesList.removeAllViews()
        emptyFavoritesText.visibility = View.GONE
    }

    private fun showAddPetDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_add_pet, null)
        val dialog = AlertDialog.Builder(requireContext())
            .setView(dialogView)
            .create()

        val etPetCode = dialogView.findViewById<EditText>(R.id.etPetCode)
        val btnAdd = dialogView.findViewById<Button>(R.id.btnDialogAdd)
        val btnScan = dialogView.findViewById<Button>(R.id.btnDialogScan)

        btnScan?.setOnClickListener {
            dialog.dismiss()
            startActivity(Intent(requireContext(), BarcodeScanActivity::class.java))
        }

        btnAdd.setOnClickListener {
            val code = etPetCode.text.toString().trim()
            if (code.isEmpty()) {
                Toast.makeText(requireContext(), "Introduce un código", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            btnAdd.isEnabled = false
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val message = RemotePetRepository.linkPet(code)
                    PetsSyncBus.notifyPetsChanged()
                    refreshPetInfo(force = true)
                    currentPetIndex = 0
                    dialog.dismiss()
                    Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
                } catch (e: ApiException) {
                    Toast.makeText(
                        requireContext(),
                        e.message ?: "Código no encontrado",
                        Toast.LENGTH_SHORT
                    ).show()
                } catch (_: Exception) {
                    Toast.makeText(
                        requireContext(),
                        "No se pudo vincular la mascota",
                        Toast.LENGTH_SHORT
                    ).show()
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
        favoritesTitle.visibility = View.VISIBLE

        summaryPetName.text = pet.name.uppercase()
        summaryPetBreed.text = pet.breed
        summaryPetDetails.text = formatPetDetails(pet)

        val savedUri = sessionManager.getPetImageUri(pet.id)
        if (savedUri != null) {
            try {
                summaryPetImage.setImageURI(Uri.parse(savedUri))
            } catch (_: Exception) {
                viewLifecycleOwner.lifecycleScope.launch {
                    PetImageLoader.loadInto(summaryPetImage, pet.imageUrl)
                }
            }
        } else {
            viewLifecycleOwner.lifecycleScope.launch {
                PetImageLoader.loadInto(summaryPetImage, pet.imageUrl)
            }
        }

        petSummaryCard.setOnClickListener {
            startActivity(
                Intent(requireContext(), PetDetailActivity::class.java)
                    .putExtra("PET_ID", pet.id)
                    .putExtra("PET_BACKEND_ID", pet.backendId)
            )
        }
        petSummaryCard.isClickable = true

        loadStarredReminders(pet)
    }

    private fun formatPetDetails(pet: Pet): String {
        val age = pet.age.trim().ifBlank { "—" }
        val weightRaw = pet.weight.trim().ifBlank { "—" }
        val ageLabel = when {
            age == "—" -> age
            age.contains("año", ignoreCase = true) || age.contains("mes", ignoreCase = true) ->
                age.uppercase()
            else -> "$age AÑOS"
        }
        val weightLabel = when {
            weightRaw == "—" -> weightRaw
            weightRaw.contains("kg", ignoreCase = true) -> weightRaw
            else -> "${weightRaw}kg"
        }
        return "$ageLabel - $weightLabel"
    }

    /**
     * Home shows only reminders marked with star (priority = alta) for the visible pet.
     * Star toggle lives in PetRemindersActivity and persists via API.
     */
    private fun loadStarredReminders(pet: Pet) {
        remindersJob?.cancel()
        favoritesList.removeAllViews()
        emptyFavoritesText.visibility = View.GONE

        remindersJob = viewLifecycleOwner.lifecycleScope.launch {
            try {
                val key = pet.backendId ?: pet.id
                val starred = RemotePetRepository.listReminders(key)
                    .filter { ReminderPriority.isAlta(it.priority) }
                    .take(ReminderPriority.MAX_ALTA_PER_PET)

                if (starred.isEmpty()) {
                    emptyFavoritesText.visibility = View.VISIBLE
                    emptyFavoritesText.text = getString(R.string.empty_home_reminders)
                    return@launch
                }

                emptyFavoritesText.visibility = View.GONE
                starred.forEach { rem ->
                    favoritesList.addView(
                        homeReminderCard(
                            reminder = rem,
                            pet = pet
                        )
                    )
                }
            } catch (_: Exception) {
                emptyFavoritesText.visibility = View.VISIBLE
                emptyFavoritesText.text = getString(R.string.empty_home_reminders)
            }
        }
    }

    private fun homeReminderCard(reminder: ReminderDto, pet: Pet): View {
        val v = LayoutInflater.from(requireContext()).inflate(R.layout.item_reminder, favoritesList, false)
        v.findViewById<TextView>(R.id.reminderTitle).text = reminder.title.lowercase()
        v.findViewById<TextView>(R.id.reminderDate).text = formatReminderWhen(reminder)
        v.findViewById<ImageView>(R.id.ivPriorityStar).visibility = View.GONE
        v.findViewById<ImageView>(R.id.reminderIcon).setImageResource(iconForReminder(reminder))
        val open = {
            startActivity(NewReminderActivity.intentFor(requireContext(), pet, reminder))
        }
        v.findViewById<Button>(R.id.btnDetails).setOnClickListener { open() }
        v.setOnClickListener { open() }
        return v
    }

    private fun formatReminderWhen(reminder: ReminderDto): String {
        val time = reminder.time?.trim().orEmpty()
        val date = reminder.date.trim()
        return when {
            time.isNotBlank() && looksLikeClock(time) -> time.uppercase()
            date.isNotBlank() && time.isNotBlank() -> "$date · $time"
            time.isNotBlank() -> time
            else -> date
        }
    }

    private fun looksLikeClock(value: String): Boolean =
        value.contains(":") || value.contains("AM", ignoreCase = true) ||
            value.contains("PM", ignoreCase = true)

    private fun iconForReminder(reminder: ReminderDto): Int {
        val key = listOfNotNull(reminder.type, reminder.category, reminder.title)
            .joinToString(" ")
            .lowercase()
        return when {
            key.contains("aliment") || key.contains("comida") || key.contains("food") ->
                R.drawable.ic_reminder_food
            key.contains("vacun") || key.contains("vaccine") || key.contains("inyec") ->
                R.drawable.ic_reminder_vaccine
            key.contains("cita") || key.contains("medic") || key.contains("consulta") ->
                R.drawable.ic_reminder_medical
            else -> R.drawable.ic_reminder_medical
        }
    }
}
