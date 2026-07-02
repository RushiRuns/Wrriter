# Data Model & Schema Specification: Wrriter

Since Wrriter is strictly database-free, all entity states are serialized directly to plain Markdown files (`.md`) with YAML frontmatter headers. This document defines the frontmatter schemas and the in-memory indexes.

---

## 1. Note File Model & YAML Frontmatter Schema

Each note file is a `.md` text file. The top of the file contains a YAML block enclosed by triple-dashes (`---`). The rest of the file is the markdown body.

### Frontmatter Schema

```yaml
---
title: "Note Title"
tags:
  - "idea"
  - "work"
created: "2026-06-25T10:13:00+05:30"
modified: "2026-06-25T10:13:00+05:30"
inbox: true
---
# Document Body Start
This is the note content...
```

| Field | Type | Description |
|---|---|---|
| **title** | String | The display title of the note (defaults to the file base name if missing). |
| **tags** | List of Strings | Custom tags associated with the note (represented as pills in the UI). |
| **created** | String (ISO 8601) | Original creation timestamp (e.g. `YYYY-MM-DDTHH:MM:SSZ` or local timezone). |
| **modified** | String (ISO 8601) | Last modified timestamp (updated on every file save). |
| **inbox** | Boolean | Set to `true` if the note is unprocessed in the `/Inbox` folder, `false` otherwise. |

---

## 2. In-Memory Note Index Cache

To allow fast full-text search, sorting, and tag-filtering without reading files from disk repeatedly, the app builds a transient index cache in memory:

```kotlin
data class NoteMetadata(
    val uriString: String,      // Android Document URI string
    val filePath: String,       // Relative path within vault (e.g. "Work/Projects/meeting.md")
    val fileName: String,       // Actual file name on disk (e.g. "meeting.md")
    val title: String,
    val tags: List<String>,
    val createdTime: Long,      // Epoch millisecond parsed from created
    val modifiedTime: Long,     // Epoch millisecond parsed from modified
    val isInbox: Boolean,
    val wordCount: Int          // Pre-computed word count of the body text
)
```

- Reconstructed at startup.
- Invalidated and updated incrementally when notes are created, modified, moved, or deleted.

---

## 3. Attachment File Model

Media and drawing assets are stored as standard files under the `/Attachments` directory and embedded in notes using standard Markdown links.

* **Drawing Files**: Saved as `Attachments/Drawing_YYYYMMDD_HHMMSS.png`.
  - Embedded in notes as: `![Drawing](Attachments/Drawing_YYYYMMDD_HHMMSS.png)`
* **Voice Recording Files**: Recorded as `Attachments/Voice_YYYYMMDD_HHMMSS.m4a`.
  - Embedded in notes as: `![Voice Note](Attachments/Voice_YYYYMMDD_HHMMSS.m4a)` or an audio player layout.

---

## 4. Task Entity Model

Tasks are not stored in a separate table. They are checklist items parsed directly from the body of any `.md` file in the vault.

* **Markdown Checkbox Format**:
  - Uncompleted: `- [ ] Buy milk`
  - Completed: `- [x] Buy milk`
* **In-Memory Task Representation**:

```kotlin
data class TaskItem(
    val sourceNoteUri: String,   // Reference to the note file
    val sourceNoteTitle: String, // Note display title
    val description: String,     // Task text (e.g. "Buy milk")
    val isCompleted: Boolean,    // true if - [x], false if - [ ]
    val lineIndex: Int,          // Line number in the file for atomic replacement
    val rawText: String          // Original raw markdown line text
)
```

When a task is checked/unchecked in the Tasks UI, the app loads the source note file, locates the exact line by `lineIndex` matching `rawText`, swaps `- [ ]` / `- [x]`, and writes the file back atomically.
