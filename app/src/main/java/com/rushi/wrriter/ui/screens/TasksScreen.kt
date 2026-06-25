package com.rushi.wrriter.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
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
import com.rushi.wrriter.data.TaskItem
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

    var tasksList by remember { mutableStateOf(emptyList<TaskItem>()) }
    var selectedTab by remember { mutableStateOf("active") } // "active" or "completed"
    var isLoading by remember { mutableStateOf(true) }

    val refreshTasks = {
        isLoading = true
        coroutineScope.launch(Dispatchers.IO) {
            try {
                vaultManager.rebuildCache(vaultUri)
                val allTasks = vaultManager.getAllTasks()
                withContext(Dispatchers.Main) {
                    tasksList = allTasks
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

    LaunchedEffect(vaultUri) {
        refreshTasks()
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
                    text = "Aggregated Tasks",
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
                    TabRowDefaults.Indicator(
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
                        text = if (selectedTab == "active") "No active tasks found in your notes." else "No completed tasks yet.",
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
                    items(filteredTasks, key = { "${it.sourceNoteUri}_${it.lineIndex}_${it.rawText}" }) { task ->
                        TaskRowItem(
                            task = task,
                            onToggle = { isChecked ->
                                coroutineScope.launch(Dispatchers.IO) {
                                    val success = vaultManager.updateTaskCompletion(task, isChecked)
                                    withContext(Dispatchers.Main) {
                                        if (success) {
                                            // Re-fetch all tasks to refresh UI
                                            val allTasks = vaultManager.getAllTasks()
                                            tasksList = allTasks
                                        } else {
                                            Toast.makeText(context, "Failed to update task", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            },
                            onClick = {
                                val notes = vaultManager.getCachedNotes()
                                val note = notes.firstOrNull { it.uriString == task.sourceNoteUri }
                                if (note != null) {
                                    onNoteSelected(note)
                                } else {
                                    Toast.makeText(context, "Source note not found", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TaskRowItem(
    task: TaskItem,
    onToggle: (Boolean) -> Unit,
    onClick: () -> Unit
) {
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
                checked = task.isCompleted,
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
                    text = task.description,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (task.isCompleted) Color(0xFF64748B) else Color.White,
                    textDecoration = if (task.isCompleted) TextDecoration.LineThrough else TextDecoration.None,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Assignment,
                        contentDescription = "Source Note",
                        tint = Color(0xFF475569),
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = task.sourceNoteTitle,
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
