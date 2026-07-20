package com.rushi.wrriter.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.displayTitle
import com.rushi.wrriter.data.isCompleted
import com.rushi.wrriter.data.VaultManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    vaultManager: VaultManager,
    vaultUri: String,
    onNoteSelected: (NoteMetadata) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var tasksList by remember { mutableStateOf(emptyList<NoteMetadata>()) }
    var selectedTab by remember { mutableStateOf("active") } // "active" or "completed"
    var isLoading by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var taskInputText by remember { mutableStateOf("") }

    val isIndexReady by vaultManager.isIndexReady.collectAsState()

    val refreshTasks = {
        isLoading = true
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val allNotes = vaultManager.getCachedNotes()
                val taskNotes = allNotes.filter { it.filePath.startsWith("Tasks") }
                withContext(Dispatchers.Main) {
                    tasksList = taskNotes
                    isLoading = false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                withContext(Dispatchers.Main) {
                    isLoading = false
                }
            }
        }
    }

    LaunchedEffect(isIndexReady) {
        if (isIndexReady) {
            refreshTasks()
        } else {
            isLoading = true
        }
    }

    val filteredTasks = remember(tasksList, selectedTab) {
        if (selectedTab == "active") {
            tasksList.filter { !it.isCompleted }
        } else {
            tasksList.filter { it.isCompleted }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF000000)) // OLED Black
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
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
                    text = "Tasks",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "${filteredTasks.size} items",
                    fontSize = 14.sp,
                    color = Color(0xFF64748B)
                )
            }

            // Tab Selector
            TabRow(
                selectedTabIndex = if (selectedTab == "active") 0 else 1,
                containerColor = Color(0xFF121212),
                contentColor = Color.White,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(tabPositions[if (selectedTab == "active") 0 else 1]),
                        color = Color(0xFF94A3B8) // Brand Slate Grey
                    )
                }
            ) {
                Tab(
                    selected = selectedTab == "active",
                    onClick = { selectedTab = "active" },
                    text = {
                        Text(
                            "Active",
                            fontWeight = FontWeight.Bold,
                            color = if (selectedTab == "active") Color(0xFF94A3B8) else Color(0xFF64748B)
                        )
                    }
                )
                Tab(
                    selected = selectedTab == "completed",
                    onClick = { selectedTab = "completed" },
                    text = {
                        Text(
                            "Completed",
                            fontWeight = FontWeight.Bold,
                            color = if (selectedTab == "completed") Color(0xFF94A3B8) else Color(0xFF64748B)
                        )
                    }
                )
            }

            // Task Content
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFF94A3B8))
                }
            } else if (filteredTasks.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (selectedTab == "active") "No active tasks found. Move notes here to set tasks." else "No completed tasks yet.",
                        fontSize = 14.sp,
                        color = Color(0xFF475569)
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredTasks, key = { it.uriString }) { note ->
                        TaskRowItem(
                            note = note,
                            onToggle = { isChecked ->
                                coroutineScope.launch(Dispatchers.IO) {
                                    try {
                                        vaultManager.toggleNoteComplete(note, isChecked)
                                        
                                        // Refresh
                                        val allNotes = vaultManager.getCachedNotes()
                                        val taskNotes = allNotes.filter { it.filePath.startsWith("Tasks") }
                                        withContext(Dispatchers.Main) {
                                            tasksList = taskNotes
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Failed to update task status", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            },
                            onClick = {
                                onNoteSelected(note)
                            }
                        )
                    }
                }
            }
        }

        // Floating Action Button to Add New Task
        FloatingActionButton(
            onClick = { showAddDialog = true },
            containerColor = Color(0xFF94A3B8), // Brand Slate Grey
            contentColor = Color.Black,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(24.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "Add Task"
            )
        }

        // Dialog for New Task Capture
        if (showAddDialog) {
            val focusRequester = remember { FocusRequester() }
            LaunchedEffect(Unit) {
                focusRequester.requestFocus()
            }
            AlertDialog(
                onDismissRequest = {
                    showAddDialog = false
                    taskInputText = ""
                },
                title = {
                    Text(
                        text = "New Task",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                },
                text = {
                    OutlinedTextField(
                        value = taskInputText,
                        onValueChange = { taskInputText = it },
                        placeholder = { Text("What needs to be done?", color = Color(0xFF64748B)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF94A3B8),
                            unfocusedBorderColor = Color(0xFF334155),
                            cursorColor = Color(0xFF94A3B8)
                        ),
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester)
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val taskText = taskInputText.trim()
                            if (taskText.isNotEmpty()) {
                                coroutineScope.launch(Dispatchers.IO) {
                                    try {
                                        vaultManager.createNote(vaultUri, "Tasks", taskText, "")
                                        val allNotes = vaultManager.getCachedNotes()
                                        val taskNotes = allNotes.filter { it.filePath.startsWith("Tasks") }
                                        withContext(Dispatchers.Main) {
                                            tasksList = taskNotes
                                            showAddDialog = false
                                            taskInputText = ""
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Failed to create task", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            }
                        },
                        enabled = taskInputText.trim().isNotEmpty()
                    ) {
                        Text(
                            text = "Add",
                            color = if (taskInputText.trim().isNotEmpty()) Color(0xFF94A3B8) else Color(0xFF475569),
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showAddDialog = false
                            taskInputText = ""
                        }
                    ) {
                        Text("Cancel", color = Color(0xFF64748B))
                    }
                },
                containerColor = Color(0xFF121212),
                shape = RoundedCornerShape(16.dp)
            )
        }
    }
}

@Composable
fun TaskRowItem(
    note: NoteMetadata,
    onToggle: (Boolean) -> Unit,
    onClick: () -> Unit
) {
    val isCompleted = note.isCompleted
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
            Checkbox(
                checked = isCompleted,
                onCheckedChange = onToggle,
                colors = CheckboxDefaults.colors(
                    checkedColor = Color(0xFF94A3B8),
                    uncheckedColor = Color(0xFF475569),
                    checkmarkColor = Color.Black
                )
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = note.displayTitle,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (isCompleted) Color(0xFF64748B) else Color.White,
                    textDecoration = if (isCompleted) TextDecoration.LineThrough else TextDecoration.None,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Assignment,
                        contentDescription = "Task Note",
                        tint = Color(0xFF475569),
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (isCompleted) "Completed Task" else "Active Task",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}
