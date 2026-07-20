package com.rushi.wrriter.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.VaultManager
import com.rushi.wrriter.ui.components.CalendarGrid
import java.text.SimpleDateFormat
import java.util.*
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun JournalScreen(
    modifier: Modifier = Modifier,
    vaultManager: VaultManager,
    vaultUri: String,
    onNoteSelected: (NoteMetadata) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var existingDates by remember { mutableStateOf(emptySet<String>()) }
    var journalNotes by remember { mutableStateOf(emptyList<NoteMetadata>()) }

    val refreshJournal = {
        try {
            existingDates = vaultManager.getExistingJournalDates()
            journalNotes = vaultManager.getCachedNotes()
                .filter { it.filePath == "Journal" }
                .sortedByDescending { it.fileName }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    val isIndexReady by vaultManager.isIndexReady.collectAsState()

    LaunchedEffect(isIndexReady) {
        if (isIndexReady) {
            refreshJournal()
        }
    }

    Box(
        modifier = modifier
            .background(Color(0xFF000000)) // OLED Black
    ) {
        if (journalNotes.isEmpty() && !isIndexReady) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color(0xFF94A3B8))
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                contentPadding = PaddingValues(top = 24.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Daily Journal",
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "${journalNotes.size} entries",
                            fontSize = 14.sp,
                            color = Color(0xFF64748B)
                        )
                    }
                }

                // Calendar Card
                item {
                    CalendarGrid(
                        existingJournalDates = existingDates,
                        onDateSelected = { dateString ->
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    val note = vaultManager.getOrCreateDailyJournalNote(vaultUri, dateString)
                                    withContext(Dispatchers.Main) {
                                        onNoteSelected(note)
                                    }
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                    withContext(Dispatchers.Main) {
                                        Toast.makeText(context, "Failed to load/create journal note", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        }
                    )
                }

                // Subheader
                item {
                    Text(
                        text = "Journal Entries",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                // Entries List
                if (journalNotes.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(150.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No entries yet. Select a date above to start writing.",
                                fontSize = 14.sp,
                                color = Color(0xFF475569),
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }
                } else {
                    items(journalNotes, key = { it.uriString }) { note ->
                        JournalNoteRow(
                            note = note,
                            onClick = { onNoteSelected(note) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun JournalNoteRow(
    note: NoteMetadata,
    onClick: () -> Unit
) {
    val displayDate = remember(note.fileName) {
        val baseName = note.fileName.removeSuffix(".md")
        try {
            val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(baseName)
            if (date != null) {
                SimpleDateFormat("EEEE, MMMM dd, yyyy", Locale.getDefault()).format(date)
            } else {
                baseName
            }
        } catch (e: Exception) {
            baseName
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF121212)
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Book,
                contentDescription = "Journal Entry",
                tint = Color(0xFF94A3B8),
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = displayDate,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                val wordsLabel = if (note.wordCount == 1) "1 word" else "${note.wordCount} words"
                Text(
                    text = wordsLabel,
                    fontSize = 12.sp,
                    color = Color(0xFF64748B)
                )
            }
        }
    }
}
