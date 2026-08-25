package com.example.pawmily

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.pawmily.databinding.ActivityBarcodeScanBinding
import com.google.zxing.ResultPoint
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import kotlinx.coroutines.launch

class BarcodeScanActivity : AppCompatActivity() {
    private lateinit var binding: ActivityBarcodeScanBinding
    private var linking = false

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            binding.barcodeScanner.resume()
        } else {
            Toast.makeText(this, R.string.camera_permission_denied, Toast.LENGTH_LONG).show()
        }
    }

    private val scanCallback = object : BarcodeCallback {
        override fun barcodeResult(result: BarcodeResult?) {
            val code = result?.text?.trim().orEmpty()
            if (code.isNotEmpty()) {
                binding.barcodeScanner.pause()
                linkAndOpen(code)
            }
        }

        override fun possibleResultPoints(resultPoints: MutableList<ResultPoint>?) {}
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityBarcodeScanBinding.inflate(layoutInflater)
        setContentView(binding.root)
        KeyboardDismissHelper.attach(this, binding.root)
        SessionManager(this)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnLinkCode.setOnClickListener {
            linkAndOpen(binding.etBarcodeInput.text.toString())
        }
        binding.etBarcodeInput.setOnEditorActionListener { _, actionId, event ->
            val isEnter = event != null && event.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN
            if (actionId == EditorInfo.IME_ACTION_DONE || isEnter) {
                linkAndOpen(binding.etBarcodeInput.text.toString())
                true
            } else {
                false
            }
        }

        binding.barcodeScanner.decodeContinuous(scanCallback)
        ensureCameraPermission()
    }

    override fun onResume() {
        super.onResume()
        if (hasCameraPermission()) {
            binding.barcodeScanner.resume()
        }
    }

    override fun onPause() {
        binding.barcodeScanner.pause()
        super.onPause()
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun ensureCameraPermission() {
        if (hasCameraPermission()) {
            binding.barcodeScanner.resume()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun linkAndOpen(rawCode: String) {
        val code = rawCode.trim()
        if (code.isEmpty() || linking) return
        linking = true
        binding.btnLinkCode.isEnabled = false

        lifecycleScope.launch {
            try {
                val message = RemotePetRepository.linkPet(code)
                Toast.makeText(this@BarcodeScanActivity, message, Toast.LENGTH_LONG).show()
                finish()
            } catch (e: ApiException) {
                Toast.makeText(this@BarcodeScanActivity, e.message, Toast.LENGTH_LONG).show()
                linking = false
                binding.btnLinkCode.isEnabled = true
                if (hasCameraPermission()) binding.barcodeScanner.resume()
            } catch (_: Exception) {
                Toast.makeText(this@BarcodeScanActivity, R.string.error_link_pet, Toast.LENGTH_SHORT).show()
                linking = false
                binding.btnLinkCode.isEnabled = true
                if (hasCameraPermission()) binding.barcodeScanner.resume()
            }
        }
    }
}
