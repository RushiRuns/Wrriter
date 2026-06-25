# Quickstart Verification Guide: Wrriter

This guide outlines the end-to-end verification scenarios to validate the functionality of the Wrriter note-taking app.

---

## 1. Vault Setup & First-Launch Onboarding

### Verification Steps
1. Perform a clean install of the app and launch it.
2. Verify the screen displays only a "Select/Create Vault Folder" button.
3. Tap the button, choose a local directory (e.g. create a new folder named `WrriterVault` on device storage), and grant permission.
4. Verify the app navigates to the Inbox screen.
5. Open a system file manager, navigate to the selected folder, and verify the following directory structure exists:
   - `/Inbox`
   - `/Later`
   - `/Read`
   - `/Shop`
   - `/Watch`
   - `/Journal`
   - `/Attachments`

---

## 2. Inbox Quick Dump & Processing Toolbar

### Verification Steps
1. On the Inbox screen, type "Verify Quick Dump" in the bottom input bar and press Enter.
2. Verify a note is added to the Inbox list and the input is cleared.
3. Long-press on the "Verify Quick Dump" row to reveal the processing toolbar.
4. Tap the **Clock** icon (Later).
5. Verify the note is removed from the Inbox screen list.
6. Open the local file manager and verify that the file `Verify-Quick-Dump.md` was moved from `/Inbox` to `/Later`.

---

## 3. WYSIWYG Editor & Wiki Links

### Verification Steps
1. Tap on any note in the list to open the editor.
2. Type `# Spec Testing` and verify it displays as a header, with the `#` symbol hidden.
3. Type `[[New Test Note]]` to create a wiki-link. Verify it shows as a styled blue underlined text link.
4. Tap on the "New Test Note" link.
5. Verify the app automatically creates a note named `New-Test-Note.md` and navigates to the empty editor for this note.

---

## 4. Voice Recording & Drawing Canvas

### Verification Steps
1. Tap the **Microphone** button next to the quick dump box. Verify the icon changes to represent a recording state.
2. Speak for a few seconds, then tap stop.
3. Verify a note is created in the Inbox containing an audio player. Tap play to verify sound.
4. In the editor, tap the "Insert Drawing" icon to open the drawing screen.
5. Sketch a shape, tap save, and verify that the drawing is inserted into the editor. Verify the image file exists in `/Attachments`.

---

## 5. Centralized Tasks manager

### Verification Steps
1. Create a note and type:
   ```markdown
   - [ ] Task Item 1
   - [ ] Task Item 2
   ```
2. Navigate to the Tasks screen from the navigation menu.
3. Verify "Task Item 1" and "Task Item 2" are displayed, grouped under the note's name.
4. Check the box next to "Task Item 1".
5. Navigate back to the note in the editor and verify the text has updated to `- [x] Task Item 1`.

---

## 6. Remote Syncthing API Trigger

### Verification Steps
1. Navigate to Settings and fill out the fields:
   - IP Address & Port: e.g. `http://192.168.1.100:8384`
   - API Key: `your-api-key`
2. Navigate to the Syncthing dashboard tab.
3. Verify it shows "Connected" and displays active devices.
4. Tap the manual "Sync Now" button.
5. Inspect the remote Syncthing PC dashboard logs to confirm a scan request `/rest/db/scan` was received from the phone.

---

## 7. Assistive Touch Floating Overlay

### Verification Steps
1. Go to Settings and enable the Assistive Touch setting. Permit overlay drawings when prompted.
2. Close the app. Verify a semi-transparent floating button is visible on the device screen.
3. Tap the floating button. Verify a menu overlay appears with options: Quick Write, Random Note, Record Voice.
4. Tap **Quick Write**, type a quick message in the floating dialog, and tap Save.
5. Open the app, and verify the quick message is present as a new note in the Inbox.
