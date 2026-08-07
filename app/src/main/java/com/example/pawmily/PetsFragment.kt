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

class PetsFragment : Fragment() {
    private lateinit var petsListContainer: LinearLayout
    private lateinit var emptyStateText: TextView
    private lateinit var sessionManager: SessionManager

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_pets, container, false)

        sessionManager = SessionManager(requireContext())
        petsListContainer = view.findViewById(R.id.petsListContainer)
        emptyStateText = view.findViewById(R.id.emptyStateText)

        view.findViewById<View>(R.id.addPetCard).setOnClickListener {
            showAddPetDialog()
        }

        loadPets()

        return view
    }

    override fun onResume() {
        super.onResume()
        loadPets()
    }

    private fun loadPets() {
        val addPetCard = petsListContainer.findViewById<View>(R.id.addPetCard)
        petsListContainer.removeAllViews()
        petsListContainer.addView(addPetCard)
        emptyStateText.visibility = View.GONE

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pets = RemotePetRepository.listMyPets()
                sessionManager.cachePetCodes(pets.map { it.id })

                val addCard = petsListContainer.findViewById<View>(R.id.addPetCard)
                petsListContainer.removeAllViews()
                pets.forEach { addPetView(it) }
                petsListContainer.addView(addCard)

                emptyStateText.visibility = if (pets.isEmpty()) View.VISIBLE else View.GONE
                if (pets.isEmpty()) {
                    emptyStateText.text = getString(R.string.empty_pets)
                }
            } catch (e: ApiException) {
                Toast.makeText(requireContext(), e.message, Toast.LENGTH_SHORT).show()
                emptyStateText.visibility = View.VISIBLE
                emptyStateText.text = getString(R.string.empty_pets)
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "No se pudo cargar tus mascotas", Toast.LENGTH_SHORT).show()
                emptyStateText.visibility = View.VISIBLE
                emptyStateText.text = getString(R.string.empty_pets)
            }
        }
    }

    private fun addPetView(pet: Pet) {
        val petView = LayoutInflater.from(requireContext()).inflate(R.layout.item_pet, petsListContainer, false)

        petView.findViewById<TextView>(R.id.petName).text = pet.name
        petView.findViewById<TextView>(R.id.petBreed).text = pet.breed

        val petImage = petView.findViewById<ImageView>(R.id.petImage)
        val savedUri = sessionManager.getPetImageUri(pet.id)
        if (savedUri != null) {
            try {
                petImage.setImageURI(Uri.parse(savedUri))
            } catch (_: Exception) {
                petImage.setImageResource(android.R.drawable.ic_menu_gallery)
            }
        }

        petView.setOnClickListener {
            val intent = Intent(requireContext(), PetDetailActivity::class.java)
            intent.putExtra("PET_ID", pet.id)
            startActivity(intent)
        }

        petsListContainer.addView(petView, 0)
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
                    loadPets()
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
}
