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

class RemindersFragment : Fragment() {
    private lateinit var petsListContainer: LinearLayout
    private lateinit var emptyStateText: TextView
    private lateinit var sessionManager: SessionManager

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_reminders, container, false)

        sessionManager = SessionManager(requireContext())
        petsListContainer = view.findViewById(R.id.petsListReminders)
        emptyStateText = view.findViewById(R.id.emptyStateText)

        view.findViewById<View>(R.id.addPetReminderCard).setOnClickListener {
            showAddPetDialog()
        }

        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadPets()
    }

    override fun onResume() {
        super.onResume()
        loadPets(force = false)
    }

    private fun loadPets(force: Boolean = false) {
        val addCard = petsListContainer.findViewById<View>(R.id.addPetReminderCard)
        petsListContainer.removeAllViews()
        if (addCard != null) petsListContainer.addView(addCard)
        emptyStateText.visibility = View.GONE

        if (!force && PetsMemoryCache.shouldSkipNetwork()) {
            PetsMemoryCache.snapshot()?.let { pets ->
                renderPets(pets)
            }
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pets = RemotePetRepository.listMyPets(forceRefresh = force)
                sessionManager.cachePetCodes(pets.map { it.id })
                renderPets(pets)
            } catch (e: ApiException) {
                Toast.makeText(requireContext(), e.message, Toast.LENGTH_SHORT).show()
                emptyStateText.visibility = View.VISIBLE
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "No se pudo cargar tus mascotas", Toast.LENGTH_SHORT).show()
                emptyStateText.visibility = View.VISIBLE
            }
        }
    }

    private fun renderPets(pets: List<Pet>) {
        val addCard = petsListContainer.findViewById<View>(R.id.addPetReminderCard)
        petsListContainer.removeAllViews()
        pets.forEach { addPetView(it) }
        if (addCard != null) petsListContainer.addView(addCard)
        emptyStateText.visibility = if (pets.isEmpty()) View.VISIBLE else View.GONE
        if (pets.isEmpty()) {
            emptyStateText.text = getString(R.string.empty_pets_reminders)
        }
    }

    private fun addPetView(pet: Pet) {
        val petView = LayoutInflater.from(requireContext()).inflate(R.layout.item_pet_reminder, petsListContainer, false)

        petView.findViewById<TextView>(R.id.petName).text = pet.name

        val petImage = petView.findViewById<ImageView>(R.id.petImage)
        val savedUri = sessionManager.getPetImageUri(pet.id, pet.backendId)
        if (savedUri != null) {
            try {
                petImage.setImageURI(Uri.parse(savedUri))
            } catch (_: Exception) {
                viewLifecycleOwner.lifecycleScope.launch {
                    PetImageLoader.loadInto(petImage, pet.imageUrl, cacheKey = pet.backendId ?: pet.id)
                }
            }
        } else {
            viewLifecycleOwner.lifecycleScope.launch {
                PetImageLoader.loadInto(petImage, pet.imageUrl, cacheKey = pet.backendId ?: pet.id)
            }
        }

        petView.findViewById<View>(R.id.btnGoToReminders).setOnClickListener {
            openPetReminders(pet)
        }

        petsListContainer.addView(petView)
    }

    private fun openPetReminders(pet: Pet) {
        val intent = Intent(requireContext(), PetRemindersActivity::class.java).apply {
            putExtra("PET_ID", pet.id)
            putExtra("PET_BACKEND_ID", pet.backendId)
        }
        startActivity(intent)
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
                    loadPets()
                    dialog.dismiss()
                    Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
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
}
