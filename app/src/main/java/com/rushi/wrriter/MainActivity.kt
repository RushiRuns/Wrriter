package com.rushi.wrriter

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.BarChart
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
import com.rushi.wrriter.ui.screens.StatisticsScreen
import com.rushi.wrriter.ui.theme.WrriterTheme
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private lateinit var preferencesManager: PreferencesManager
    private lateinit var vaultManager: VaultManager
    private var sensorManager: SensorManager? = null
    private var shakeDetector: ShakeDetector? = null
    private var onShakeCallback: (() -> Unit)? = null
    private val openNoteUriState = mutableStateOf<String?>(null)

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        preferencesManager = PreferencesManager(applicationContext)
        vaultManager = VaultManager(applicationContext)

        val noteUri = intent?.getStringExtra("open_note_uri")
        if (!noteUri.isNullOrEmpty()) {
            openNoteUriState.value = noteUri
        }

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

                    BackHandler(enabled = activeNoteUri != null) {
                        activeNoteUri = null
                    }

                    BackHandler(enabled = showDrawingPad) {
                        showDrawingPad = false
                    }

                    BackHandler(enabled = selectedTab != "inbox" && activeNoteUri == null && !showDrawingPad) {
                        selectedTab = "inbox"
                    }
                    
                    val vaultUri = vaultUriState.value

                    val incomingNoteUri = openNoteUriState.value
                    LaunchedEffect(incomingNoteUri) {
                        if (incomingNoteUri != null) {
                            activeNoteUri = incomingNoteUri
                            openNoteUriState.value = null // Consume
                        }
                    }

                    // Trigger cache rebuild on Dispatchers.IO when vaultUri is loaded/changed
                    LaunchedEffect(vaultUri) {
                        if (!vaultUri.isNullOrEmpty()) {
                            withContext(Dispatchers.IO) {
                                vaultManager.rebuildCache(vaultUri)
                            }
                        }
                    }

                    var observerJob by remember { mutableStateOf<Job?>(null) }

                    DisposableEffect(vaultUri) {
                        if (vaultUri.isNullOrEmpty()) {
                            onDispose {}
                        } else {
                            val contentObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
                                override fun onChange(selfChange: Boolean, uri: Uri?) {
                                    super.onChange(selfChange, uri)
                                    observerJob?.cancel()
                                    observerJob = coroutineScope.launch(Dispatchers.IO) {
                                        delay(1000) // 1-second debounce
                                        vaultManager.rebuildCache(vaultUri)
                                    }
                                }
                            }
                            try {
                                contentResolver.registerContentObserver(
                                    Uri.parse(vaultUri),
                                    true,
                                    contentObserver
                                )
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                            onDispose {
                                contentResolver.unregisterContentObserver(contentObserver)
                                observerJob?.cancel()
                            }
                        }
                    }

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
                                coroutineScope.launch(Dispatchers.IO) {
                                    val success = vaultManager.initializeDefaultFolders(selectedUri)
                                    if (success) {
                                        preferencesManager.saveVaultUri(selectedUri)
                                        vaultManager.rebuildCache(selectedUri)
                                    } else {
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(
                                                applicationContext,
                                                "Failed to initialize vault folders in selected directory",
                                                Toast.LENGTH_LONG
                                            ).show()
                                        }
                                    }
                                }
                            }
                        )
                    } else {
                        // Routing states
                        Box(modifier = Modifier.fillMaxSize()) {
                            when {
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
                                    val isKeyboardOpen = WindowInsets.ime.getBottom(LocalDensity.current) > 0
                                    Scaffold(
                                        bottomBar = {
                                            if (!isKeyboardOpen) {
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
                                                            selectedIconColor = Color(0xFF94A3B8),
                                                            selectedTextColor = Color(0xFF94A3B8),
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
                                                            selectedIconColor = Color(0xFF94A3B8),
                                                            selectedTextColor = Color(0xFF94A3B8),
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
                                                            selectedIconColor = Color(0xFF94A3B8),
                                                            selectedTextColor = Color(0xFF94A3B8),
                                                            unselectedIconColor = Color(0xFF64748B),
                                                            unselectedTextColor = Color(0xFF64748B),
                                                            indicatorColor = Color(0xFF1E293B)
                                                        )
                                                    )
                                                    NavigationBarItem(
                                                        selected = selectedTab == "stats",
                                                        onClick = { selectedTab = "stats" },
                                                        icon = { Icon(Icons.Default.BarChart, contentDescription = "Stats") },
                                                        label = { Text("Stats") },
                                                        colors = NavigationBarItemDefaults.colors(
                                                            selectedIconColor = Color(0xFF94A3B8),
                                                            selectedTextColor = Color(0xFF94A3B8),
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
                                                            selectedIconColor = Color(0xFF94A3B8),
                                                            selectedTextColor = Color(0xFF94A3B8),
                                                            unselectedIconColor = Color(0xFF64748B),
                                                            unselectedTextColor = Color(0xFF64748B),
                                                            indicatorColor = Color(0xFF1E293B)
                                                        )
                                                    )
                                                }
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
                                                "stats" -> {
                                                    StatisticsScreen(
                                                        vaultManager = vaultManager,
                                                        vaultUri = vaultUri
                                                    )
                                                }
                                                "settings" -> {
                                                    SettingsScreen(
                                                        preferencesManager = preferencesManager,
                                                        vaultManager = vaultManager,
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

                            if (showDrawingPad) {
                                DrawingPadScreen(
                                    vaultUri = vaultUri,
                                    onBack = { showDrawingPad = false },
                                    onDrawingSaved = { path ->
                                        insertedDrawingPath = path
                                        showDrawingPad = false
                                    }
                                )
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val noteUri = intent.getStringExtra("open_note_uri")
        if (!noteUri.isNullOrEmpty()) {
            openNoteUriState.value = noteUri
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