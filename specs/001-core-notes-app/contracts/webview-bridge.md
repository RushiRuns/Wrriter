# Contract: Editor WebView Bridge (JS-Kotlin)

This contract defines the communication interface between the native Android Kotlin application and the local WYSIWYG Markdown editor WebView.

---

## 1. Kotlin to JavaScript Calls

These functions are invoked by native Kotlin code executing on the WebView instance using `evaluateJavascript()`.

### `loadNoteContent(markdownContent: String, optionsJson: String)`
Loads note body markdown and options.
- **`markdownContent`**: Plain text markdown string (excluding YAML frontmatter).
- **`optionsJson`**: JSON configuration object:
  ```json
  {
    "theme": "oled",
    "font": "inter",
    "texture": "paper" | "ruled" | "grid" | "none",
    "spellcheck": true | false,
    "tabMode": "tab" | "2spaces" | "4spaces"
  }
  ```

### `requestSave()`
Triggers the editor to compile current content and return it. The JS editor must compile HTML to Markdown and invoke `EditorBridge.onSaveContent(markdown)`.

---

## 2. JavaScript to Kotlin Calls (`@JavascriptInterface`)

These functions are exposed by native Kotlin and called from JavaScript using the registered `EditorBridge` interface name.

### `EditorBridge.onSaveContent(markdown: String)`
Posts the edited markdown content back to Kotlin for file-system persistence.
- **`markdown`**: Plain text markdown string.

### `EditorBridge.onLinkClicked(noteTitle: String)`
Triggered when the user taps on an internal wiki-link `[[Note Title]]` in the editor.
- **`noteTitle`**: The title of the target note. Kotlin will locate the file, resolve paths, and create the note if missing.

### `EditorBridge.onKeyPress()`
Triggered on every keyboard entry in the editor to track break reminders and session activity.

### `EditorBridge.onRequestDrawing()`
Triggered when the user clicks the "insert drawing" button in the editor toolbar. Kotlin will open the drawing pad screen.
