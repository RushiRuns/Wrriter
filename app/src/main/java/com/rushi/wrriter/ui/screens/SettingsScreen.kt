package com.rushi.wrriter.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rushi.wrriter.data.PreferencesManager
import com.rushi.wrriter.data.VaultManager
import com.rushi.wrriter.service.FloatingWidgetService
import com.rushi.wrriter.network.SyncthingClient
import com.rushi.wrriter.network.SyncthingDevice
import com.rushi.wrriter.network.SyncthingStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    preferencesManager: PreferencesManager,
    vaultManager: VaultManager,
    onNavigateToOnboarding: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val syncthingClient = remember { SyncthingClient() }

    // Settings States
    val vaultUri = preferencesManager.vaultUriFlow.collectAsState(initial = "").value ?: ""
    val theme = preferencesManager.themeFlow.collectAsState(initial = "oled").value
    val font = preferencesManager.fontFlow.collectAsState(initial = "default").value
    val texture = preferencesManager.textureFlow.collectAsState(initial = "none").value
    val spellcheck = preferencesManager.spellcheckFlow.collectAsState(initial = true).value
    val tabMode = preferencesManager.tabModeFlow.collectAsState(initial = "2spaces").value
    val breakReminderEnabled = preferencesManager.breakReminderEnabledFlow.collectAsState(initial = true).value
    val breakReminderThreshold = preferencesManager.breakReminderThresholdFlow.collectAsState(initial = 60).value

    // SAF Import / Export Launchers
    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments(),
        onResult = { uris ->
            if (uris.isNotEmpty()) {
                coroutineScope.launch(Dispatchers.IO) {
                    val count = vaultManager.importNotes(vaultUri, uris)
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Successfully imported $count notes into Inbox", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    )

    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree(),
        onResult = { uri ->
            if (uri != null) {
                coroutineScope.launch(Dispatchers.IO) {
                    val success = vaultManager.exportVault(vaultUri, uri)
                    withContext(Dispatchers.Main) {
                        if (success) {
                            Toast.makeText(context, "Vault exported successfully", Toast.LENGTH_LONG).show()
                        } else {
                            Toast.makeText(context, "Vault export failed", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
        }
    )

    var isOverlayEnabled by remember {
        mutableStateOf(FloatingWidgetService.isServiceRunning)
    }

    val toggleOverlayService = { enabled: Boolean ->
        if (enabled) {
            if (Settings.canDrawOverlays(context)) {
                val intent = Intent(context, FloatingWidgetService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                isOverlayEnabled = true
            } else {
                Toast.makeText(context, "Please grant overlay permission for Wrriter", Toast.LENGTH_LONG).show()
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${context.packageName}")
                )
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(intent)
                isOverlayEnabled = false
            }
        } else {
            context.stopService(Intent(context, FloatingWidgetService::class.java))
            isOverlayEnabled = false
        }
    }

    // Syncthing Input States
    val initialIp = preferencesManager.syncthingIpFlow.collectAsState(initial = "http://192.168.1.100").value
    val initialPort = preferencesManager.syncthingPortFlow.collectAsState(initial = 8384).value
    
    var ipInput by remember(initialIp) { mutableStateOf(initialIp) }
    var portInput by remember(initialPort) { mutableStateOf(initialPort.toString()) }
    var apiKeyInput by remember { mutableStateOf(preferencesManager.getSyncthingApiKey()) }

    // Syncthing API Status States
    var connectionStatus by remember { mutableStateOf("Disconnected") } // Connected, Disconnected, Checking...
    var systemStatus by remember { mutableStateOf<SyncthingStatus?>(null) }
    var devicesList by remember { mutableStateOf(emptyList<SyncthingDevice>()) }
    var isScanning by remember { mutableStateOf(false) }

    // Fetch Status from Syncthing Client
    val checkSyncthingConnection = {
        val ip = ipInput.trim()
        val port = portInput.trim().toIntOrNull() ?: 8384
        val key = apiKeyInput.trim()

        if (ip.isNotEmpty() && key.isNotEmpty()) {
            connectionStatus = "Checking..."
            coroutineScope.launch(Dispatchers.IO) {
                val status = syncthingClient.getSystemStatus(ip, port, key)
                val devices = syncthingClient.getDevices(ip, port, key)
                withContext(Dispatchers.Main) {
                    if (status != null) {
                        systemStatus = status
                        devicesList = devices
                        connectionStatus = "Connected"
                    } else {
                        systemStatus = null
                        devicesList = emptyList()
                        connectionStatus = "Failed to Connect"
                    }
                }
            }
        } else {
            connectionStatus = "Disconnected"
            systemStatus = null
            devicesList = emptyList()
        }
    }

    // Auto-check connection on screen load
    LaunchedEffect(initialIp, initialPort) {
        checkSyncthingConnection()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF000000)) // OLED Black
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(top = 24.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            item {
                Text(
                    text = "Settings",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }

            // Vault Configuration Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Vault Workspace",
                            color = Color(0xFF94A3B8),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Selected Path:",
                            color = Color(0xFF64748B),
                            fontSize = 12.sp
                        )
                        Text(
                            text = vaultUri,
                            color = Color.White,
                            fontSize = 14.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = onNavigateToOnboarding,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF1E293B),
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Change Vault Directory", fontSize = 12.sp)
                        }
                    }
                }
            }

            // Editor Personalization Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "Editor Personalization",
                            color = Color(0xFF94A3B8),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )

                        // Font Style Selection
                        Column {
                            Text("Font Family", color = Color(0xFF64748B), fontSize = 12.sp)
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                val fontOptions = listOf("default", "sans-serif", "serif", "monospace")
                                fontOptions.forEach { option ->
                                    val isSelected = font == option
                                    Button(
                                        onClick = {
                                            coroutineScope.launch { preferencesManager.saveFont(option) }
                                        },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (isSelected) Color(0xFF94A3B8) else Color(0xFF1E293B),
                                            contentColor = Color.White
                                        ),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = option.substringBefore("-").replaceFirstChar { it.uppercase() },
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }

                        // Texture Selection
                        Column {
                            Text("Background Texture", color = Color(0xFF64748B), fontSize = 12.sp)
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                val textureOptions = listOf("none", "paper", "ruled", "grid")
                                textureOptions.forEach { option ->
                                    val isSelected = texture == option
                                    Button(
                                        onClick = {
                                            coroutineScope.launch { preferencesManager.saveTexture(option) }
                                        },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (isSelected) Color(0xFF94A3B8) else Color(0xFF1E293B),
                                            contentColor = Color.White
                                        ),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = option.replaceFirstChar { it.uppercase() },
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }

                        // Tab Mode Selection
                        Column {
                            Text("Tab Indentation", color = Color(0xFF64748B), fontSize = 12.sp)
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                val tabOptions = listOf("tab", "2spaces", "4spaces")
                                val displayNames = mapOf("tab" to "Tab", "2spaces" to "2 Spaces", "4spaces" to "4 Spaces")
                                tabOptions.forEach { option ->
                                    val isSelected = tabMode == option
                                    Button(
                                        onClick = {
                                            coroutineScope.launch { preferencesManager.saveTabMode(option) }
                                        },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (isSelected) Color(0xFF94A3B8) else Color(0xFF1E293B),
                                            contentColor = Color.White
                                        ),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = displayNames[option] ?: option,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }

                        // Spellcheck Switch
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("System Spellcheck", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text("Toggle Android system-level dictionary spelling wrapper.", color = Color(0xFF64748B), fontSize = 11.sp)
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Switch(
                                checked = spellcheck,
                                onCheckedChange = { enabled ->
                                    coroutineScope.launch { preferencesManager.saveSpellcheck(enabled) }
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.Black,
                                    checkedTrackColor = Color(0xFF94A3B8),
                                    uncheckedThumbColor = Color(0xFF64748B),
                                    uncheckedTrackColor = Color(0xFF1E293B)
                                )
                            )
                        }
                    }
                }
            }

            // Break Reminders Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Typing Break Reminders",
                                    color = Color(0xFF94A3B8),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Remind to take a break after continuous typing.",
                                    color = Color(0xFF64748B),
                                    fontSize = 12.sp
                                )
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Switch(
                                checked = breakReminderEnabled,
                                onCheckedChange = { enabled ->
                                    coroutineScope.launch { preferencesManager.saveBreakReminderEnabled(enabled) }
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.Black,
                                    checkedTrackColor = Color(0xFF94A3B8),
                                    uncheckedThumbColor = Color(0xFF64748B),
                                    uncheckedTrackColor = Color(0xFF1E293B)
                                )
                            )
                        }

                        if (breakReminderEnabled) {
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Reminder Threshold", color = Color.White, fontSize = 12.sp)
                                    Text("${breakReminderThreshold} minutes", color = Color(0xFF94A3B8), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Slider(
                                    value = breakReminderThreshold.toFloat(),
                                    onValueChange = { value ->
                                        coroutineScope.launch {
                                            preferencesManager.saveBreakReminderThreshold(value.toInt())
                                        }
                                    },
                                    valueRange = 5f..180f,
                                    steps = 34,
                                    colors = SliderDefaults.colors(
                                        thumbColor = Color(0xFF94A3B8),
                                        activeTrackColor = Color(0xFF94A3B8),
                                        inactiveTrackColor = Color(0xFF1E293B)
                                    )
                                )
                            }
                        }
                    }
                }
            }

            // Note Alarms & Reminders Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Note Alarms & Reminders",
                            color = Color(0xFF94A3B8),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = "Alarms and reminders are set per-note within the note editor using the bell notification icon.",
                            color = Color(0xFF64748B),
                            fontSize = 12.sp
                        )
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            val hasPermission = remember {
                                mutableStateOf(
                                    androidx.core.content.ContextCompat.checkSelfPermission(
                                        context,
                                        android.Manifest.permission.POST_NOTIFICATIONS
                                    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                                )
                            }
                            val launcher = rememberLauncherForActivityResult(
                                contract = ActivityResultContracts.RequestPermission()
                            ) { isGranted ->
                                hasPermission.value = isGranted
                                if (isGranted) {
                                    Toast.makeText(context, "Notification permission granted", Toast.LENGTH_SHORT).show()
                                } else {
                                    Toast.makeText(context, "Notification permission denied", Toast.LENGTH_SHORT).show()
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (hasPermission.value) "Notification Access: Active" else "Notification Access: Disabled",
                                    color = if (hasPermission.value) Color(0xFF22C55E) else Color(0xFFEF4444),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                if (!hasPermission.value) {
                                    Button(
                                        onClick = {
                                            launcher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                                        },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = Color(0xFF1E293B),
                                            contentColor = Color.White
                                        ),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text("Grant Permission", fontSize = 11.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Backup & Portability Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Backup & Portability",
                            color = Color(0xFF94A3B8),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = "Import external markdown notes or export your entire vault workspace to a backup folder.",
                            color = Color(0xFF64748B),
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Button(
                                onClick = {
                                    importLauncher.launch(arrayOf("*/*"))
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF1E293B),
                                    contentColor = Color.White
                                ),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Import Files", fontSize = 13.sp)
                            }
                            Button(
                                onClick = {
                                    exportLauncher.launch(null)
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF1E293B),
                                    contentColor = Color.White
                                ),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Export Vault", fontSize = 13.sp)
                            }
                        }
                    }
                }
            }

            // Assistive Touch Overlay Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Assistive Touch Overlay",
                                color = Color(0xFF94A3B8),
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "System-wide floating overlay button for quick note taking and voice recording.",
                                color = Color(0xFF64748B),
                                fontSize = 12.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Switch(
                            checked = isOverlayEnabled,
                            onCheckedChange = { toggleOverlayService(it) },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.Black,
                                checkedTrackColor = Color(0xFF94A3B8),
                                uncheckedThumbColor = Color(0xFF64748B),
                                uncheckedTrackColor = Color(0xFF1E293B)
                            )
                        )
                    }
                }
            }

            // Syncthing configuration section
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Syncthing PC Client Sync",
                            color = Color(0xFF94A3B8),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        
                        TextField(
                            value = ipInput,
                            onValueChange = { ipInput = it },
                            label = { Text("PC IP Address") },
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = Color(0xFF000000),
                                unfocusedContainerColor = Color(0xFF000000),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        TextField(
                            value = portInput,
                            onValueChange = { portInput = it },
                            label = { Text("API Port") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = Color(0xFF000000),
                                unfocusedContainerColor = Color(0xFF000000),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        TextField(
                            value = apiKeyInput,
                            onValueChange = { apiKeyInput = it },
                            label = { Text("REST API Key") },
                            visualTransformation = PasswordVisualTransformation(),
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = Color(0xFF000000),
                                unfocusedContainerColor = Color(0xFF000000),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        preferencesManager.saveSyncthingIp(ipInput)
                                        preferencesManager.saveSyncthingPort(portInput.toIntOrNull() ?: 8384)
                                        preferencesManager.saveSyncthingApiKey(apiKeyInput)
                                        Toast.makeText(context, "Syncthing settings saved", Toast.LENGTH_SHORT).show()
                                        checkSyncthingConnection()
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF94A3B8))
                            ) {
                                Text("Save & Connect")
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val indicatorColor = when (connectionStatus) {
                                    "Connected" -> Color(0xFF22C55E)
                                    "Checking..." -> Color(0xFFEAB308)
                                    else -> Color(0xFFEF4444)
                                }
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .background(indicatorColor, RoundedCornerShape(5.dp))
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = connectionStatus,
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }

            // Syncthing Connection Board & Action Controls
            if (connectionStatus == "Connected" && systemStatus != null) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF121212))
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Syncthing Status Board",
                                color = Color(0xFF94A3B8),
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Device ID:", color = Color(0xFF64748B), fontSize = 12.sp)
                                Text(
                                    text = systemStatus!!.myID.take(15) + "...",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Status:", color = Color(0xFF64748B), fontSize = 12.sp)
                                Text(
                                    text = systemStatus!!.status.uppercase(),
                                    color = if (systemStatus!!.status == "idle") Color(0xFF22C55E) else Color(0xFFEAB308),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Uptime:", color = Color(0xFF64748B), fontSize = 12.sp)
                                Text(
                                    text = "${systemStatus!!.uptime / 60} minutes",
                                    color = Color.White,
                                    fontSize = 12.sp
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider(color = Color(0xFF1E293B))
                            Spacer(modifier = Modifier.height(4.dp))

                            Text(
                                text = "Connected Sync Devices",
                                color = Color(0xFF64748B),
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )

                            if (devicesList.isEmpty()) {
                                Text(
                                    text = "No other sync devices registered",
                                    color = Color(0xFF475569),
                                    fontSize = 12.sp
                                )
                            } else {
                                devicesList.forEach { device ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(text = device.name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                            Text(text = device.deviceID.take(10) + "...", color = Color(0xFF475569), fontSize = 11.sp)
                                        }

                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Box(
                                                modifier = Modifier
                                                    .size(8.dp)
                                                    .background(
                                                        if (device.connected) Color(0xFF22C55E) else Color(0xFFEF4444),
                                                        RoundedCornerShape(4.dp)
                                                    )
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = if (device.connected) "Online" else "Offline",
                                                color = Color.White,
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    isScanning = true
                                    coroutineScope.launch(Dispatchers.IO) {
                                        val success = syncthingClient.triggerScan(
                                            ipInput.trim(),
                                            portInput.trim().toIntOrNull() ?: 8384,
                                            apiKeyInput.trim()
                                        )
                                        withContext(Dispatchers.Main) {
                                            isScanning = false
                                            if (success) {
                                                Toast.makeText(context, "Scan command sent to PC successfully", Toast.LENGTH_SHORT).show()
                                            } else {
                                                Toast.makeText(context, "Scan command failed", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                },
                                enabled = !isScanning,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                if (isScanning) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                                } else {
                                    Text("Sync Now (Trigger PC Scan)", fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
