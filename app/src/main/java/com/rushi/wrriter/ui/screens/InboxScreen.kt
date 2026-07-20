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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import com.rushi.wrriter.data.AudioRecorder
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.baseFolder
import com.rushi.wrriter.data.isCompleted
import com.rushi.wrriter.data.displayTitle
import com.rushi.wrriter.data.PreferencesManager
import com.rushi.wrriter.data.VaultManager
import com.rushi.wrriter.ui.components.InboxToolbar
import com.rushi.wrriter.ui.components.SearchBar
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    modifier: Modifier = Modifier,
    vaultManager: VaultManager,
    vaultUri: String,
    preferencesManager: PreferencesManager,
    onNoteSelected: (NoteMetadata) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var notesList by remember { mutableStateOf(emptyList<NoteMetadata>()) }
    var dumpText by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }
    var debouncedSearchQuery by remember { mutableStateOf("") }
    var selectedFolder by remember { mutableStateOf("Inbox") }
    var showFolderDropdown by remember { mutableStateOf(false) }

    val isIndexReady by vaultManager.isIndexReady.collectAsState()

    LaunchedEffect(searchQuery) {
        kotlinx.coroutines.delay(300)
        debouncedSearchQuery = searchQuery
    }
    
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

    // Refresh inbox lists and configs from memory cache (instant, zero disk I/O)
    val refreshInbox = {
        try {
            existingFolders = vaultManager.getCachedNotes().map { it.baseFolder }.distinct()
            coroutineScope.launch {
                lastUsedFolder = preferencesManager.lastUsedFolderFlow.first()
            }
            coroutineScope.launch(Dispatchers.IO) {
                val list = if (debouncedSearchQuery.trim().isEmpty()) {
                    vaultManager.getCachedNotes()
                        .filter { it.baseFolder.equals(selectedFolder, ignoreCase = true) }
                        .sortedWith(compareBy<NoteMetadata> { it.isCompleted }.thenByDescending { it.modifiedTime })
                } else {
                    vaultManager.searchNotes(debouncedSearchQuery)
                        .sortedWith(compareBy<NoteMetadata> { it.isCompleted }.thenByDescending { it.modifiedTime })
                }
                withContext(Dispatchers.Main) {
                    notesList = list
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Fast memory-cache-only refresh when query or folder chip selection changes, or index is ready
    LaunchedEffect(debouncedSearchQuery, selectedFolder, isIndexReady) {
        if (isIndexReady) {
            refreshInbox()
        }
    }

    Column(
        modifier = modifier
            .background(Color(0xFF000000)) // OLED Black
            .imePadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Box {
                    Row(
                        modifier = Modifier.clickable { showFolderDropdown = true },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (debouncedSearchQuery.trim().isEmpty()) selectedFolder else "Search Results",
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        if (debouncedSearchQuery.trim().isEmpty()) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = "Select Folder",
                                tint = Color.White,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }
                    
                    DropdownMenu(
                        expanded = showFolderDropdown,
                        onDismissRequest = { showFolderDropdown = false },
                        modifier = Modifier.background(Color(0xFF121212))
                    ) {
                        val allFolders = (listOf("Inbox", "Later", "Read", "Shop", "Watch", "Journal") + existingFolders)
                            .distinct()
                            .filter { 
                                it.isNotEmpty() && 
                                it != "Attachments" && 
                                it != "Tasks" && 
                                it != "Tasks/Completed" && 
                                !it.endsWith("/Completed") && 
                                !it.startsWith(".") && 
                                !it.contains("/.")
                            }
                            .sorted()
                            
                        allFolders.forEach { folder ->
                            DropdownMenuItem(
                                text = { Text(folder, color = Color.White) },
                                onClick = {
                                    selectedFolder = folder
                                    showFolderDropdown = false
                                    refreshInbox()
                                }
                            )
                        }
                    }
                }
                val activeCount = notesList.count { !it.isCompleted }
                val completedCount = notesList.count { it.isCompleted }
                Text(
                    text = if (completedCount > 0) "$activeCount active · $completedCount done" else "$activeCount notes",
                    fontSize = 14.sp,
                    color = Color(0xFF64748B) // Muted slate
                )
            }

            // Search Bar Filter Header
            SearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 12.dp),
                placeholderText = "Search titles, tags, or content..."
            )

            // Horizontal Scrollable Folders Chip Row
            if (debouncedSearchQuery.trim().isEmpty()) {
                val allFolders = remember(existingFolders) {
                    (listOf("Inbox", "Later", "Read", "Shop", "Watch", "Journal") + existingFolders)
                        .distinct()
                        .filter { 
                            it.isNotEmpty() && 
                            it != "Attachments" && 
                            it != "Tasks" && 
                            it != "Tasks/Completed" && 
                            !it.endsWith("/Completed") && 
                            !it.startsWith(".") && 
                            !it.contains("/.")
                        }
                        .sortedWith(Comparator { o1, o2 ->
                            if (o1 == "Inbox") -1 else if (o2 == "Inbox") 1 else o1.compareTo(o2)
                        })
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 12.dp)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    allFolders.forEach { folder ->
                        val isSelected = selectedFolder.equals(folder, ignoreCase = true)
                        SuggestionChip(
                            onClick = {
                                selectedFolder = folder
                                refreshInbox()
                            },
                            label = { Text(folder, fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                containerColor = if (isSelected) Color(0xFF94A3B8) else Color(0xFF121212),
                                labelColor = if (isSelected) Color.Black else Color.White
                            ),
                            border = SuggestionChipDefaults.suggestionChipBorder(
                                enabled = true,
                                borderColor = if (isSelected) Color.Transparent else Color(0xFF334155),
                                borderWidth = 1.dp
                            ),
                            shape = RoundedCornerShape(16.dp)
                        )
                    }
                }
            }

            // Notes list or loader
            if (notesList.isEmpty() && !isIndexReady) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFF94A3B8))
                }
            } else if (notesList.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (debouncedSearchQuery.trim().isEmpty()) "Clean slate. Dump your thoughts below." else "No notes match your search.",
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
                            val showCheckbox = note.baseFolder != "Inbox" && note.baseFolder != "Journal" && !note.baseFolder.startsWith("Journal/")
                            InboxNoteRow(
                                note = note,
                                isSelected = isSelected,
                                showCheckbox = showCheckbox,
                                isCompleted = note.isCompleted,
                                onToggleCompleted = { isChecked ->
                                    coroutineScope.launch(Dispatchers.IO) {
                                        try {
                                            vaultManager.toggleNoteComplete(note, isChecked)
                                            refreshInbox()
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                            withContext(Dispatchers.Main) {
                                                Toast.makeText(context, "Failed to update note status", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                },
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
                                val textToSave = dumpText
                                dumpText = ""
                                createDumpNote(context, vaultUri, vaultManager, textToSave, selectedFolder, coroutineScope, onComplete = {
                                    refreshInbox()
                                })
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
                            saveVoiceNote(context, vaultUri, vaultManager, tempAudioFile, selectedFolder, coroutineScope, onComplete = {
                                refreshInbox()
                            })
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
                        tint = if (isRecording) Color(0xFFEF4444) else Color(0xFF94A3B8) // Red when recording, grey default
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
    showCheckbox: Boolean,
    isCompleted: Boolean,
    onToggleCompleted: (Boolean) -> Unit,
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
            if (showCheckbox) {
                Checkbox(
                    checked = isCompleted,
                    onCheckedChange = onToggleCompleted,
                    colors = CheckboxDefaults.colors(
                        checkedColor = Color(0xFF94A3B8),
                        uncheckedColor = Color(0xFF475569),
                        checkmarkColor = Color.Black
                    ),
                    modifier = Modifier.size(20.dp)
                )
            } else {
                Icon(
                    imageVector = if (isSelected) Icons.Default.Check else Icons.Default.Edit,
                    contentDescription = "Note Status",
                    tint = if (isSelected) Color(0xFF94A3B8) else Color(0xFF475569),
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = note.displayTitle,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (showCheckbox && isCompleted) Color(0xFF64748B) else Color.White,
                    textDecoration = if (showCheckbox && isCompleted) TextDecoration.LineThrough else TextDecoration.None,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = note.baseFolder,
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

private fun saveVoiceNote(
    context: Context,
    rootUriString: String,
    vaultManager: VaultManager,
    tempFile: java.io.File,
    folderName: String,
    coroutineScope: CoroutineScope,
    onComplete: () -> Unit
) {
    coroutineScope.launch(Dispatchers.IO) {
        try {
            if (!tempFile.exists() || tempFile.length() == 0L) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Empty voice recording", Toast.LENGTH_SHORT).show()
                }
                return@launch
            }

            val rootUri = Uri.parse(rootUriString)
            val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: return@launch
            val attachmentsDir = rootDir.findFile("Attachments") ?: rootDir.createDirectory("Attachments") ?: return@launch

            // Save audio to SAF Attachments
            val dateString = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val audioFileName = "Voice_$dateString.m4a"
            val audioFile = attachmentsDir.createFile("audio/mp4", audioFileName) ?: return@launch

            context.contentResolver.openOutputStream(audioFile.uri)?.use { output ->
                tempFile.inputStream().use { input ->
                    input.copyTo(output)
                }
            }
            tempFile.delete()

            // Create Note referencing the audio file
            val noteTitle = "Voice Note $dateString"
            val markdownBody = "\n\n![Voice Note](Attachments/$audioFileName)\n"
            vaultManager.createNote(rootUriString, folderName, noteTitle, markdownBody)

            withContext(Dispatchers.Main) {
                Toast.makeText(context, "Voice note saved to $folderName", Toast.LENGTH_SHORT).show()
                onComplete()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            withContext(Dispatchers.Main) {
                Toast.makeText(context, "Failed to save voice note", Toast.LENGTH_SHORT).show()
            }
        }
    }
}

private fun createDumpNote(
    context: Context,
    rootUriString: String,
    vaultManager: VaultManager,
    text: String,
    folderName: String,
    coroutineScope: CoroutineScope,
    onComplete: () -> Unit
) {
    coroutineScope.launch(Dispatchers.IO) {
        try {
            val words = text.trim().split("\\s+".toRegex())
            val title = if (words.size > 3) {
                words.take(3).joinToString(" ") + "..."
            } else {
                text.trim()
            }
            vaultManager.createNote(rootUriString, folderName, title, text)
            withContext(Dispatchers.Main) {
                Toast.makeText(context, "Note saved to $folderName", Toast.LENGTH_SHORT).show()
                onComplete()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            withContext(Dispatchers.Main) {
                Toast.makeText(context, "Failed to save note", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
