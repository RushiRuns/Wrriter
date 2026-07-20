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

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class VaultManager(private val context: Context) {

    private val contentResolver: ContentResolver = context.contentResolver

    // Transient in-memory index cache of all notes in the vault
    private val noteCache = mutableMapOf<String, NoteMetadata>()

    // ISO 8601 Date formatter
    private val isoFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.getDefault())
    private val isoMillisFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.getDefault())

    @Volatile
    var lastRebuildTime: Long = 0L
        private set

    @Volatile
    private var isRebuilding = false

    private val _isIndexReady = MutableStateFlow(false)
    val isIndexReady: StateFlow<Boolean> = _isIndexReady.asStateFlow()

    fun markNotReady() {
        _isIndexReady.value = false
    }

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
        if (isRebuilding) return
        isRebuilding = true
        try {
            val rootUri = Uri.parse(rootUriString)
            val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: run {
                return
            }
            val tempCache = mutableMapOf<String, NoteMetadata>()
            scanDirectory(rootDir, "", rootUri, tempCache)
            synchronized(noteCache) {
                noteCache.clear()
                noteCache.putAll(tempCache)
            }
            lastRebuildTime = System.currentTimeMillis()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isRebuilding = false
            _isIndexReady.value = true
        }
    }

    private fun scanDirectory(dir: DocumentFile, relativePath: String, rootUri: Uri, tempCache: MutableMap<String, NoteMetadata>) {
        val files = dir.listFiles()
        for (file in files) {
            if (file.isDirectory) {
                val folderName = file.name ?: continue
                // Exclude Attachments and hidden directories (starting with ".") from note scanning
                if (folderName == "Attachments" || folderName.startsWith(".")) continue
                val nextRelativePath = if (relativePath.isEmpty()) folderName else "$relativePath/$folderName"
                scanDirectory(file, nextRelativePath, rootUri, tempCache)
            } else if (file.isFile && file.name?.endsWith(".md") == true) {
                try {
                    val metadata = loadMetadata(file, relativePath)
                    tempCache[file.uri.toString()] = metadata
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
        val existingMetadata = synchronized(noteCache) { noteCache[fileUriString] }
        val parentFile = file.parentFile
        val relativePath = existingMetadata?.filePath ?: parentFile?.name ?: ""

        val title = frontmatterMap["title"] as? String ?: file.name?.removeSuffix(".md") ?: "Untitled"
        val tags = (frontmatterMap["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
        val createdStr = frontmatterMap["created"] as? String
        val modifiedStr = frontmatterMap["modified"] as? String
        val isInbox = frontmatterMap["inbox"] as? Boolean ?: (relativePath == "Inbox")
        val completed = frontmatterMap["completed"] as? Boolean ?: false
        val completedAtStr = frontmatterMap["completed_at"] as? String
        val completedAt = completedAtStr?.let { parseIsoDate(it) }

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
            completed = completed,
            completedAt = completedAt,
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
        body: String,
        completed: Boolean? = null,
        completedAt: Long? = null
    ): NoteMetadata {
        val fileUri = Uri.parse(fileUriString)
        val file = DocumentFile.fromSingleUri(context, fileUri) ?: throw Exception("File not found")

        val existingMetadata = synchronized(noteCache) { noteCache[fileUriString] }
        val createdTime = existingMetadata?.createdTime ?: System.currentTimeMillis()
        val modifiedTime = System.currentTimeMillis()
        val relativePath = existingMetadata?.filePath ?: ""
        val actualCompleted = completed ?: existingMetadata?.completed ?: false
        val actualCompletedAt = if (completed != null) {
            if (completed) {
                completedAt ?: existingMetadata?.completedAt ?: System.currentTimeMillis()
            } else {
                null
            }
        } else {
            existingMetadata?.completedAt
        }

        val metadata = NoteMetadata(
            uriString = fileUriString,
            filePath = relativePath,
            fileName = file.name ?: "",
            title = title,
            tags = tags,
            createdTime = createdTime,
            modifiedTime = modifiedTime,
            isInbox = isInbox,
            completed = actualCompleted,
            completedAt = actualCompletedAt,
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
        
        val folder = resolveOrCreateFolder(rootDir, folderName)

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
            completed = false,
            completedAt = null,
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
        val currentFolder = resolveFolder(rootDir, note.filePath) ?: throw Exception("Current folder not found")
        val targetFolder = resolveOrCreateFolder(rootDir, targetFolderName)
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

        // Put in cache first so loadNote can resolve relativePath correctly
        synchronized(noteCache) {
            noteCache.remove(note.uriString)
            noteCache[newUri.toString()] = updatedMetadata
        }

        // Rewrite frontmatter to update the metadata tags
        val (_, body) = loadNote(newUri.toString())
        val finalMetadata = saveNote(
            fileUriString = newUri.toString(),
            title = updatedMetadata.title,
            tags = updatedMetadata.tags,
            isInbox = updatedMetadata.isInbox,
            body = body,
            completed = note.completed,
            completedAt = note.completedAt
        )

        return finalMetadata
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

    /**
     * Toggles the completed status of a note by rewriting its YAML frontmatter.
     */
    fun toggleNoteComplete(note: NoteMetadata, completed: Boolean): NoteMetadata {
        val (_, body) = loadNote(note.uriString)
        val updated = saveNote(
            fileUriString = note.uriString,
            title = note.title,
            tags = note.tags,
            isInbox = note.isInbox,
            body = body,
            completed = completed
        )
        return updated
    }

    private fun resolveFolder(parent: DocumentFile, path: String): DocumentFile? {
        if (path.isEmpty()) return parent
        val segments = path.split("/")
        var current: DocumentFile = parent
        for (segment in segments) {
            if (segment.isEmpty()) continue
            current = current.findFile(segment) ?: return null
        }
        return current
    }

    private fun resolveOrCreateFolder(parent: DocumentFile, path: String): DocumentFile {
        if (path.isEmpty()) return parent
        val segments = path.split("/")
        var current: DocumentFile = parent
        for (segment in segments) {
            if (segment.isEmpty()) continue
            current = current.findFile(segment) ?: current.createDirectory(segment)
                ?: throw Exception("Failed to resolve or create subdirectory: $segment")
        }
        return current
    }

    /**
     * Renames a note file using SAF.
     */
    fun renameNote(note: NoteMetadata, newFileName: String): NoteMetadata {
        val fileUri = Uri.parse(note.uriString)
        
        val newUri = DocumentsContract.renameDocument(
            contentResolver,
            fileUri,
            newFileName
        ) ?: throw Exception("Failed to rename file via documents contract")

        val cleanTitle = newFileName.removeSuffix(".md").removePrefix("~~").removeSuffix("~~")
        val updatedMetadata = note.copy(
            uriString = newUri.toString(),
            fileName = newFileName,
            title = cleanTitle
        )

        // Put in cache first so loadNote can resolve relativePath correctly
        synchronized(noteCache) {
            noteCache.remove(note.uriString)
            noteCache[newUri.toString()] = updatedMetadata
        }

        var finalMetadata = updatedMetadata
        // Rewrite frontmatter to keep title and cache in sync
        try {
            val (_, body) = loadNote(newUri.toString())
            finalMetadata = saveNote(
                fileUriString = newUri.toString(),
                title = cleanTitle,
                tags = updatedMetadata.tags,
                isInbox = updatedMetadata.isInbox,
                body = body,
                completed = note.completed,
                completedAt = note.completedAt
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return finalMetadata
    }

    // --- Helpers for Frontmatter Parsing and Serialization ---

    private fun readFrontmatterOnly(fileUri: Uri): String {
        return try {
            val inputStream = contentResolver.openInputStream(fileUri) ?: return ""
            val sb = java.lang.StringBuilder()
            BufferedReader(InputStreamReader(inputStream)).use { reader ->
                val firstLine = reader.readLine()
                if (firstLine != null) {
                    sb.append(firstLine).append("\n")
                    if (firstLine.trim() == "---") {
                        var line = reader.readLine()
                        while (line != null) {
                            sb.append(line).append("\n")
                            if (line.trim() == "---") {
                                break
                            }
                            line = reader.readLine()
                        }
                    }
                }
            }
            sb.toString()
        } catch (e: Exception) {
            ""
        }
    }

    private fun loadMetadata(file: DocumentFile, relativePath: String): NoteMetadata {
        val rawText = readFrontmatterOnly(file.uri)
        val (frontmatterMap, _) = parseFrontmatter(rawText)

        val title = frontmatterMap["title"] as? String ?: file.name?.removeSuffix(".md") ?: "Untitled"
        val tags = (frontmatterMap["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
        val createdStr = frontmatterMap["created"] as? String
        val modifiedStr = frontmatterMap["modified"] as? String
        val isInbox = frontmatterMap["inbox"] as? Boolean ?: (relativePath == "Inbox")
        val completed = frontmatterMap["completed"] as? Boolean ?: false
        val completedAtStr = frontmatterMap["completed_at"] as? String
        val completedAt = completedAtStr?.let { parseIsoDate(it) }

        val createdTime = createdStr?.let { parseIsoDate(it) } ?: file.lastModified()
        val modifiedTime = modifiedStr?.let { parseIsoDate(it) } ?: file.lastModified()
        
        val wordCountStr = frontmatterMap["word_count"] as? String
        val wordCount = wordCountStr?.toIntOrNull() ?: 0

        return NoteMetadata(
            uriString = file.uri.toString(),
            filePath = relativePath,
            fileName = file.name ?: "",
            title = title,
            tags = tags,
            createdTime = createdTime,
            modifiedTime = modifiedTime,
            isInbox = isInbox,
            completed = completed,
            completedAt = completedAt,
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
                            if (finalValue == "null") {
                                @Suppress("UNCHECKED_CAST")
                                (metadata as MutableMap<String, Any?>)[key] = null
                            } else {
                                val boolVal = finalValue.lowercase().toBooleanStrictOrNull()
                                if (boolVal != null) {
                                    metadata[key] = boolVal
                                } else {
                                    metadata[key] = finalValue
                                }
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
        sb.append("completed: ${metadata.completed}\n")
        if (metadata.completedAt != null) {
            sb.append("completed_at: \"${formatIsoDate(metadata.completedAt)}\"\n")
        } else {
            sb.append("completed_at: null\n")
        }
        sb.append("word_count: ${metadata.wordCount}\n")
        sb.append("---\n")
        sb.append(body)
        return sb.toString()
    }

    private fun formatIsoDate(timeMs: Long): String {
        return isoFormatter.format(Date(timeMs))
    }

    private fun parseIsoDate(isoStr: String): Long {
        return try {
            isoFormatter.parse(isoStr)?.time
                ?: isoMillisFormatter.parse(isoStr)?.time
                ?: System.currentTimeMillis()
        } catch (e: Exception) {
            try {
                isoMillisFormatter.parse(isoStr)?.time ?: System.currentTimeMillis()
            } catch (e2: Exception) {
                System.currentTimeMillis()
            }
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
            completed = false,
            completedAt = null,
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

    /**
     * Searches all cached notes for matching query terms in title, tags, or body content.
     */
    fun searchNotes(query: String): List<NoteMetadata> {
        val result = mutableListOf<NoteMetadata>()
        val notes = getCachedNotes()
        if (query.trim().isEmpty()) return notes

        val lowerQuery = query.trim().lowercase()
        for (note in notes) {
            if (note.title.lowercase().contains(lowerQuery)) {
                result.add(note)
                continue
            }

            if (note.tags.any { it.lowercase().contains(lowerQuery) }) {
                result.add(note)
                continue
            }

            try {
                val fileUri = Uri.parse(note.uriString)
                val inputStream = contentResolver.openInputStream(fileUri) ?: continue
                val reader = BufferedReader(InputStreamReader(inputStream))
                val text = reader.use { it.readText() }
                val (_, body) = parseFrontmatter(text)
                if (body.lowercase().contains(lowerQuery)) {
                    result.add(note)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return result
    }

    /**
     * Imports markdown files into the Inbox folder.
     */
    fun importNotes(rootUriString: String, sourceUris: List<Uri>): Int {
        var importedCount = 0
        try {
            val rootUri = Uri.parse(rootUriString)
            val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: return 0
            val inboxDir = rootDir.findFile("Inbox") ?: rootDir.createDirectory("Inbox") ?: return 0

            for (sourceUri in sourceUris) {
                try {
                    val sourceFile = DocumentFile.fromSingleUri(context, sourceUri) ?: continue
                    val originalName = sourceFile.name ?: "Imported_${System.currentTimeMillis()}.md"
                    val safeName = if (originalName.endsWith(".md")) originalName else "$originalName.md"
                    
                    val inputStream = contentResolver.openInputStream(sourceUri) ?: continue
                    val rawText = inputStream.use { it.readBytes() }
                    
                    val destFile = inboxDir.createFile("text/markdown", safeName) ?: continue
                    val outputStream = contentResolver.openOutputStream(destFile.uri) ?: continue
                    outputStream.use { it.write(rawText) }
                    
                    try {
                        val metadata = loadMetadata(destFile, "Inbox")
                        synchronized(noteCache) {
                            noteCache[destFile.uri.toString()] = metadata
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    
                    importedCount++
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return importedCount
    }

    /**
     * Exports the entire vault folder structure to a user-selected backup folder on the device.
     */
    fun exportVault(rootUriString: String, targetFolderUri: Uri): Boolean {
        try {
            val srcRootUri = Uri.parse(rootUriString)
            val srcRootDir = DocumentFile.fromTreeUri(context, srcRootUri) ?: return false
            val destRootDir = DocumentFile.fromTreeUri(context, targetFolderUri) ?: return false
            
            if (!srcRootDir.exists() || !destRootDir.exists()) return false
            
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val backupFolderName = "Wrriter_Backup_$timeStamp"
            val backupDestDir = destRootDir.createDirectory(backupFolderName) ?: return false

            copyDirectoryRecursively(srcRootDir, backupDestDir)
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    private fun copyDirectoryRecursively(sourceDir: DocumentFile, destDir: DocumentFile) {
        val files = sourceDir.listFiles()
        for (file in files) {
            if (file.isDirectory) {
                val subDirName = file.name ?: continue
                // Skip hidden directories (starting with ".")
                if (subDirName.startsWith(".")) continue
                val subDestDir = destDir.createDirectory(subDirName) ?: continue
                copyDirectoryRecursively(file, subDestDir)
            } else if (file.isFile) {
                val fileName = file.name ?: continue
                val mimeType = file.type ?: "application/octet-stream"
                val destFile = destDir.createFile(mimeType, fileName) ?: continue
                
                try {
                    contentResolver.openInputStream(file.uri).use { inputStream ->
                        contentResolver.openOutputStream(destFile.uri).use { outputStream ->
                            if (inputStream != null && outputStream != null) {
                                inputStream.copyTo(outputStream)
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    data class VaultStats(
        val totalNotes: Int,
        val totalWords: Int,
        val currentStreak: Int,
        val longestStreak: Int
    )

    /**
     * Calculates streak and totals statistics for all cached notes.
     */
    fun getVaultStats(): VaultStats {
        val notes = getCachedNotes()
        val totalNotes = notes.size
        val totalWords = notes.sumOf { it.wordCount }
        
        if (notes.isEmpty()) {
            return VaultStats(0, 0, 0, 0)
        }

        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dateStrings = notes.map { sdf.format(Date(it.modifiedTime)) }.toSet()
        
        val datesList = dateStrings.mapNotNull { dateStr ->
            try {
                sdf.parse(dateStr)
            } catch (e: Exception) {
                null
            }
        }.sorted()

        if (datesList.isEmpty()) {
            return VaultStats(totalNotes, totalWords, 0, 0)
        }

        var longestStreak = 0
        var currentStreak = 0
        
        var tempStreak = 1
        for (i in 1 until datesList.size) {
            val prev = datesList[i - 1]
            val curr = datesList[i]
            
            val diffMs = curr.time - prev.time
            val diffDays = (diffMs / (24 * 60 * 60 * 1000L)).toInt()
            
            if (diffDays == 1) {
                tempStreak++
            } else if (diffDays > 1) {
                if (tempStreak > longestStreak) {
                    longestStreak = tempStreak
                }
                tempStreak = 1
            }
        }
        if (tempStreak > longestStreak) {
            longestStreak = tempStreak
        }

        val todayStr = sdf.format(Date())
        val yesterdayCal = Calendar.getInstance().apply { add(Calendar.DATE, -1) }
        val yesterdayStr = sdf.format(yesterdayCal.time)
        
        if (dateStrings.contains(todayStr) || dateStrings.contains(yesterdayStr)) {
            val checkDate = if (dateStrings.contains(todayStr)) Date() else yesterdayCal.time
            var streakCount = 0
            val checkCal = Calendar.getInstance()
            checkCal.time = checkDate
            
            while (true) {
                val formatted = sdf.format(checkCal.time)
                if (dateStrings.contains(formatted)) {
                    streakCount++
                    checkCal.add(Calendar.DATE, -1)
                } else {
                    break
                }
            }
            currentStreak = streakCount
        }

        return VaultStats(
            totalNotes = totalNotes,
            totalWords = totalWords,
            currentStreak = currentStreak,
            longestStreak = longestStreak
        )
    }
}

