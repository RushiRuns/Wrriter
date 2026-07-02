# Feature Specification: Wrriter Note-Taking App

**Feature Branch**: `001-core-notes-app`

**Created**: 2026-06-25

**Status**: Ready

**Input**: User description: "Build a local-first, offline-only Android note-taking app called Wrriter. All notes are stored as plain Markdown (.md) files..."

---

## User Scenarios & Testing

### User Story 1 - Vault Initialization & Inbox Quick Capture (Priority: P1)
**Goal**: Select a local storage location, initialize the workspace folder structure, and quickly capture text or voice thoughts into the Inbox.

**Why this priority**: Essential onboarding and basic note creation form the core foundation of the application.

**Independent Test**: On a clean installation, launch the app, select a folder via the picker, type a thought in the input box, and verify a new note is successfully created in the Inbox list.

**Acceptance Scenarios**:
1. **Given** a new installation, **When** the app is launched, **Then** a minimal screen with a "Select/Create Vault Folder" button is displayed.
2. **Given** the onboarding screen, **When** the user selects a folder, **Then** the folders `/Inbox`, `/Later`, `/Read`, `/Shop`, `/Watch`, `/Journal`, and `/Attachments` are automatically created if they do not exist.
3. **Given** the Inbox screen, **When** the user types "Idea 1" in the "Dump your thoughts..." input and presses Enter, **Then** the note is created in the Inbox, and the text field is cleared.
4. **Given** the Inbox screen, **When** the user taps the microphone icon, **Then** voice note recording starts, and the microphone icon changes to show a recording state.

---

### User Story 2 - WYSIWYG Editor & Internal Wiki Links (Priority: P1)
**Goal**: Write and edit notes using a visual Notion-style interface without raw markdown characters, with support for wiki-style internal links.

**Why this priority**: Core writing canvas is the primary focus of a note-taking application.

**Independent Test**: Open an existing note, type markdown shorthand (e.g., `# Header`), verify it renders as styled text without raw symbols, and tap a link to verify target note navigation.

**Acceptance Scenarios**:
1. **Given** an active note in the editor, **When** the user types `# Hello`, **Then** the line instantly renders as a Header block, and the `#` symbol is hidden.
2. **Given** the editor, **When** the user types `[[New Note]]`, **Then** a styled link "New Note" is created.
3. **Given** a note with a wiki-link to a non-existent note, **When** the user clicks the link, **Then** the target note is automatically created in the current folder, and the editor navigates to it.

---

### User Story 3 - Inbox Processing Toolbar & Nested Folders (Priority: P2)
**Goal**: File notes from the Inbox into predefined or deeply nested custom directories.

**Why this priority**: Organizes notes and moves them out of the Inbox.

**Independent Test**: Long-press a note in the Inbox, tap the Clock icon, and verify the file is moved to `/Later` and disappears from the Inbox view.

**Acceptance Scenarios**:
1. **Given** the Inbox note list, **When** the user long-presses a note row, **Then** a horizontal processing toolbar is displayed.
2. **Given** the processing toolbar on "note 1", **When** the user taps the Clock, Book, Shopping Cart, TV, or Heart icon, **Then** the note is moved to `/Later`, `/Read`, `/Shop`, `/Watch`, or `/Journal` respectively, and animates out of the Inbox list.
3. **Given** the processing toolbar, **When** the user taps the orange "Move to..." button, **Then** the note is moved to the last-used folder, or a folder picker opens if no last folder exists.
4. **Given** the folder picker, **When** the user creates a nested folder path like `/Work/Projects/2026`, **Then** the system creates the nested directory structure on disk.

---

### User Story 4 - Drawing Pad & Voice Attachments (Priority: P2)
**Goal**: Sketch drawings and record audio notes, embedding them as attachments inside Markdown notes.

**Why this priority**: Enhances expressiveness and media capabilities.

**Independent Test**: Open the drawing interface, sketch a line, tap save, and verify the drawing is saved in `/Attachments` and embedded in the active note.

**Acceptance Scenarios**:
1. **Given** the drawing interface, **When** the user saves a drawing, **Then** a `.png` file is created in `/Attachments`, and a markdown image link is inserted into the active note.
2. **Given** a note with an embedded voice note, **When** the editor is opened, **Then** a styled audio player is rendered, allowing the user to play back the `.m4a` file.

---

### User Story 5 - Daily Journal & Calendar Interface (Priority: P2)
**Goal**: Maintain a daily journal and navigate past entries using a visual calendar interface.

**Why this priority**: Predefined journaling workflow requested by the user.

**Independent Test**: Navigate to the Journal screen, select a date from the calendar, and verify the corresponding date-named note is loaded or created.

**Acceptance Scenarios**:
1. **Given** the Journal calendar interface, **When** the user taps today's date, **Then** a note named `Journal/YYYY-MM-DD.md` is automatically created and opened.
2. **Given** the Journal screen, **When** the user browses the calendar, **Then** dates containing existing journal entries are visually highlighted.

---

### User Story 6 - Centralized Tasks Interface (Priority: P3)
**Goal**: View and check off task list items across all vault notes in a consolidated screen.

**Why this priority**: Task aggregation across database-free files.

**Independent Test**: Add `- [ ] Buy milk` to a note, open the Tasks screen, check the item, and verify the source note file updates to `- [x] Buy milk`.

**Acceptance Scenarios**:
1. **Given** the Tasks interface, **When** the user checks a task, **Then** the source markdown file on disk is modified atomically to update the task status.

---

### User Story 7 - Full-Text Search & Shake-to-Random Gesture (Priority: P3)
**Goal**: Search all note contents/metadata instantly, and open a random note via a physical shake gesture.

**Why this priority**: Discovery and search features.

**Independent Test**: Search for a tag, verify matching notes are listed, and shake the device to verify a random note opens with haptic feedback.

**Acceptance Scenarios**:
1. **Given** the search bar, **When** the user enters a tag, **Then** all notes containing the tag in their content or YAML frontmatter are listed.
2. **Given** any screen, **When** the user shakes the device, **Then** the device vibrates, displays a Toast "Opening random note...", and loads a random note.

---

### User Story 8 - Remote Syncthing REST API Client (Priority: P3)
**Goal**: Connect to a remote Syncthing PC client to monitor sync state and force-trigger folder scans.

**Why this priority**: Device sync capability.

**Independent Test**: Configure the remote PC connection in Settings, and tap "Sync Now" to verify a scan request is sent.

**Acceptance Scenarios**:
1. **Given** the Syncthing settings, **When** the user enters the remote IP, port, and API key, **Then** the app connects to the remote daemon over the local network and displays active devices and connection status.
2. **Given** the Syncthing dashboard, **When** the user taps the manual sync trigger, **Then** the app sends a scan command to the remote PC.

---

### User Story 9 - Assistive Touch Floating Overlay (Priority: P3)
**Goal**: Access note actions via a system-wide floating button visible over other apps.

**Why this priority**: Quick utility accessibility.

**Independent Test**: Enable the floating overlay, close the app, tap the overlay, select Quick Write, type text, and save. Verify the note is created in the Inbox.

**Acceptance Scenarios**:
1. **Given** the system-wide floating widget, **When** the user taps it, **Then** a floating card menu with three options appears.
2. **Given** the floating menu, **When** the user taps "Quick Write", **Then** a floating text dialog opens on-screen, allowing the user to type and save a note directly to `/Inbox` in the background.
3. **Given** the floating menu, **When** the user taps "Record Voice Note", **Then** a floating recording panel with a duration timer and a Stop button appears.

---

### User Story 10 - Settings, Break Reminders, & Textures (Priority: P3)
**Goal**: Customize editor styles, textures, tab behaviors, and configure continuous typing break reminders.

**Why this priority**: Personalization and ergonomics.

**Independent Test**: Configure paper grain texture and 2-space indentation in Settings, and verify they are active in the editor.

**Acceptance Scenarios**:
1. **Given** the Settings screen, **When** the user selects "paper grain texture" or "ruled lines", **Then** the editor WebView background updates to display the texture.
2. **Given** the editor, **When** the user has typed continuously for 1 hour (defined as at least 1 keypress every 2 minutes), **Then** a system notification reminding them to take a break is fired.
3. **Given** the editor, **When** the user is idle or closes the editor for more than 5 minutes, **Then** the continuous writing session timer is reset to zero.

---

## Edge Cases

- **Storage Revocation**: If the user revokes folder permission through Android settings, the app must degrade gracefully, prompting the user to re-authorize the folder before performing any operations.
- **Syncthing Offline**: If the remote Syncthing PC is offline or on a different network, the sync dashboard must display "Disconnected", and the manual sync trigger must fail gracefully without jank or app crashes.
- **Microphone Interruption**: If an incoming call occurs while recording a voice note, the app must automatically stop recording, save the audio captured so far, and embed it in the Inbox.
- **Simultaneous Writes**: If external files are synced by Syncthing while the user has a file open in the editor, the app must detect the disk modification and prompt the user to reload or merge changes, avoiding overwriting synced data.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST store all notes as plain Markdown (`.md`) files on the local filesystem.
- **FR-002**: The system MUST store metadata (title, tags, folder, created/modified dates, status) in a YAML frontmatter block at the top of the file.
- **FR-003**: The system MUST NOT show raw YAML frontmatter to the user. It must render metadata as interactive pills, breadcrumbs, and date fields.
- **FR-004**: On first launch, the system MUST require the user to select or create a vault folder.
- **FR-005**: The system MUST automatically create default subfolders (`/Inbox`, `/Later`, `/Read`, `/Shop`, `/Watch`, `/Journal`, `/Attachments`) if they do not exist.
- **FR-006**: The system MUST default to the OLED Black (`#000000`) theme.
- **FR-007**: The editor MUST be a WebView-based WYSIWYG editor that hides all raw markdown formatting syntax.
- **FR-008**: The system MUST support `[[Note Name]]` wiki-links, navigating to the note or creating it automatically if it is missing.
- **FR-009**: The Inbox screen MUST list all notes located in the `/Inbox` folder and allow filing them using a long-press toolbar.
- **FR-010**: The bottom of the Inbox screen MUST feature a text dump input that creates notes on Enter, and a microphone button for voice recordings.
- **FR-011**: Drawings saved in the Drawing Pad MUST be stored as `.png` files in `/Attachments` and embedded in the note.
- **FR-012**: Voice notes MUST be recorded as `.m4a` files in `/Attachments` and embedded inside notes.
- **FR-013**: The Journal screen MUST feature a calendar interface that automatically creates `Journal/YYYY-MM-DD.md` files upon selecting dates.
- **FR-014**: The Tasks screen MUST scan all notes for checklist items (`- [ ]` and `- [x]`), aggregate them, and update the source notes atomically when completed.
- **FR-015**: The system MUST support full-text search indexing across file content, tags, folder names, and titles.
- **FR-016**: The system MUST listen for device shake gestures to trigger haptic feedback, a Toast message, and load a random note.
- **FR-017**: The system MUST connect to a remote Syncthing PC client using its REST API to monitor sync status, list devices, and trigger folder scans.
- **FR-018**: The system MUST run a background service tracking editor keypress activity to fire break notifications after 1 hour of active typing.
- **FR-019**: The system MUST support a system-wide floating Assistive Touch overlay to open random notes, open a floating Quick Write text box, or open a floating voice note recorder.
- **FR-020**: The system MUST support importing `.md` files into `/Inbox` and exporting the entire vault directory structure without compression.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can select a vault directory and initialize default subfolders in under 10 seconds on first launch.
- **SC-002**: Notes created via the "Quick Dump" input or floating "Quick Write" must be written to disk and visible in the Inbox in under 1 second.
- **SC-003**: The in-memory cache must load and index 1,000 markdown notes on app startup in under 2 seconds.
- **SC-004**: The WYSIWYG editor must load note content and hide all markdown symbols in under 500 milliseconds.
- **SC-005**: Full-text search queries must return matching note lists in under 300 milliseconds.
- **SC-006**: Triggering manual Syncthing scan must execute the network call in under 1 second (independent of actual sync sync speed).

---

## Key Entities

- **Vault**: The root directory containing all subfolders, notes, and media.
- **Note**: A plain text Markdown file (`.md`) containing a YAML frontmatter header and a text body.
- **Metadata**: Key-value fields (title, tags list, status, folder location, dates) parsed from the YAML frontmatter.
- **Attachment**: Media files (drawings as `.png`, voice notes as `.m4a`) stored in `/Attachments` and referenced in notes.
- **Task**: An individual checkbox item (`- [ ]` or `- [x]`) parsed from notes and linked to its source note path and line position.

---

## Assumptions

- **System Storage**: The user's device supports Android Storage Access Framework (SAF) to select directory URIs.
- **Local network**: The remote PC running Syncthing is accessible via local IP address over the same Wi-Fi network.
- **Single Instance**: Only one instance of the app edits files in the vault at any given time on the device.
- **Markdown standard**: Notes conform to standard CommonMark or GitHub Flavored Markdown specification.
