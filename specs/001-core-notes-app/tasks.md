# Tasks: Wrriter Note-Taking App

**Input**: Design documents from `specs/001-core-notes-app/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: JUnit JVM unit tests are required for frontmatter parsing, file systems, and timing calculations (Phase 13).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project dependency configurations and system registrations.

- [x] T001 Configure build dependencies and permissions in `app/build.gradle.kts`
- [x] T002 [P] Setup Android Manifest permissions and service declarations in `app/src/main/AndroidManifest.xml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core files storage, data serialization, and user preferences management.

**⚠️ CRITICAL**: No user story implementation can begin until these foundational modules are complete.

- [x] T003 Setup settings preferences storage in `app/src/main/java/com/rushi/wrriter/data/PreferencesManager.kt`
- [x] T004 [P] Create note metadata schemas in `app/src/main/java/com/rushi/wrriter/data/NoteMetadata.kt`
- [x] T005 Implement core directory check and SAF folder cache in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Vault Onboarding & Inbox Quick Capture (Priority: P1) 🎯 MVP

**Goal**: Setup vault workspace and enable immediate text/audio capture to the Inbox.

**Independent Test**: Perform clean launch, select vault directory, submit a text dump, verify file is created in `/Inbox`.

- [x] T006 [US1] Create directory selector interface in `app/src/main/java/com/rushi/wrriter/ui/screens/OnboardingScreen.kt`
- [x] T007 [US1] Implement note creation and lists loading in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`
- [x] T008 [US1] Create Inbox lists layout UI in `app/src/main/java/com/rushi/wrriter/ui/screens/InboxScreen.kt`
- [x] T009 [US1] Implement Quick Dump text submit bar in `app/src/main/java/com/rushi/wrriter/ui/screens/InboxScreen.kt`
- [x] T010 [US1] Implement audio recorder toggle for quick voice capture in `app/src/main/java/com/rushi/wrriter/ui/screens/InboxScreen.kt`

**Checkpoint**: Onboarding and Inbox capture are fully functional.

---

## Phase 4: User Story 2 - WYSIWYG Editor & Internal Wiki Links (Priority: P1) 🎯 MVP

**Goal**: Visual Notion-style writing canvas and double-bracket note creation/navigation.

**Independent Test**: Open editor, enter `# Hello`, verify symbol hides. Enter `[[Link]]` and tap it to verify navigation.

- [x] T011 [US2] Create editor HTML page canvas in `app/src/main/assets/editor.html`
- [x] T012 [P] [US2] Write JavaScript markdown compilation and bridges in `app/src/main/assets/editor.js`
- [x] T013 [P] [US2] Write stylesheet for hidden Markdown formatting tags in `app/src/main/assets/editor.css`
- [x] T014 [US2] Create WebView Compose wrapper in `app/src/main/java/com/rushi/wrriter/ui/screens/EditorScreen.kt`
- [x] T015 [US2] Implement JS-Kotlin `@JavascriptInterface` bridge in `app/src/main/java/com/rushi/wrriter/ui/screens/EditorScreen.kt`
- [x] T016 [US2] Implement `[[Wiki Link]]` path resolution and note creator in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`

**Checkpoint**: WYSIWYG writing and internal wiki-links are fully functional.

---

## Phase 5: User Story 3 - Inbox Processing Toolbar & Nested Folders (Priority: P2)

**Goal**: Long-press notes in Inbox to move or delete, and create deep custom nested folder trees.

**Independent Test**: Long-press a note row, choose target folder, verify note moves out of Inbox and path changes.

- [x] T017 [US3] Create row action toolbar layout in `app/src/main/java/com/rushi/wrriter/ui/components/InboxToolbar.kt`
- [x] T018 [US3] Implement physical note moving and deleting in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`
- [x] T019 [US3] Connect toolbar actions to file moving operations in `app/src/main/java/com/rushi/wrriter/ui/screens/InboxScreen.kt`
- [x] T020 [US3] Implement custom folder selector with nested folder creator in `app/src/main/java/com/rushi/wrriter/ui/components/InboxToolbar.kt`

**Checkpoint**: Inbox note filing and nested folders are fully functional.

---

## Phase 6: User Story 4 - Drawing Pad & Voice Attachments (Priority: P2)

**Goal**: Embed canvas sketches and recorded `.m4a` voice recordings in note documents.

**Independent Test**: Open sketch canvas, save, verify drawing embeds in editor and PNG exists in `/Attachments`.

- [x] T021 [US4] Create drawing screen canvas UI in `app/src/main/java/com/rushi/wrriter/ui/screens/DrawingPadScreen.kt`
- [x] T022 [US4] Implement drawing exporter to `Attachments/` folder in `app/src/main/java/com/rushi/wrriter/ui/screens/DrawingPadScreen.kt`
- [x] T023 [US4] Implement media elements insertion and visual styling in `app/src/main/assets/editor.js`

---

## Phase 7: User Story 5 - Daily Journal & Calendar Interface (Priority: P2)

**Goal**: Create visual calendar dashboard mapping dates to diary entries.

**Independent Test**: Navigate to Journal, select a calendar date, and verify corresponding date-named note loads.

- [x] T024 [US5] Implement auto-creation of `Journal/YYYY-MM-DD.md` in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`
- [x] T025 [US5] Build Compose Calendar grid component showing entry indicators in `app/src/main/java/com/rushi/wrriter/ui/components/CalendarGrid.kt`
- [x] T026 [US5] Create Journal dashboard screen in `app/src/main/java/com/rushi/wrriter/ui/screens/JournalScreen.kt`

---

## Phase 8: User Story 6 - Centralized Tasks Interface (Priority: P3)

**Goal**: Consolidated tasks screen listing checkboxes and updating source notes.

**Independent Test**: Open Tasks screen, check a task, open source note, verify text updates to `- [x]`.

- [x] T027 [US6] Implement checklist markdown line scanner and updater in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`
- [x] T028 [US6] Create Tasks aggregated dashboard UI in `app/src/main/java/com/rushi/wrriter/ui/screens/TasksScreen.kt`

---

## Phase 9: User Story 7 - Full-Text Search & Shake-to-Random (Priority: P3)

**Goal**: Quick search indexing and accelerator shake-gesture triggers.

**Independent Test**: Shake device, verify vibration and Toast message, confirm random note opens.

- [ ] T029 [US7] Implement in-memory vault search scanner and cache in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`
- [ ] T030 [US7] Create search bar filter header in `app/src/main/java/com/rushi/wrriter/ui/components/SearchBar.kt`
- [ ] T031 [US7] Implement SensorEventListener shake detector in `app/src/main/java/com/rushi/wrriter/sensor/ShakeDetector.kt`
- [ ] T032 [US7] Bind shake triggers to haptic feedback and editor loader in `app/src/main/java/com/rushi/wrriter/MainActivity.kt`

---

## Phase 10: User Story 8 - Remote PC Syncthing REST API Client (Priority: P3)

**Goal**: REST API client querying status of local network Syncthing PC.

**Independent Test**: Configure PC settings, check status shows Connected and active devices list.

- [ ] T033 [US8] Create network security config XML file in `app/src/main/res/xml/network_security_config.xml`
- [ ] T034 [US8] Implement OkHttp network client for Syncthing API in `app/src/main/java/com/rushi/wrriter/network/SyncthingClient.kt`
- [ ] T035 [US8] Integrate Syncthing status board UI in `app/src/main/java/com/rushi/wrriter/ui/screens/SettingsScreen.kt`

---

## Phase 11: User Story 9 - Assistive Touch Floating Overlay Service (Priority: P3)

**Goal**: Draggable float button showing Quick Write dialog and float recorder overlay.

**Independent Test**: Tap float button, select Quick Write, save text, check note creates in Inbox in background.

- [ ] T036 [US9] Create foreground service window overlays manager in `app/src/main/java/com/rushi/wrriter/service/FloatingWidgetService.kt`
- [ ] T037 [US9] Implement draggable overlay action button in `app/src/main/java/com/rushi/wrriter/service/FloatingWidgetService.kt`
- [ ] T038 [US9] Implement floating Quick Write dialog and float recording popup in `app/src/main/java/com/rushi/wrriter/service/FloatingWidgetService.kt`

---

## Phase 12: User Story 10 - Settings, Break Reminders, & Textures (Priority: P3)

**Goal**: Configure font styles, editor backgrounds, streaks calculations, and typing alarms.

- [ ] T039 [US10] Add textures patterns (paper grain CSS, ruled grid line SVG) in `app/src/main/assets/editor.css` and `app/src/main/assets/editor.js`
- [ ] T040 [US10] Implement WebView bridge keystroke callback listener in `app/src/main/java/com/rushi/wrriter/ui/screens/EditorScreen.kt`
- [ ] T041 [US10] Build continuous writing time tracker and alarms service in `app/src/main/java/com/rushi/wrriter/service/BreakReminderService.kt`
- [ ] T042 [US10] Implement SAF-based vault import and export copiers in `app/src/main/java/com/rushi/wrriter/data/VaultManager.kt`
- [ ] T043 [US10] Implement stats analyzer (streak days, notes, words) in `app/src/main/java/com/rushi/wrriter/ui/screens/StatisticsScreen.kt`
- [ ] T044 [US10] Build note-level AlarmManager notifications scheduler in `app/src/main/java/com/rushi/wrriter/receiver/AlarmReceiver.kt`

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Styling, formatting refinements, and unit test validations.

- [ ] T045 Build Compose global OLED Black theme layout in `app/src/main/java/com/rushi/wrriter/ui/theme/Theme.kt`
- [ ] T046 [P] Add unit tests for YAML frontmatter parses/writes in `app/src/test/java/com/rushi/wrriter/FrontmatterParserTest.kt`
- [ ] T047 [P] Add unit tests for files directory scanner in `app/src/test/java/com/rushi/wrriter/VaultManagerTest.kt`
- [ ] T048 [P] Add unit tests for break reminder timing calculations in `app/src/test/java/com/rushi/wrriter/BreakReminderTest.kt`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion. **BLOCKS** all subsequent phases.
- **User Stories 1 & 2 (Phases 3 & 4)**: Primary MVP. Must complete sequentially.
- **User Stories 3 to 10 (Phases 5 to 12)**: Can run in parallel or sequentially.
- **Polish (Phase 13)**: Run after all desired stories are completed.

---

## Parallel Example: Foundational Files
```bash
# Launch these two model setup tasks in parallel:
Task: "T002 Setup Android Manifest permissions and service declarations"
Task: "T004 Create note metadata schemas"
```

---

## Implementation Strategy

### MVP First (User Story 1 & 2 Only)
1. Complete Setup (Phase 1) and Foundational (Phase 2).
2. Complete Vault Onboarding & Inbox Quick Capture (Phase 3).
3. Complete WYSIWYG Editor & Wiki Links (Phase 4).
4. **STOP and VALIDATE**: Verify local file system captures and WYSIWYG rendering function cleanly.
5. Deploy MVP to client.
