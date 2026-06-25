package com.rushi.wrriter.ui.screens

import android.widget.Toast
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
    onNavigateToOnboarding: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val syncthingClient = remember { SyncthingClient() }

    // Settings States
    val vaultUri = preferencesManager.vaultUriFlow.collectAsState(initial = "").value ?: ""

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
                            color = Color(0xFFF97316),
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
                            color = Color(0xFFF97316),
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
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF97316))
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
                                color = Color(0xFFF97316),
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
