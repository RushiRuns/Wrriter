package com.rushi.wrriter.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import com.rushi.wrriter.data.AudioRecorder
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.PreferencesManager
import com.rushi.wrriter.data.VaultManager
import com.rushi.wrriter.ui.components.InboxToolbar
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    vaultManager: VaultManager,
    vaultUri: String,
    onNoteSelected: (NoteMetadata) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val preferencesManager = remember { PreferencesManager(context) }

    var notesList by remember { mutableStateOf(emptyList<NoteMetadata>()) }
    var dumpText by remember { mutableStateOf("") }
    
    // Selection state for toolbar
    var selectedNoteUri by remember { mutableStateOf<String?>(null) }
    var lastUsedFolder by remember { mutableStateOf("Later") }
    var existingFolders by remember { mutableStateOf(emptyList<String>()) }

    // Audio recording state
    val audioRecorder = remember { AudioRecorder(context) }
    var isRecording by remember { mutableStateOf(false) }
    val tempAudioFile = remember { File(context.cacheDir, "temp_voice.m4a") }

    // Audio permissions launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startRecording(context, audioRecorder, tempAudioFile)
            isRecording = true
        } else {
            Toast.makeText(context, "Microphone permission required for voice notes", Toast.LENGTH_SHORT).show()
        }
    }

    // Refresh inbox lists and configs
    val refreshInbox = {
        try {
            vaultManager.rebuildCache(vaultUri)
            notesList = vaultManager.getInboxNotes().sortedByDescending { it.modifiedTime }
            existingFolders = vaultManager.getCachedNotes().map { it.filePath }.distinct()
            coroutineScope.launch {
                lastUsedFolder = preferencesManager.lastUsedFolderFlow.first()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    LaunchedEffect(vaultUri) {
        refreshInbox()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF000000)) // OLED Black
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 80.dp) // Leave space for bottom dump input
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Inbox",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "${notesList.size} notes",
                    fontSize = 14.sp,
                    color = Color(0xFF64748B) // Muted slate
                )
            }

            // Notes list
            if (notesList.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Clean slate. Dump your thoughts below.",
                        fontSize = 14.sp,
                        color = Color(0xFF475569) // Muted text
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(notesList, key = { it.uriString }) { note ->
                        val isSelected = selectedNoteUri == note.uriString
                        
                        Column {
                            InboxNoteRow(
                                note = note,
                                isSelected = isSelected,
                                onClick = {
                                    if (selectedNoteUri != null) {
                                        // Dismiss selection if clicking elsewhere
                                        selectedNoteUri = null
                                    } else {
                                        onNoteSelected(note)
                                    }
                                },
                                onLongClick = {
                                    selectedNoteUri = note.uriString
                                }
                            )

                            // Show processing toolbar inline if selected
                            if (isSelected) {
                                Spacer(modifier = Modifier.height(4.dp))
                                InboxToolbar(
                                    note = note,
                                    lastUsedFolder = lastUsedFolder,
                                    existingFolders = existingFolders,
                                    onMove = { folder ->
                                        coroutineScope.launch {
                                            try {
                                                vaultManager.moveNote(note, folder, vaultUri)
                                                preferencesManager.saveLastUsedFolder(folder)
                                                selectedNoteUri = null
                                                refreshInbox()
                                            } catch (e: Exception) {
                                                e.printStackTrace()
                                                Toast.makeText(context, "Error moving file", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    },
                                    onDelete = {
                                        val deleted = vaultManager.deleteNote(note)
                                        if (deleted) {
                                            selectedNoteUri = null
                                            refreshInbox()
                                            Toast.makeText(context, "Note deleted", Toast.LENGTH_SHORT).show()
                                        } else {
                                            Toast.makeText(context, "Failed to delete note", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    modifier = Modifier.padding(horizontal = 4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        // Bottom Capture Bar
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color(0xFF000000))
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF121212), RoundedCornerShape(24.dp))
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = dumpText,
                    onValueChange = { dumpText = it },
                    placeholder = {
                        Text(
                            text = if (isRecording) "Recording voice thought..." else "Dump your thoughts...",
                            color = Color(0xFF64748B),
                            fontSize = 14.sp
                        )
                    },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        disabledContainerColor = Color.Transparent,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    singleLine = true,
                    enabled = !isRecording,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = {
                            if (dumpText.trim().isNotEmpty()) {
                                createDumpNote(context, vaultUri, vaultManager, dumpText)
                                dumpText = ""
                                refreshInbox()
                            }
                        }
                    ),
                    modifier = Modifier.weight(1f)
                )

                IconButton(
                    onClick = {
                        if (isRecording) {
                            // Stop recording and save note
                            audioRecorder.stop()
                            isRecording = false
                            saveVoiceNote(context, vaultUri, vaultManager, tempAudioFile)
                            refreshInbox()
                        } else {
                            // Check microphone permission
                            val audioPermission = ContextCompat.checkSelfPermission(
                                context, Manifest.permission.RECORD_AUDIO
                            )
                            if (audioPermission == PackageManager.PERMISSION_GRANTED) {
                                startRecording(context, audioRecorder, tempAudioFile)
                                isRecording = true
                            } else {
                                permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            }
                        }
                    }
                ) {
                    Icon(
                        imageVector = if (isRecording) Icons.Default.Stop else Icons.Default.Mic,
                        contentDescription = "Voice Capture",
                        tint = if (isRecording) Color(0xFFEF4444) else Color(0xFFF97316) // Red when recording, orange default
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun InboxNoteRow(
    note: NoteMetadata,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    val dateString = remember(note.modifiedTime) {
        val date = Date(note.modifiedTime)
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFF1E293B) else Color(0xFF121212) // Slate highlighted when active
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isSelected) Icons.Default.Check else Icons.Default.Edit,
                contentDescription = "Note Status",
                tint = if (isSelected) Color(0xFFF97316) else Color(0xFF475569),
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = note.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = note.filePath,
                    fontSize = 12.sp,
                    color = Color(0xFF64748B)
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = dateString,
                fontSize = 12.sp,
                color = Color(0xFF475569)
            )
        }
    }
}

private fun startRecording(context: Context, audioRecorder: AudioRecorder, tempFile: File) {
    try {
        if (tempFile.exists()) tempFile.delete()
        audioRecorder.start(tempFile)
        Toast.makeText(context, "Recording started...", Toast.LENGTH_SHORT).show()
    } catch (e: Exception) {
        e.printStackTrace()
        Toast.makeText(context, "Failed to start recording", Toast.LENGTH_SHORT).show()
    }
}

private fun saveVoiceNote(context: Context, rootUriString: String, vaultManager: VaultManager, tempFile: File) {
    try {
        if (!tempFile.exists() || tempFile.length() == 0L) {
            Toast.makeText(context, "Empty voice recording", Toast.LENGTH_SHORT).show()
            return
        }

        val rootUri = Uri.parse(rootUriString)
        val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: return
        val attachmentsDir = rootDir.findFile("Attachments") ?: rootDir.createDirectory("Attachments") ?: return

        // Save audio to SAF Attachments
        val dateString = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val audioFileName = "Voice_$dateString.m4a"
        val audioFile = attachmentsDir.createFile("audio/mp4", audioFileName) ?: return

        context.contentResolver.openOutputStream(audioFile.uri)?.use { output ->
            tempFile.inputStream().use { input ->
                input.copyTo(output)
            }
        }
        tempFile.delete()

        // Create Note referencing the audio file
        val noteTitle = "Voice Note $dateString"
        val markdownBody = "\n\n![Voice Note](Attachments/$audioFileName)\n"
        vaultManager.createNote(rootUriString, "Inbox", noteTitle, markdownBody)

        Toast.makeText(context, "Voice note saved to Inbox", Toast.LENGTH_SHORT).show()
    } catch (e: Exception) {
        e.printStackTrace()
        Toast.makeText(context, "Failed to save voice note", Toast.LENGTH_SHORT).show()
    }
}

private fun createDumpNote(context: Context, rootUriString: String, vaultManager: VaultManager, text: String) {
    try {
        val words = text.trim().split("\\s+".toRegex())
        val title = if (words.size > 3) {
            words.take(3).joinToString(" ") + "..."
        } else {
            text.trim()
        }
        vaultManager.createNote(rootUriString, "Inbox", title, text)
        Toast.makeText(context, "Note saved to Inbox", Toast.LENGTH_SHORT).show()
    } catch (e: Exception) {
        e.printStackTrace()
        Toast.makeText(context, "Failed to save note", Toast.LENGTH_SHORT).show()
    }
}
