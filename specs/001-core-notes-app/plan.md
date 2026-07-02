# Implementation Plan: Wrriter Core Note-Taking App

**Branch**: `001-core-notes-app` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-core-notes-app/spec.md`

---

## Summary
Build a local-first, offline-only Android note-taking application named **Wrriter**. The application uses a strictly database-free filesystem architecture where all notes are stored as plain Markdown (`.md`) files inside a user-selected folder via the Storage Access Framework (SAF). Metadata is serialized as YAML frontmatter and cached in memory at runtime. The editing experience is provided by a localized WebView running a WYSIWYG Markdown editor.

---

## Technical Context

**Language/Version**: Kotlin 2.0+ / JVM 17

**Primary Dependencies**:
- Jetpack Compose (UI)
- Jetpack Preferences DataStore (User Preferences)
- Android EncryptedSharedPreferences (Secure API Keys)
- OkHttp (Local network REST calls)
- Android System WebView & WebKit Asset Loader (Local HTML WYSIWYG editor)
- Android SensorManager (Shake gesture)
- Android MediaRecorder (Voice recordings)

**Storage**: Plain Markdown (`.md`) files on local device storage managed via the Android DocumentTree API (SAF). No database (SQLite/Room) is used.

**Testing**: JUnit 4/JUnit 5, MockK (Unit tests), Compose UI Test (UI verification).

**Target Platform**: Android 7.0+ (API 24+) to Android 15 (API 35+ / API 36 target).

**Project Type**: Mobile Android Application.

**Performance Goals**:
- Index 1,000 files in under 2 seconds.
- Load note content in under 500 milliseconds.
- Filter search results in under 300 milliseconds.

**Constraints**:
- Strictly offline-first.
- Strictly database-free.
- Default and hero theme must be OLED Black (`#000000` background).
- Zero main-thread blocking file I/O operations.

**Scale/Scope**:
- Single user local vault directory.
- Support nested custom subdirectories with no depth limit.
- Transient in-memory index cache rebuilt on change.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Database-Free**: Is the feature strictly database-free (no SQLite/Room)? Are all states persisted in Markdown/YAML or in-memory caches?
- [x] **Offline-First & Threading**: Does the design function entirely offline? Is all file I/O and network operations performed off the UI thread?
- [x] **OLED Black & WYSIWYG**: Does the UI match the minimalist OLED Black theme? Are raw markdown symbols hidden at all times?
- [x] **Safety & Atomicity**: Are writes to notes atomic (using temp files)? Do core logics have corresponding unit test specs?
- [x] **Privacy**: Are all logs and notes kept strictly on-device without telemetry or unauthorized cloud sync?
- [x] **Design Consistency**: Are settings persisted immediately via DataStore and applied globally?

---

## Project Structure

### Documentation (this feature)

```text
specs/001-core-notes-app/
├── spec.md              # Feature specification
├── plan.md              # This file (Implementation Plan)
├── research.md          # Technical choices and alternatives
├── data-model.md        # YAML schema and in-memory caches
├── quickstart.md        # Manual verification guides
└── contracts/           # WebView bridge & Syncthing endpoints contracts
    ├── webview-bridge.md
    └── syncthing-api.md
```

### Source Code (repository root)

```text
app/src/main/java/com/rushi/wrriter/
├── MainActivity.kt               # App entrypoint and Compose router
├── data/
│   ├── VaultManager.kt           # SAF File IO, YAML frontmatter parsing, caching
│   ├── NoteMetadata.kt           # Note metadata data classes
│   └── PreferencesManager.kt     # Preferences DataStore & EncryptedSharedPreferences
├── ui/
│   ├── theme/
│   │   ├── Color.kt              # OLED Black theme palette
│   │   ├── Theme.kt              # Wrriter Compose Theme Override
│   │   └── Type.kt               # Font configurations
│   ├── components/
│   │   ├── InboxToolbar.kt       # Long-press action bar
│   │   ├── SearchBar.kt          # Minimal search header
│   │   └── CalendarGrid.kt       # Journal calendar layout
│   ├── screens/
│   │   ├── OnboardingScreen.kt   # Vault folder selector
│   │   ├── InboxScreen.kt        # Default notes list & quick capture
│   │   ├── EditorScreen.kt       # WebView WYSIWYG editor container
│   │   ├── JournalScreen.kt      # Calendar logs viewer
│   │   ├── TasksScreen.kt        # Aggregated markdown checklist manager
│   │   ├── DrawingPadScreen.kt   # Sketch pad canvas
│   │   ├── SettingsScreen.kt     # Preferences and Syncthing setup
│   │   └── StatisticsScreen.kt   # Stats counters & streaks dashboard
├── network/
│   └── SyncthingClient.kt        # OkHttp remote PC client connections
├── service/
│   ├── FloatingWidgetService.kt  # System-wide Assistive Touch WindowManager overlay
│   └── BreakReminderService.kt   # Keyboard listener foreground service tracker
├── sensor/
│   └── ShakeDetector.kt          # Accelerator gesture listener
└── receiver/
    └── AlarmReceiver.kt          # AlarmManager notification scheduler

app/src/main/assets/              # Local WYSIWYG Editor WebView resources
├── editor.html                   # HTML text editor canvas
├── editor.js                     # Contenteditable parsing and JS interface bridge
└── editor.css                    # OLED black style, grid lines, paper grain textures

app/src/test/java/com/rushi/wrriter/
├── VaultManagerTest.kt           # Unit tests for SAF directory listing & YAML parsing
├── FrontmatterParserTest.kt      # Unit tests for Frontmatter serialization
└── BreakReminderTest.kt          # Unit tests for continuous typing threshold logic
```

**Structure Decision**: Standard Android single module project. The core application logic resides in `app/src/main/java/com/rushi/wrriter/`. Local WebView resources reside under `app/src/main/assets/`.

---

## Complexity Tracking

No violations of the Constitution have been made.

---

## Verification Plan

### Automated Tests

#### Vault & Serialization Tests
- Run `gradlew test` to execute unit tests verifying:
  - `VaultManager`: Correctly parses metadata block and content from raw markdown file streams.
  - `FrontmatterParser`: Serializes updated titles, tags, and timestamps back to the note file stream without corrupting text body.
  - `BreakReminder`: Calculates active continuous periods from timestamp sequences.

---

## Manual Verification

Verify all features on an Android device or emulator:
1. **Onboarding**: Perform clean start, grant folder permission, check folders exist.
2. **Quick Dump**: Submit strings to Inbox list, confirm files written to `/Inbox`.
3. **Editor**: Input headings, check they are styled without `#`. Tap `[[Link]]` to confirm navigation.
4. **Drawing/Voice**: Save sketches/audio, confirm they embed in notes.
5. **Overlay Widget**: Launch Assistive Touch, test floating Quick Write dialog and voice recorder from homescreen.
6. **Settings**: Switch themes, paper grain noise, and ruled line textures.
