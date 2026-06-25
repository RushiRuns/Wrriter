<!--
Sync Impact Report
- Version change: null -> 1.0.0
- Modified principles: None (Initial Ratification)
- Added sections: Core Principles (I-VI), Quality Gates & Technical Constraints, Development Workflow, Governance
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md (✅ updated)
  - .specify/templates/spec-template.md (✅ updated)
  - .specify/templates/tasks-template.md (✅ updated)
- Follow-up TODOs: None
-->

# Wrriter Constitution

## Core Principles

### I. Database-Free File System Architecture
The application MUST be strictly database-free. All notes and metadata MUST be stored directly as plain `.md` (Markdown) files with YAML frontmatter for metadata on the local file system. The use of SQLite, Room, or any other external databases is strictly prohibited. The file system IS the database. The app will maintain transient, high-performance in-memory indexes reconstructed dynamically from the directory structure for query/search operations.

*Rationale*: Storing files as pure Markdown prevents lock-in, ensures transparency, and makes syncing via external tools like Syncthing robust and simple.

### II. Offline-First & Non-Blocking Performance
The application MUST be fully functional offline at all times. All file I/O operations (reads, writes, listing directories) and network calls (Syncthing API) MUST be run on background threads using Kotlin Coroutines (e.g. `Dispatchers.IO`). The main UI thread must remain free of blocking calls to ensure zero lag or jank during typing, searching, or loading notes.

*Rationale*: User writing flow must be instantaneous and uninterrupted by database lockups or network requests.

### III. Minimalist OLED & WYSIWYG User Experience
The user interface MUST be modern, minimalistic, and respect Material Design 3 guidelines. The default and hero theme is OLED Black (pure black `#000000` background). The Markdown editor MUST be WYSIWYG (Notion-like), meaning formatting is rendered live and the user never sees raw Markdown formatting syntax (such as `#`, `*`, or `[[link]]`) at any point. Every interaction must feel premium and native to Android.

*Rationale*: A clean, clutter-free visual canvas with high-contrast aesthetics reduces eye strain and helps the user focus entirely on content creation.

### IV. Safe, Atomic & Tested Code Quality
All core business logic, markdown parsing, and search logic MUST be unit-tested. File writes MUST be atomic (e.g., writing to a temporary file first, then replacing the destination file) to prevent note corruption during crashes or battery loss. Every optional component (such as the remote Syncthing integration) MUST degrade gracefully, allowing full app operation and local saving if the remote service is unavailable.

*Rationale*: Protecting user text from data loss or corruption is the application's most critical responsibility.

### V. Data Privacy & Local Control
All user notes, audio files, and drawings MUST remain strictly on-device. The application MUST NOT collect analytics, telemetry, or crash logs, and it MUST NOT sync with proprietary cloud servers. The only allowed network synchronization is the explicitly user-configured Syncthing API over the local network. The app must never request unnecessary Android permissions.

*Rationale*: Complete user privacy and ownership over their writing builds absolute trust.

### VI. Design and Settings Consistency
Every screen, component, and interaction MUST follow the same design system and spacing guidelines. Settings selected by the user (themes, fonts, tab indentation, and break reminders) MUST persist immediately (using DataStore) and apply globally across the app without requiring restarts.

*Rationale*: A cohesive design system and instant preference update provide a polished, premium, and predictable application experience.

## Quality Gates & Technical Constraints
- **Jetpack Compose**: The application UI MUST be built entirely using Jetpack Compose. Old XML-based views are prohibited except where required by WebView components or System overlays.
- **Asynchronous Execution**: Strict enforcement of background threads for IO. No file operations or network requests are permitted on the Main thread.
- **Testing Discipline**: All business logic, parsers, and utilities MUST have accompanying JVM unit tests.

## Development Workflow
- **Step-by-Step Implementation**: Features should be developed incrementally, verifying each step with automated tests.
- **Verification Gates**: Build and lint checks must pass before marking a task as complete.

## Governance
- This constitution governs all development on the Wrriter project. Any deviation from these principles must be documented and justified.
- Amendments to this constitution require updating the document version and updating downstream templates.

**Version**: 1.0.0 | **Ratified**: 2026-06-25 | **Last Amended**: 2026-06-25
