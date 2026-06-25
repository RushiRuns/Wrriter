package com.rushi.wrriter

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.rushi.wrriter.data.PreferencesManager
import com.rushi.wrriter.data.VaultManager
import com.rushi.wrriter.ui.screens.InboxScreen
import com.rushi.wrriter.ui.screens.OnboardingScreen
import com.rushi.wrriter.ui.theme.WrriterTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var preferencesManager: PreferencesManager
    private lateinit var vaultManager: VaultManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        preferencesManager = PreferencesManager(applicationContext)
        vaultManager = VaultManager(applicationContext)

        enableEdgeToEdge()
        setContent {
            WrriterTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val coroutineScope = rememberCoroutineScope()
                    val vaultUriState = preferencesManager.vaultUriFlow.collectAsState(initial = null)
                    
                    val vaultUri = vaultUriState.value

                    if (vaultUri.isNullOrEmpty()) {
                        // Onboarding first launch
                        OnboardingScreen(
                            onVaultSelected = { selectedUri ->
                                coroutineScope.launch {
                                    val success = vaultManager.initializeDefaultFolders(selectedUri)
                                    if (success) {
                                        preferencesManager.saveVaultUri(selectedUri)
                                        vaultManager.rebuildCache(selectedUri)
                                    } else {
                                        Toast.makeText(
                                            applicationContext,
                                            "Failed to initialize vault folders in selected directory",
                                            Toast.LENGTH_LONG
                                        ).show()
                                    }
                                }
                            }
                        )
                    } else {
                        // Inbox default landing screen
                        InboxScreen(
                            vaultManager = vaultManager,
                            vaultUri = vaultUri,
                            onNoteSelected = { note ->
                                Toast.makeText(
                                    applicationContext,
                                    "Note tapped: ${note.title}",
                                    Toast.LENGTH_SHORT
                                ).show()
                                // Navigation to editor will be implemented in US2 (Phase 4)
                            }
                        )
                    }
                }
            }
        }
    }
}