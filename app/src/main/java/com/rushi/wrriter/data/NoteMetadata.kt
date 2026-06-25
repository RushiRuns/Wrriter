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
