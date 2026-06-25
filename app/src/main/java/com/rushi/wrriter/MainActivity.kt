package com.rushi.wrriter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.rushi.wrriter.data.PreferencesManager
import com.rushi.wrriter.data.VaultManager
import com.rushi.wrriter.sensor.ShakeDetector
import com.rushi.wrriter.ui.screens.DrawingPadScreen
import com.rushi.wrriter.ui.screens.EditorScreen
import com.rushi.wrriter.ui.screens.InboxScreen
import com.rushi.wrriter.ui.screens.JournalScreen
import com.rushi.wrriter.ui.screens.OnboardingScreen
import com.rushi.wrriter.ui.screens.TasksScreen
import com.rushi.wrriter.ui.screens.SettingsScreen
import com.rushi.wrriter.ui.theme.WrriterTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var preferencesManager: PreferencesManager
    private lateinit var vaultManager: VaultManager
    private var sensorManager: SensorManager? = null
    private var shakeDetector: ShakeDetector? = null
    private var onShakeCallback: (() -> Unit)? = null

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        preferencesManager = PreferencesManager(applicationContext)
        vaultManager = VaultManager(applicationContext)

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        shakeDetector = ShakeDetector {
            onShakeCallback?.invoke()
        }

        enableEdgeToEdge()
        setContent {
            WrriterTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val coroutineScope = rememberCoroutineScope()
                    
                    // State observers
                    val vaultUriState = preferencesManager.vaultUriFlow.collectAsState(initial = null)
                    var activeNoteUri by remember { mutableStateOf<String?>(null) }
                    var showDrawingPad by remember { mutableStateOf(false) }
                    var insertedDrawingPath by remember { mutableStateOf<String?>(null) }
                    var selectedTab by remember { mutableStateOf("inbox") }
                    
                    val vaultUri = vaultUriState.value

                    onShakeCallback = {
                        val notes = vaultManager.getCachedNotes()
                        if (notes.isEmpty()) {
                            Toast.makeText(applicationContext, "No notes available to open", Toast.LENGTH_SHORT).show()
                        } else {
                            val randomNote = notes.random()
                            Toast.makeText(applicationContext, "Opening random note: ${randomNote.title}...", Toast.LENGTH_SHORT).show()
                            triggerVibration()
                            activeNoteUri = randomNote.uriString
                        }
                    }

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
                        // Routing states
                        when {
                            showDrawingPad -> {
                                DrawingPadScreen(
                                    vaultUri = vaultUri,
                                    onBack = { showDrawingPad = false },
                                    onDrawingSaved = { path ->
                                        insertedDrawingPath = path
                                        showDrawingPad = false
                                    }
                                )
                            }
                            activeNoteUri != null -> {
                                EditorScreen(
                                    vaultManager = vaultManager,
                                    vaultUri = vaultUri,
                                    noteUriString = activeNoteUri!!,
                                    onBack = { activeNoteUri = null },
                                    onWikiLinkClicked = { targetNote ->
                                        activeNoteUri = targetNote.uriString
                                    },
                                    onInsertDrawingRequest = {
                                        showDrawingPad = true
                                    },
                                    insertedDrawingPath = insertedDrawingPath,
                                    onInsertedDrawingConsumed = {
                                        insertedDrawingPath = null
                                    }
                                )
                            }
                            else -> {
                                Scaffold(
                                    bottomBar = {
                                        NavigationBar(
                                            containerColor = Color(0xFF121212),
                                            contentColor = Color.White
                                        ) {
                                            NavigationBarItem(
                                                selected = selectedTab == "inbox",
                                                onClick = { selectedTab = "inbox" },
                                                icon = { Icon(Icons.Default.Inbox, contentDescription = "Inbox") },
                                                label = { Text("Inbox") },
                                                colors = NavigationBarItemDefaults.colors(
                                                    selectedIconColor = Color(0xFFF97316),
                                                    selectedTextColor = Color(0xFFF97316),
                                                    unselectedIconColor = Color(0xFF64748B),
                                                    unselectedTextColor = Color(0xFF64748B),
                                                    indicatorColor = Color(0xFF1E293B)
                                                )
                                            )
                                            NavigationBarItem(
                                                selected = selectedTab == "journal",
                                                onClick = { selectedTab = "journal" },
                                                icon = { Icon(Icons.Default.Book, contentDescription = "Journal") },
                                                label = { Text("Journal") },
                                                colors = NavigationBarItemDefaults.colors(
                                                    selectedIconColor = Color(0xFFF97316),
                                                    selectedTextColor = Color(0xFFF97316),
                                                    unselectedIconColor = Color(0xFF64748B),
                                                    unselectedTextColor = Color(0xFF64748B),
                                                    indicatorColor = Color(0xFF1E293B)
                                                )
                                            )
                                            NavigationBarItem(
                                                selected = selectedTab == "tasks",
                                                onClick = { selectedTab = "tasks" },
                                                icon = { Icon(Icons.Default.Assignment, contentDescription = "Tasks") },
                                                label = { Text("Tasks") },
                                                colors = NavigationBarItemDefaults.colors(
                                                    selectedIconColor = Color(0xFFF97316),
                                                    selectedTextColor = Color(0xFFF97316),
                                                    unselectedIconColor = Color(0xFF64748B),
                                                    unselectedTextColor = Color(0xFF64748B),
                                                    indicatorColor = Color(0xFF1E293B)
                                                )
                                            )
                                            NavigationBarItem(
                                                selected = selectedTab == "settings",
                                                onClick = { selectedTab = "settings" },
                                                icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                                                label = { Text("Settings") },
                                                colors = NavigationBarItemDefaults.colors(
                                                    selectedIconColor = Color(0xFFF97316),
                                                    selectedTextColor = Color(0xFFF97316),
                                                    unselectedIconColor = Color(0xFF64748B),
                                                    unselectedTextColor = Color(0xFF64748B),
                                                    indicatorColor = Color(0xFF1E293B)
                                                )
                                            )
                                        }
                                    },
                                    containerColor = Color.Black
                                ) { innerPadding ->
                                    Box(modifier = Modifier.padding(innerPadding)) {
                                        when (selectedTab) {
                                            "inbox" -> {
                                                InboxScreen(
                                                    vaultManager = vaultManager,
                                                    vaultUri = vaultUri,
                                                    onNoteSelected = { note ->
                                                        activeNoteUri = note.uriString
                                                    }
                                                )
                                            }
                                            "journal" -> {
                                                JournalScreen(
                                                    vaultManager = vaultManager,
                                                    vaultUri = vaultUri,
                                                    onNoteSelected = { note ->
                                                        activeNoteUri = note.uriString
                                                    }
                                                )
                                            }
                                            "tasks" -> {
                                                TasksScreen(
                                                    vaultManager = vaultManager,
                                                    vaultUri = vaultUri,
                                                    onNoteSelected = { note ->
                                                        activeNoteUri = note.uriString
                                                    }
                                                )
                                            }
                                            "settings" -> {
                                                SettingsScreen(
                                                    preferencesManager = preferencesManager,
                                                    onNavigateToOnboarding = {
                                                        coroutineScope.launch {
                                                            preferencesManager.saveVaultUri("")
                                                        }
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        val accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        if (accelerometer != null && shakeDetector != null) {
            sensorManager?.registerListener(shakeDetector, accelerometer, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onPause() {
        super.onPause()
        if (shakeDetector != null) {
            sensorManager?.unregisterListener(shakeDetector)
        }
    }

    private fun triggerVibration() {
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        if (vibrator != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(200)
            }
        }
    }
}