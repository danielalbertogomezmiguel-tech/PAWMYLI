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

class HomeFragment : Fragment(), PetsSyncBus.Listener {
    private lateinit var barcodeCard: View
    private lateinit var petSummaryCard: View
    private lateinit var favoritesList: LinearLayout
    private lateinit var emptyFavoritesText: TextView
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
        favoritesList = view.findViewById(R.id.favoritesList)
        emptyFavoritesText = view.findViewById(R.id.emptyFavoritesText)
            ?: TextView(requireContext()).also { it.visibility = View.GONE }
        emptyStateText = view.findViewById(R.id.emptyStateText)
            ?: TextView(requireContext()).also { it.visibility = View.GONE }

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
        if (isAdded) refreshPetInfo(force = true)
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
            viewLifecycleOwner.lifecycleScope.launch {
                runCatching { loadFavorites(linkedPets) }
            }
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
                loadFavorites(pets)
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
            favoritesList.removeAllViews()
            return
        }

        emptyStateText.visibility = View.GONE
        if (currentPetIndex < linkedPets.size) {
            displayPetInfo(linkedPets[currentPetIndex])
        } else {
            barcodeCard.visibility = View.VISIBLE
            petSummaryCard.visibility = View.GONE
        }
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

        summaryPetName.text = pet.name
        summaryPetBreed.text = pet.breed
        summaryPetDetails.text = "${pet.age} - ${pet.weight}"

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

        petSummaryCard.setOnClickListener(null)
        petSummaryCard.isClickable = false
    }

    private suspend fun loadFavorites(pets: List<Pet>) {
        favoritesList.removeAllViews()
        try {
            val favorites = RemotePetRepository.listFavorites().take(3)
            if (favorites.isEmpty()) {
                showFavoritesEmpty()
                return
            }

            val remindersById = pets.flatMap { pet ->
                pet.reminders.mapNotNull { rem -> rem.id?.let { it to Pair(pet, rem) } }
            }.toMap()

            emptyFavoritesText.visibility = View.GONE
            favorites.forEach { fav ->
                when (fav.targetType.uppercase()) {
                    "REMINDER" -> {
                        val pair = remindersById[fav.targetId]
                        if (pair != null) {
                            val (pet, rem) = pair
                            favoritesList.addView(
                                favoriteCard(
                                    title = rem.title,
                                    whenText = listOfNotNull(
                                        rem.date,
                                        rem.time.takeIf { it.isNotBlank() }
                                    ).joinToString(" · "),
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
                    }
                    else -> Unit
                }
            }
            if (favoritesList.childCount == 0) showFavoritesEmpty()
        } catch (_: Exception) {
            showFavoritesEmpty()
        }
    }

    private fun showFavoritesEmpty() {
        favoritesList.removeAllViews()
        emptyFavoritesText.visibility = View.VISIBLE
        emptyFavoritesText.text = getString(R.string.empty_favorites)
    }

    private fun favoriteCard(title: String, whenText: String, onClick: () -> Unit): View {
        val v = LayoutInflater.from(requireContext()).inflate(R.layout.item_reminder, favoritesList, false)
        v.findViewById<TextView>(R.id.reminderTitle).text = title
        v.findViewById<TextView>(R.id.reminderDate).text = whenText
        v.findViewById<ImageView>(R.id.ivPriorityStar)?.visibility = View.GONE
        v.findViewById<Button>(R.id.btnDetails)?.setOnClickListener { onClick() }
        v.setOnClickListener { onClick() }
        return v
    }
}
