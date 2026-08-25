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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFeedingDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        KeyboardDismissHelper.attach(this, binding.root)

        val petCode = intent.getStringExtra("PET_CODE")
        binding.btnBack.setOnClickListener { finish() }
        binding.btnSaveFeeding.visibility = View.GONE
        binding.btnSaveFeeding.setOnClickListener {
            Toast.makeText(this, R.string.diet_read_only_owner, Toast.LENGTH_SHORT).show()
        }

        if (petCode == null) {
            Toast.makeText(this, R.string.error_pet_id, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        lifecycleScope.launch {
            try {
                val pet = RemotePetRepository.getPet(petCode)
                binding.tvPetName.text = pet.name
                binding.tvPetBreed.text = pet.breed
                val savedUri = SessionManager(this@FeedingDetailActivity).getPetImageUri(pet.id)
                if (savedUri != null) {
                    runCatching { binding.ivPet.setImageURI(android.net.Uri.parse(savedUri)) }
                } else {
                    PetImageLoader.loadInto(binding.ivPet, pet.imageUrl)
                }

                val feeding = pet.backendId?.let { id ->
                    runCatching { RemotePetRepository.getFeeding(id) }.getOrNull()
                }
                binding.tvEmptyFeeding.visibility = if (feeding == null) View.VISIBLE else View.GONE
                binding.tvEmptyFeeding.setText(R.string.empty_feeding_owner)
                FeedingFormHelper.bind(binding.feedingForm.root, feeding, editable = false)
            } catch (e: Exception) {
                Toast.makeText(
                    this@FeedingDetailActivity,
                    e.message ?: getString(R.string.error_load_feeding),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
}
