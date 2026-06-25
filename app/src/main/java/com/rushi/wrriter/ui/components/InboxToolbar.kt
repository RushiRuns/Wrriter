package com.rushi.wrriter.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.rushi.wrriter.data.NoteMetadata

@Composable
fun InboxToolbar(
    note: NoteMetadata,
    lastUsedFolder: String,
    existingFolders: List<String>,
    onMove: (String) -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showFolderDialog by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF1E1E1E), RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Orange Shortcut button: Moves note to last used folder
        Button(
            onClick = { onMove(lastUsedFolder) },
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFF97316), // Brand orange
                contentColor = Color.Black
            ),
            shape = RoundedCornerShape(8.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
            modifier = Modifier.padding(end = 4.dp)
        ) {
            Text(
                text = "→ $lastUsedFolder",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // Folder Icon: Custom Folder Selector
        IconButton(onClick = { showFolderDialog = true }) {
            Icon(Icons.Default.FolderOpen, "Move to Folder", tint = Color.White)
        }

        // Clock Icon: /Later
        IconButton(onClick = { onMove("Later") }) {
            Icon(Icons.Default.Schedule, "Move to Later", tint = Color.White)
        }

        // Book Icon: /Read
        IconButton(onClick = { onMove("Read") }) {
            Icon(Icons.Default.Book, "Move to Read", tint = Color.White)
        }

        // Shopping Cart Icon: /Shop
        IconButton(onClick = { onMove("Shop") }) {
            Icon(Icons.Default.ShoppingCart, "Move to Shop", tint = Color.White)
        }

        // TV Icon: /Watch
        IconButton(onClick = { onMove("Watch") }) {
            Icon(Icons.Default.Tv, "Move to Watch", tint = Color.White)
        }

        // Heart Icon: /Journal
        IconButton(onClick = { onMove("Journal") }) {
            Icon(Icons.Default.Favorite, "Move to Journal", tint = Color.White)
        }

        // Trash Icon: Delete
        IconButton(onClick = onDelete) {
            Icon(Icons.Default.Delete, "Delete", tint = Color(0xFFEF4444))
        }
    }

    if (showFolderDialog) {
        FolderPickerDialog(
            existingFolders = existingFolders,
            onFolderSelected = { folder ->
                onMove(folder)
                showFolderDialog = false
            },
            onDismiss = { showFolderDialog = false }
        )
    }
}

@Composable
fun FolderPickerDialog(
    existingFolders: List<String>,
    onFolderSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var newFolderPath by remember { mutableStateOf("") }
    
    // Filter folders to display (excluding Attachments and defaults)
    val filteredFolders = existingFolders.filter { 
        it !in listOf("Inbox", "Later", "Read", "Shop", "Watch", "Journal", "Attachments")
    }.distinct()

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1E1E)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth()
            ) {
                Text(
                    text = "Select Destination Folder",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                // Input for creating a new folder (supports nested folders like Work/Projects)
                TextField(
                    value = newFolderPath,
                    onValueChange = { newFolderPath = it },
                    placeholder = { Text("Create new folder path (e.g. Work/2026)", color = Color(0xFF64748B)) },
                    colors = TextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = Color(0xFF121212),
                        unfocusedContainerColor = Color(0xFF121212)
                    ),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                
                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = {
                        if (newFolderPath.trim().isNotEmpty()) {
                            onFolderSelected(newFolderPath.trim())
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF97316)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("Create & Move", color = Color.Black)
                }

                Spacer(modifier = Modifier.height(16.dp))
                Divider(color = Color(0xFF334155))
                Spacer(modifier = Modifier.height(16.dp))

                // Scrollable List of existing folders
                if (filteredFolders.isEmpty()) {
                    Text(
                        text = "No custom folders yet.",
                        color = Color(0xFF64748B),
                        fontSize = 14.sp,
                        modifier = Modifier.padding(vertical = 12.dp)
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .heightIn(max = 200.dp)
                            .fillMaxWidth()
                    ) {
                        items(filteredFolders) { folder ->
                            Text(
                                text = folder,
                                color = Color.White,
                                fontSize = 15.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onFolderSelected(folder) }
                                    .padding(vertical = 12.dp, horizontal = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
