package com.rushi.wrriter.data

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.*

class VaultManager(private val context: Context) {

    private val contentResolver: ContentResolver = context.contentResolver

    // Transient in-memory index cache of all notes in the vault
    private val noteCache = mutableMapOf<String, NoteMetadata>()

    // ISO 8601 Date formatter
    private val isoFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.getDefault())

    /**
     * Initializes default folders under the root vault URI.
     */
    fun initializeDefaultFolders(rootUriString: String): Boolean {
        val rootUri = Uri.parse(rootUriString)
        val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: return false
        if (!rootDir.exists() || !rootDir.isDirectory) return false

        val defaults = listOf("Inbox", "Later", "Read", "Shop", "Watch", "Journal", "Attachments")
        var success = true

        for (folder in defaults) {
            val existing = rootDir.findFile(folder)
            if (existing == null) {
                val created = rootDir.createDirectory(folder)
                if (created == null) {
                    success = false
                }
            }
        }
        return success
    }

    /**
     * Rebuilds the in-memory cache of note metadata by scanning all files in the vault.
     */
    fun rebuildCache(rootUriString: String) {
        synchronized(noteCache) {
            noteCache.clear()
            val rootUri = Uri.parse(rootUriString)
            val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: return
            scanDirectory(rootDir, "", rootUri)
        }
    }

    private fun scanDirectory(dir: DocumentFile, relativePath: String, rootUri: Uri) {
        val files = dir.listFiles()
        for (file in files) {
            if (file.isDirectory) {
                val folderName = file.name ?: continue
                // Exclude Attachments from note scanning
                if (folderName == "Attachments") continue
                val nextRelativePath = if (relativePath.isEmpty()) folderName else "$relativePath/$folderName"
                scanDirectory(file, nextRelativePath, rootUri)
            } else if (file.isFile && file.name?.endsWith(".md") == true) {
                try {
                    val metadata = loadMetadata(file, relativePath)
                    noteCache[file.uri.toString()] = metadata
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    /**
     * Gets all cached notes.
     */
    fun getCachedNotes(): List<NoteMetadata> {
        synchronized(noteCache) {
            return noteCache.values.toList()
        }
    }

    /**
     * Gets all cached notes in the Inbox.
     */
    fun getInboxNotes(): List<NoteMetadata> {
        synchronized(noteCache) {
            return noteCache.values.filter { it.isInbox }.toList()
        }
    }

    /**
     * Loads note content and parses metadata.
     * Returns a Pair of parsed NoteMetadata and the note body (excluding frontmatter).
     */
    fun loadNote(fileUriString: String): Pair<NoteMetadata, String> {
        val fileUri = Uri.parse(fileUriString)
        val file = DocumentFile.fromSingleUri(context, fileUri) ?: throw Exception("File not found")
        
        val inputStream = contentResolver.openInputStream(fileUri) ?: throw Exception("Cannot open file stream")
        val reader = BufferedReader(InputStreamReader(inputStream))
        val rawText = reader.use { it.readText() }

        val (frontmatterMap, body) = parseFrontmatter(rawText)
        
        // Derive folder path
        val parentFile = file.parentFile
        val relativePath = parentFile?.name ?: "" // Fallback

        val title = frontmatterMap["title"] as? String ?: file.name?.removeSuffix(".md") ?: "Untitled"
        val tags = (frontmatterMap["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
        val createdStr = frontmatterMap["created"] as? String
        val modifiedStr = frontmatterMap["modified"] as? String
        val isInbox = frontmatterMap["inbox"] as? Boolean ?: (relativePath == "Inbox")

        val createdTime = createdStr?.let { parseIsoDate(it) } ?: file.lastModified()
        val modifiedTime = modifiedStr?.let { parseIsoDate(it) } ?: file.lastModified()
        val wordCount = countWords(body)

        val metadata = NoteMetadata(
            uriString = fileUriString,
            filePath = relativePath,
            fileName = file.name ?: "",
            title = title,
            tags = tags,
            createdTime = createdTime,
            modifiedTime = modifiedTime,
            isInbox = isInbox,
            wordCount = wordCount
        )

        // Update cache
        synchronized(noteCache) {
            noteCache[fileUriString] = metadata
        }

        return Pair(metadata, body)
    }

    /**
     * Saves a note (both metadata and body) atomically to the local filesystem.
     */
    fun saveNote(
        fileUriString: String,
        title: String,
        tags: List<String>,
        isInbox: Boolean,
        body: String
    ): NoteMetadata {
        val fileUri = Uri.parse(fileUriString)
        val file = DocumentFile.fromSingleUri(context, fileUri) ?: throw Exception("File not found")

        val existingMetadata = synchronized(noteCache) { noteCache[fileUriString] }
        val createdTime = existingMetadata?.createdTime ?: System.currentTimeMillis()
        val modifiedTime = System.currentTimeMillis()
        val relativePath = existingMetadata?.filePath ?: ""

        val metadata = NoteMetadata(
            uriString = fileUriString,
            filePath = relativePath,
            fileName = file.name ?: "",
            title = title,
            tags = tags,
            createdTime = createdTime,
            modifiedTime = modifiedTime,
            isInbox = isInbox,
            wordCount = countWords(body)
        )

        // Serialize frontmatter
        val serializedContent = serializeFrontmatter(metadata, body)

        // Write directly to file
        val outputStream: OutputStream = contentResolver.openOutputStream(fileUri, "wt")
            ?: throw Exception("Cannot open write stream")
        outputStream.use { it.write(serializedContent.toByteArray()) }

        // Update Cache
        synchronized(noteCache) {
            noteCache[fileUriString] = metadata
        }

        return metadata
    }

    /**
     * Creates a new note in a specific folder.
     */
    fun createNote(rootUriString: String, folderName: String, title: String, body: String = ""): NoteMetadata {
        val rootUri = Uri.parse(rootUriString)
        val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: throw Exception("Root vault invalid")
        
        val folder = rootDir.findFile(folderName) ?: rootDir.createDirectory(folderName)
        ?: throw Exception("Failed to access folder $folderName")

        val safeTitle = title.replace("[\\\\/:*?\"<>|]".toRegex(), "_")
        val fileName = "$safeTitle.md"
        
        val file = folder.createFile("text/markdown", fileName)
            ?: throw Exception("Failed to create file $fileName")

        val createdTime = System.currentTimeMillis()
        val metadata = NoteMetadata(
            uriString = file.uri.toString(),
            filePath = folderName,
            fileName = file.name ?: fileName,
            title = title,
            tags = emptyList(),
            createdTime = createdTime,
            modifiedTime = createdTime,
            isInbox = (folderName == "Inbox"),
            wordCount = countWords(body)
        )

        val serializedContent = serializeFrontmatter(metadata, body)
        val outputStream = contentResolver.openOutputStream(file.uri) ?: throw Exception("Cannot open write stream")
        outputStream.use { it.write(serializedContent.toByteArray()) }

        synchronized(noteCache) {
            noteCache[file.uri.toString()] = metadata
        }

        return metadata
    }

    /**
     * Moves a note from its current folder to a target folder using SAF.
     */
    fun moveNote(note: NoteMetadata, targetFolderName: String, rootUriString: String): NoteMetadata {
        val rootUri = Uri.parse(rootUriString)
        val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: throw Exception("Root vault invalid")
        
        val fileUri = Uri.parse(note.uriString)
        val file = DocumentFile.fromSingleUri(context, fileUri) ?: throw Exception("Note file not found")
        val currentFolder = rootDir.findFile(note.filePath) ?: throw Exception("Current folder not found")
        val targetFolder = rootDir.findFile(targetFolderName) ?: rootDir.createDirectory(targetFolderName)
        ?: throw Exception("Target folder could not be accessed")

        val sourceDocumentUri = file.uri
        val sourceParentUri = currentFolder.uri
        val targetParentUri = targetFolder.uri

        // Execute SAF Move
        val newUri = DocumentsContract.moveDocument(
            contentResolver,
            sourceDocumentUri,
            sourceParentUri,
            targetParentUri
        ) ?: throw Exception("Failed to move file via documents contract")

        // Update metadata
        val updatedMetadata = note.copy(
            uriString = newUri.toString(),
            filePath = targetFolderName,
            isInbox = (targetFolderName == "Inbox")
        )

        // Rewrite frontmatter to update the metadata tags
        val (_, body) = loadNote(newUri.toString())
        saveNote(
            fileUriString = newUri.toString(),
            title = updatedMetadata.title,
            tags = updatedMetadata.tags,
            isInbox = updatedMetadata.isInbox,
            body = body
        )

        synchronized(noteCache) {
            noteCache.remove(note.uriString)
            noteCache[newUri.toString()] = updatedMetadata
        }

        return updatedMetadata
    }

    /**
     * Deletes a note.
     */
    fun deleteNote(note: NoteMetadata): Boolean {
        val fileUri = Uri.parse(note.uriString)
        val file = DocumentFile.fromSingleUri(context, fileUri) ?: return false
        val deleted = file.delete()
        if (deleted) {
            synchronized(noteCache) {
                noteCache.remove(note.uriString)
            }
        }
        return deleted
    }

    // --- Helpers for Frontmatter Parsing and Serialization ---

    private fun loadMetadata(file: DocumentFile, relativePath: String): NoteMetadata {
        val inputStream = contentResolver.openInputStream(file.uri) ?: throw Exception("Cannot open file stream")
        val reader = BufferedReader(InputStreamReader(inputStream))
        val rawText = reader.use { it.readText() }

        val (frontmatterMap, body) = parseFrontmatter(rawText)

        val title = frontmatterMap["title"] as? String ?: file.name?.removeSuffix(".md") ?: "Untitled"
        val tags = (frontmatterMap["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
        val createdStr = frontmatterMap["created"] as? String
        val modifiedStr = frontmatterMap["modified"] as? String
        val isInbox = frontmatterMap["inbox"] as? Boolean ?: (relativePath == "Inbox")

        val createdTime = createdStr?.let { parseIsoDate(it) } ?: file.lastModified()
        val modifiedTime = modifiedStr?.let { parseIsoDate(it) } ?: file.lastModified()
        val wordCount = countWords(body)

        return NoteMetadata(
            uriString = file.uri.toString(),
            filePath = relativePath,
            fileName = file.name ?: "",
            title = title,
            tags = tags,
            createdTime = createdTime,
            modifiedTime = modifiedTime,
            isInbox = isInbox,
            wordCount = wordCount
        )
    }

    fun parseFrontmatter(rawContent: String): Pair<Map<String, Any>, String> {
        val metadata = mutableMapOf<String, Any>()
        var body = rawContent

        if (rawContent.startsWith("---")) {
            val lines = rawContent.split("\n")
            val frontmatterLines = mutableListOf<String>()
            var endIdx = -1

            for (i in 1 until lines.size) {
                if (lines[i].trim() == "---") {
                    endIdx = i
                    break
                }
                frontmatterLines.add(lines[i])
            }

            if (endIdx != -1) {
                body = lines.subList(endIdx + 1, lines.size).joinToString("\n")
                var currentListKey: String? = null
                var listAccumulator = mutableListOf<String>()

                for (line in frontmatterLines) {
                    val trimmed = line.trim()
                    if (trimmed.isEmpty()) continue

                    // Check if starting list item
                    if (trimmed.startsWith("-") && currentListKey != null) {
                        val value = trimmed.removePrefix("-").trim().removeSurrounding("\"").removeSurrounding("'")
                        listAccumulator.add(value)
                        continue
                    } else if (currentListKey != null) {
                        // Finished list parsing
                        metadata[currentListKey] = listAccumulator
                        currentListKey = null
                    }

                    if (trimmed.contains(":")) {
                        val parts = trimmed.split(":", limit = 2)
                        val key = parts[0].trim()
                        val valueStr = parts[1].trim()

                        if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
                            // Parse inline list
                            val listValues = valueStr.removePrefix("[").removeSuffix("]")
                                .split(",")
                                .map { it.trim().removeSurrounding("\"").removeSurrounding("'") }
                                .filter { it.isNotEmpty() }
                            metadata[key] = listValues
                        } else if (valueStr.isEmpty()) {
                            // Might be a bullet list starting on the next line
                            currentListKey = key
                            listAccumulator = mutableListOf()
                        } else {
                            // Simple key-value
                            val finalValue = valueStr.removeSurrounding("\"").removeSurrounding("'")
                            val boolVal = finalValue.lowercase().toBooleanStrictOrNull()
                            if (boolVal != null) {
                                metadata[key] = boolVal
                            } else {
                                metadata[key] = finalValue
                            }
                        }
                    }
                }
                // Flush trailing list if any
                if (currentListKey != null) {
                    metadata[currentListKey] = listAccumulator
                }
            }
        }
        return Pair(metadata, body)
    }

    fun serializeFrontmatter(metadata: NoteMetadata, body: String): String {
        val sb = StringBuilder()
        sb.append("---\n")
        sb.append("title: \"${metadata.title.replace("\"", "\\\"")}\"\n")
        
        if (metadata.tags.isNotEmpty()) {
            sb.append("tags:\n")
            for (tag in metadata.tags) {
                sb.append("  - \"$tag\"\n")
            }
        } else {
            sb.append("tags: []\n")
        }

        sb.append("created: \"${formatIsoDate(metadata.createdTime)}\"\n")
        sb.append("modified: \"${formatIsoDate(metadata.modifiedTime)}\"\n")
        sb.append("inbox: ${metadata.isInbox}\n")
        sb.append("---\n")
        sb.append(body)
        return sb.toString()
    }

    private fun formatIsoDate(timeMs: Long): String {
        return isoFormatter.format(Date(timeMs))
    }

    private fun parseIsoDate(isoStr: String): Long {
        return try {
            isoFormatter.parse(isoStr)?.time ?: System.currentTimeMillis()
        } catch (e: Exception) {
            System.currentTimeMillis()
        }
    }

    private fun countWords(text: String): Int {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return 0
        return trimmed.split("\\s+".toRegex()).size
    }

    /**
     * Gets an existing journal note or creates a new one for the specified date string (YYYY-MM-DD) under the Journal folder.
     */
    fun getOrCreateDailyJournalNote(rootUriString: String, dateString: String): NoteMetadata {
        synchronized(noteCache) {
            val existing = noteCache.values.firstOrNull {
                it.filePath == "Journal" && it.fileName == "$dateString.md"
            }
            if (existing != null) {
                return existing
            }
        }

        val rootUri = Uri.parse(rootUriString)
        val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: throw Exception("Root vault invalid")
        val journalFolder = rootDir.findFile("Journal") ?: rootDir.createDirectory("Journal")
            ?: throw Exception("Failed to access/create Journal folder")

        val fileName = "$dateString.md"
        val existingFile = journalFolder.findFile(fileName)
        if (existingFile != null) {
            val metadata = loadMetadata(existingFile, "Journal")
            synchronized(noteCache) {
                noteCache[existingFile.uri.toString()] = metadata
            }
            return metadata
        }

        val createdTime = System.currentTimeMillis()
        val file = journalFolder.createFile("text/markdown", fileName)
            ?: throw Exception("Failed to create journal file $fileName")

        val metadata = NoteMetadata(
            uriString = file.uri.toString(),
            filePath = "Journal",
            fileName = file.name ?: fileName,
            title = dateString,
            tags = listOf("journal"),
            createdTime = createdTime,
            modifiedTime = createdTime,
            isInbox = false,
            wordCount = 0
        )

        val body = "# Journal - $dateString\n\n"
        val serialized = serializeFrontmatter(metadata, body)
        val outputStream = contentResolver.openOutputStream(file.uri) ?: throw Exception("Cannot open write stream")
        outputStream.use { it.write(serialized.toByteArray()) }

        synchronized(noteCache) {
            noteCache[file.uri.toString()] = metadata
        }

        return metadata
    }

    /**
     * Retrieves all dates (YYYY-MM-DD strings) for which a journal entry exists.
     */
    fun getExistingJournalDates(): Set<String> {
        val dateRegex = """^\d{4}-\d{2}-\d{2}$""".toRegex()
        synchronized(noteCache) {
            return noteCache.values
                .filter { it.filePath == "Journal" }
                .map { it.fileName.removeSuffix(".md") }
                .filter { dateRegex.matches(it) }
                .toSet()
        }
    }

    /**
     * Scans all note files in the cache for checklist task items (- [ ] / - [x]).
     */
    fun getAllTasks(): List<TaskItem> {
        val tasks = mutableListOf<TaskItem>()
        val notes = getCachedNotes()
        val taskRegex = """^\s*[-*]\s+\[([ xX])\]\s+(.*)$""".toRegex()

        for (note in notes) {
            try {
                val fileUri = Uri.parse(note.uriString)
                val inputStream = contentResolver.openInputStream(fileUri) ?: continue
                val reader = BufferedReader(InputStreamReader(inputStream))
                val lines = reader.use { it.readLines() }

                var frontmatterEndIndex = -1
                if (lines.isNotEmpty() && lines[0].trim() == "---") {
                    for (i in 1 until lines.size) {
                        if (lines[i].trim() == "---") {
                            frontmatterEndIndex = i
                            break
                        }
                    }
                }

                val startLineIndex = if (frontmatterEndIndex != -1) frontmatterEndIndex + 1 else 0

                for (i in startLineIndex until lines.size) {
                    val line = lines[i]
                    val match = taskRegex.matchEntire(line)
                    if (match != null) {
                        val statusChar = match.groupValues[1]
                        val description = match.groupValues[2].trim()
                        val isCompleted = statusChar.lowercase() == "x"

                        tasks.add(
                            TaskItem(
                                sourceNoteUri = note.uriString,
                                sourceNoteTitle = note.title,
                                description = description,
                                isCompleted = isCompleted,
                                lineIndex = i,
                                rawText = line
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return tasks
    }

    /**
     * Updates the completion status of a task inside its source Markdown file.
     */
    fun updateTaskCompletion(task: TaskItem, isCompleted: Boolean): Boolean {
        try {
            val fileUri = Uri.parse(task.sourceNoteUri)
            val inputStream = contentResolver.openInputStream(fileUri) ?: return false
            val reader = BufferedReader(InputStreamReader(inputStream))
            val lines = reader.use { it.readLines() }.toMutableList()

            if (task.lineIndex >= lines.size) return false
            val targetLine = lines[task.lineIndex]

            if (targetLine != task.rawText) {
                var foundIndex = -1
                for (i in lines.indices) {
                    if (lines[i] == task.rawText) {
                        foundIndex = i
                        break
                    }
                }
                if (foundIndex == -1) return false
                lines[foundIndex] = toggleLineCheckbox(lines[foundIndex], isCompleted)
            } else {
                lines[task.lineIndex] = toggleLineCheckbox(targetLine, isCompleted)
            }

            val content = lines.joinToString("\n")
            val outputStream = contentResolver.openOutputStream(fileUri, "wt") ?: return false
            outputStream.use { it.write(content.toByteArray()) }

            val existingMetadata = synchronized(noteCache) { noteCache[task.sourceNoteUri] }
            if (existingMetadata != null) {
                val updatedMetadata = existingMetadata.copy(modifiedTime = System.currentTimeMillis())
                synchronized(noteCache) {
                    noteCache[task.sourceNoteUri] = updatedMetadata
                }
            }
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    private fun toggleLineCheckbox(line: String, isCompleted: Boolean): String {
        val uncompletedRegex = """^(\s*[-*]\s+\[)\s(\]\s+.*)$""".toRegex()
        val completedRegex = """^(\s*[-*]\s+\[)[xX](\]\s+.*)$""".toRegex()

        return if (isCompleted) {
            if (uncompletedRegex.matches(line)) {
                line.replace(uncompletedRegex, "$1x$2")
            } else {
                line
            }
        } else {
            if (completedRegex.matches(line)) {
                line.replace(completedRegex, "$1 $2")
            } else {
                line
            }
        }
    }
}
