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

class PetsFragment : Fragment(), PetsSyncBus.Listener {
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
        view.findViewById<View>(R.id.btnPendingLinks).setOnClickListener {
            showPendingLinksDialog()
        }

        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadPets()
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
        if (isAdded) loadPets(force = true)
    }

    override fun onResume() {
        super.onResume()
        loadPets(force = false)
    }

    private fun loadPets(force: Boolean = false) {
        val addPetCard = petsListContainer.findViewById<View>(R.id.addPetCard)
        petsListContainer.removeAllViews()
        petsListContainer.addView(addPetCard)
        emptyStateText.visibility = View.GONE

        val cached = PetsMemoryCache.snapshot()
        if (cached != null) {
            val addCard = petsListContainer.findViewById<View>(R.id.addPetCard)
            petsListContainer.removeAllViews()
            cached.forEach { addPetView(it) }
            petsListContainer.addView(addCard)
            emptyStateText.visibility = if (cached.isEmpty()) View.VISIBLE else View.GONE
        }

        if (!force && PetsMemoryCache.shouldSkipNetwork()) return

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pets = RemotePetRepository.listMyPets(forceRefresh = force)
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
                if (petsListContainer.childCount <= 1) {
                    emptyStateText.visibility = View.VISIBLE
                    emptyStateText.text = getString(R.string.empty_pets)
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "No se pudo cargar tus mascotas", Toast.LENGTH_SHORT).show()
                if (petsListContainer.childCount <= 1) {
                    emptyStateText.visibility = View.VISIBLE
                    emptyStateText.text = getString(R.string.empty_pets)
                }
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
                viewLifecycleOwner.lifecycleScope.launch {
                    PetImageLoader.loadInto(petImage, pet.imageUrl)
                }
            }
        } else {
            viewLifecycleOwner.lifecycleScope.launch {
                PetImageLoader.loadInto(petImage, pet.imageUrl)
            }
        }

        petView.setOnClickListener {
            val intent = Intent(requireContext(), PetDetailActivity::class.java)
            intent.putExtra("PET_ID", pet.id)
            intent.putExtra("PET_BACKEND_ID", pet.backendId)
            startActivity(intent)
        }

        petsListContainer.addView(petView, 0)
    }

    private fun showPendingLinksDialog() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val pending = RemotePetRepository.pendingLinkRequests()
                if (pending.isEmpty()) {
                    Toast.makeText(requireContext(), R.string.empty_pending_links, Toast.LENGTH_SHORT).show()
                    return@launch
                }

                val layout = LinearLayout(requireContext()).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(48, 24, 48, 8)
                }

                val dialog = AlertDialog.Builder(requireContext())
                    .setTitle(R.string.pending_link_requests)
                    .setView(layout)
                    .setNegativeButton(android.R.string.cancel, null)
                    .create()

                pending.forEach { request ->
                    val row = LinearLayout(requireContext()).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(0, 12, 0, 12)
                    }
                    val label = TextView(requireContext()).apply {
                        text = buildString {
                            append(request.requesterName ?: request.requesterEmail ?: "Usuario")
                            append(" → ")
                            append(request.patientName ?: request.patientCode ?: "Mascota")
                            if (!request.requestedRole.isNullOrBlank()) {
                                append(" (${request.requestedRole})")
                            }
                        }
                        textSize = 15f
                    }
                    val actions = LinearLayout(requireContext()).apply {
                        orientation = LinearLayout.HORIZONTAL
                    }
                    val btnApprove = Button(requireContext()).apply {
                        text = getString(R.string.btn_approve)
                        setOnClickListener {
                            isEnabled = false
                            viewLifecycleOwner.lifecycleScope.launch {
                                try {
                                    RemotePetRepository.approveLinkRequest(request.id)
                                    sessionManager.clearLinkedPetsCache()
                                    Toast.makeText(requireContext(), R.string.link_approved, Toast.LENGTH_SHORT).show()
                                    dialog.dismiss()
                                    loadPets()
                                    PetsSyncBus.notifyPetsChanged()
                                } catch (e: ApiException) {
                                    Toast.makeText(requireContext(), e.message, Toast.LENGTH_SHORT).show()
                                    isEnabled = true
                                } catch (_: Exception) {
                                    Toast.makeText(requireContext(), "Error al aprobar", Toast.LENGTH_SHORT).show()
                                    isEnabled = true
                                }
                            }
                        }
                    }
                    val btnReject = Button(requireContext()).apply {
                        text = getString(R.string.btn_reject)
                        setOnClickListener {
                            isEnabled = false
                            viewLifecycleOwner.lifecycleScope.launch {
                                try {
                                    RemotePetRepository.rejectLinkRequest(request.id)
                                    Toast.makeText(requireContext(), R.string.link_rejected, Toast.LENGTH_SHORT).show()
                                    dialog.dismiss()
                                    loadPets()
                                } catch (e: ApiException) {
                                    Toast.makeText(requireContext(), e.message, Toast.LENGTH_SHORT).show()
                                    isEnabled = true
                                } catch (_: Exception) {
                                    Toast.makeText(requireContext(), "Error al rechazar", Toast.LENGTH_SHORT).show()
                                    isEnabled = true
                                }
                            }
                        }
                    }
                    actions.addView(btnApprove)
                    actions.addView(btnReject)
                    row.addView(label)
                    row.addView(actions)
                    layout.addView(row)
                }

                dialog.show()
            } catch (e: ApiException) {
                Toast.makeText(requireContext(), e.message, Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "No se pudieron cargar solicitudes", Toast.LENGTH_SHORT).show()
            }
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
