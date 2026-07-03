package com.rushi.wrriter.data

/**
 * Data class representing note metadata parsed from YAML frontmatter and cached in memory.
 */
data class NoteMetadata(
    val uriString: String,      // Document URI string for Android SAF operations
    val filePath: String,       // Relative file path from the vault root (e.g., "Work/Projects/note.md")
    val fileName: String,       // The actual file name (e.g., "note.md")
    val title: String,          // Note title (defaults to the filename without extension)
    val tags: List<String>,     // List of associated tags parsed from frontmatter
    val createdTime: Long,      // Creation date timestamp in milliseconds
    val modifiedTime: Long,     // Modification date timestamp in milliseconds
    val isInbox: Boolean,       // Flag indicating if the file resides in the "/Inbox" folder
    val wordCount: Int          // Total word count computed on read/index
)

/**
 * Data class representing a parsed checklist task item from a markdown note.
 */
data class TaskItem(
    val sourceNoteUri: String,   // Reference to the note file
    val sourceNoteTitle: String, // Note display title
    val description: String,     // Task text (e.g. "Buy milk")
    val isCompleted: Boolean,    // true if - [x], false if - [ ]
    val lineIndex: Int,          // Line number in the file for atomic replacement (0-indexed)
    val rawText: String          // Original raw markdown line text
)

val NoteMetadata.isCompleted: Boolean
    get() = filePath.endsWith("/Completed") || fileName.startsWith("~~") && fileName.endsWith("~~.md") || title.startsWith("~~") && title.endsWith("~~")

val NoteMetadata.baseFolder: String
    get() = if (filePath.endsWith("/Completed")) filePath.removeSuffix("/Completed") else filePath

val NoteMetadata.displayTitle: String
    get() {
        var clean = title
        if (clean.startsWith("~~") && clean.endsWith("~~")) {
            clean = clean.removePrefix("~~").removeSuffix("~~")
        }
        return clean
    }


