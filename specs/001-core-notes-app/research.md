# Technical Research: Wrriter

This document outlines the technical research, choices, and rationales for the core architectural modules of the Wrriter note-taking application.

---

## 1. Storage & Note Metadata Caching

### Decision
Use Android's **Storage Access Framework (SAF)** (Document Tree API) for file system actions, combined with a **transient, in-memory Indexing Cache** rebuilt at startup.

### Rationale
- **Database-Free Requirement**: SQLite or Room are strictly prohibited by the project constitution. Notes are plain markdown (`.md`) files.
- **SAF Compatibility**: Syncthing syncs files inside directories. By letting the user select a directory on their device storage (like standard Documents, Downloads, or a custom Sync folder) via SAF, we allow external apps like Syncthing to read and write these files directly.
- **Search Performance**: Scanning all files on disk for every search query is too slow (can take several seconds on larger vaults). At startup, the app performs a background scan of all `.md` files in the vault, parses their YAML frontmatter, and caches metadata (URI, file path, title, tags, date, and folder status) in memory.
- **Cache Invalidation**: We register a `ContentObserver` on the selected Document URI or rebuild the cache after operations like note creation, rename, or deletion to keep it sync-accurate.

### Alternatives Considered
- **App-Private Storage (`Context.getExternalFilesDir`)**: Easiest to implement, but private app directories are inaccessible to external file sync clients like Syncthing without root access, violating the Syncthing sync requirement.
- **SQLite Metadata Mirroring**: Mirroring frontmatter metadata to a local SQLite database for query performance. Rejected because the constitution forbids SQLite or Room. A transient, in-memory Kotlin index is fast enough for thousands of notes and maintains the database-free principle.

---

## 2. WebView WYSIWYG Editor Integration

### Decision
Use a local WebView loading a customized HTML5/JavaScript editor bundle using a lightweight WYSIWYG Markdown editor engine (e.g. a custom `contenteditable` styled document paired with `marked.js` and `turndown.js` for serialization, or a custom build of **EasyMDE/Milkdown**). It will load resources locally from `assets/` using Android's **WebViewAssetLoader**.

### Rationale
- **Hide Raw Markdown**: The user requires a true Notion-like WYSIWYG editor. Rendering and editing block formats live while hiding syntax markers (like `**`, `#`, etc.) in native Compose `TextField` is extremely complex and prone to edge-case errors. WebView provides a mature layout engine with standard rich text editor capabilities.
- **Local Assets Security**: Android's `WebViewAssetLoader` allows the WebView to load local HTML, CSS, and JS files securely from the `assets/` directory using standard `https://` URLs (e.g. `https://appassets.androidplatform.net/assets/editor.html`). This prevents cross-origin (CORS) errors and security blocks when the editor references local attachments.
- **Bridge Communications**: An `@JavascriptInterface` class (`EditorBridge`) will pass the Markdown content, theme settings (OLED black colors, textures), and font styles from Kotlin to JS on load, and post Markdown content back to Kotlin on every keypress (for auto-saves and break tracking).

### Alternatives Considered
- **Native Compose RichText**: Implementing custom Compose `VisualTransformation` or using libraries like `halilozercan.compose-richtext`. Rejected because they are preview-only or lack robust, true Notion-style blocks (creating new lists, checkboxes, and inline wiki-links) without exposing raw characters.
- **Server-Hosted Editor**: Loading the editor from a remote server. Rejected because the application must be fully functional offline.

---

## 3. Assistive Touch Floating Overlay Service

### Decision
Implement a foreground **Android Service** that injects a floating button into the window manager using **WindowManager overlay flags** (`WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY`).

### Rationale
- **System-Wide Visibility**: To remain visible when the app is closed, the floating widget must run outside the Activity lifecycle. A foreground service with overlay permissions enables drawing custom views on top of other applications.
- **Android Permission**: This requires the `android.permission.SYSTEM_ALERT_WINDOW` permission. The app must guide the user to the system Settings screen to enable this permission.
- **Quick Dialog UI**: Clicking "Quick Write" displays a floating popup card constructed with a local window containing a Compose `ComposeView` for high-performance and lightweight text input.

### Alternatives Considered
- **Accessibility Service**: An accessibility service can draw overlays but is intended for accessibility tools. It has a heavy security warning during activation and is often rejected during Google Play Store review unless strictly required for accessibility.
- **Home Screen Widget**: A standard launcher widget. Rejected because it does not float on top of active third-party apps, violating the Assistive Touch floating capability.

---

## 4. Break Reminder Continuous Writing Logic

### Decision
Track user activity by intercepting keystrokes inside the editor WebView. The JS editor posts a "keypress" event through the Javascript bridge on every character input. A background Handler tracks typing intervals.

### Rationale
- **Continuous Typing Definition**: The user specified that the session is active if at least 1 keypress occurs every 2 minutes. We maintain a last-keypress timestamp.
- **Handler/Coroutine Timer**: When a keypress occurs:
  - If the timer was not active, start the session.
  - If the idle duration exceeds 5 minutes, reset the timer.
  - If the continuous active session reaches 60 minutes, post a standard Android notification.
- **State Persistence**: The active typing state does not need to persist across app force-kills, but settings configurations (break reminder active, reminder duration) must persist in DataStore.

---

## 5. Syncthing REST API Client

### Decision
Use **OkHttp** to build a local network HTTP client that calls the REST API endpoints of the remote Syncthing client running on the user's PC.

### Rationale
- **Local Network API**: Syncthing's daemon exposes a REST API on its port (typically `8384`). The app requests IP, Port, and API Key in Settings, and encrypts the key using `EncryptedSharedPreferences`.
- **API Endpoints**:
  - GET `/rest/system/status` or `/rest/system/connections`: Check if sync is active and get device status.
  - GET `/rest/config/devices`: List connected desktop devices.
  - POST `/rest/db/scan`: Triggers a folder scan on the remote client to pull changes from the phone.
- **Local IP Discovery**: The user enters the exact IP of their remote PC (e.g. `http://192.168.1.100:8384`). The network client must allow cleartext traffic (HTTP) on local IP ranges by configuring a network security config file.
