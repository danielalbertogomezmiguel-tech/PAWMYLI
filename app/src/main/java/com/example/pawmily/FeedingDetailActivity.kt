package com.example.pawmily

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.pawmily.databinding.ActivityFeedingDetailBinding
import kotlinx.coroutines.launch

class FeedingDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityFeedingDetailBinding
    private var petBackendId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFeedingDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val petCode = intent.getStringExtra("PET_CODE")
        binding.btnBack.setOnClickListener { finish() }
        binding.btnSaveFeeding.setOnClickListener { saveFeeding() }

        if (petCode == null) {
            Toast.makeText(this, R.string.error_pet_id, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(petCode)
                petBackendId = pet.backendId
                binding.tvPetName.text = pet.name
                binding.tvPetBreed.text = pet.breed
                val savedUri = SessionManager(this@FeedingDetailActivity).getPetImageUri(pet.id)
                if (savedUri != null) {
                    runCatching { binding.ivPet.setImageURI(android.net.Uri.parse(savedUri)) }
                }

                val feeding = pet.backendId?.let { id ->
                    runCatching { RemotePetRepository.getFeeding(id) }.getOrNull()
                }
                binding.tvEmptyFeeding.visibility = if (feeding == null) View.VISIBLE else View.GONE
                FeedingFormHelper.bind(binding.feedingForm.root, feeding)
            } catch (e: Exception) {
                Toast.makeText(
                    this@FeedingDetailActivity,
                    e.message ?: getString(R.string.error_load_feeding),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun saveFeeding() {
        val backendId = petBackendId
        if (backendId.isNullOrBlank()) {
            Toast.makeText(this, R.string.error_pet_id, Toast.LENGTH_SHORT).show()
            return
        }
        binding.btnSaveFeeding.isEnabled = false
        lifecycleScope.launch {
            try {
                val body = FeedingFormHelper.collect(binding.feedingForm.root)
                RemotePetRepository.updateFeeding(backendId, body)
                binding.tvEmptyFeeding.visibility = View.GONE
                Toast.makeText(this@FeedingDetailActivity, R.string.feeding_saved, Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(
                    this@FeedingDetailActivity,
                    e.message ?: getString(R.string.error_save_feeding),
                    Toast.LENGTH_LONG
                ).show()
            } finally {
                binding.btnSaveFeeding.isEnabled = true
            }
        }
    }
}
