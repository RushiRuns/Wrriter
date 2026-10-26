# Wrriter - Definition of Done

> Consulted before closing any feature, and walked line by line at the end of every session.
> A feature with an unticked line is not done. It is "in progress", and it is reported that way.
> "Looks right in the dev build" is not a line on this list.

---

## 1. Behaviour

- [ ] Happy path works in the **packaged build on the reference machine**, not only in the dev build
- [ ] Every Done when line of the feature in its Features doc and in the UI hand-off passes
- [ ] Works in light and dark, on all five accents
- [ ] Empty state exists, is built from the same tokens and components, and has been shown to Krishna
- [ ] Error state exists and is reachable (force it once to prove it)
- [ ] Loading state exists where data is not instant, and does not flash for fast loads
- [ ] Every fallible call returns a `Result`. No thrown exception reaches a window
- [ ] Typed text is never lost: a failed or refused save keeps the text in the editor and retries
- [ ] State survives closing to the tray and reopening, and a restart wherever the Features doc says it should
- [ ] Every action works by keyboard and is in the command palette. Drag is never the only way
- [ ] Works in the quick capture and pop-out windows wherever the editor is involved
- [ ] Works with two vaults, and nothing crosses from one vault into the other
- [ ] Holds up when Syncthing changes, adds or removes files underneath it

## 2. Architecture

- [ ] Layer order respected: UI -> controller -> preload bridge -> main service or worker -> domain -> store
- [ ] No business logic in a component or controller (name, title, link, tag and frontmatter rules live in `shared/domain`)
- [ ] Windows reach files and the index only through the fixed request list
- [ ] Every vault write goes through `SafeWriter`
- [ ] Every change to many files is a job on the pending jobs list
- [ ] File names come only from `shared/domain/names`. Frontmatter edits come only from `shared/domain/frontmatter`
- [ ] No clock, ID or random value read in `shared/`
- [ ] No synchronous file call in the main process. The lag monitor shows nothing over 50 ms
- [ ] No network code beyond the dropped-image downloader
- [ ] The layer import check passes
- [ ] ARCHITECTURE.md and SYSTEM.md rules not violated. If one had to be bent, the session stopped and said so
- [ ] Nothing built that depends on an open decision

## 3. UI and Design

- [ ] Matches the mockup screenshot at the same window size, light and dark, with every visible difference listed
- [ ] Nothing "improved", tidied or restyled. Anything that looks wrong in the mockup is reported and kept as drawn
- [ ] Tokens only. The token check passes
- [ ] Inside the note pane, nothing follows the accent except callouts, tags and the colour set
- [ ] The contrast check passes on all five accents in both themes
- [ ] Every control has an accessible name and the focus ring from the UI hand-off
- [ ] Icons copied from the UI reference only
- [ ] Every animation uses speeds and curves from the list, is interruptible, is 300 ms or less, and its site is listed in Features 8 or the UI hand-off section 9
- [ ] Typing, undo, redo, scrolling, dragging, opening a note and list results are not animated
- [ ] Reduced motion handled. Reviewed with the slow-motion switch on
- [ ] Empty metadata renders nothing (no properties line when there are no tags or status)
- [ ] Holds at the narrow widths in the UI hand-off (976 px with both panes open, and the 360 px floor), and at every note margin from 16 to 96 px
- [ ] No long dash in any text the app shows. Wording is sentence case and plain, and an error says what to do

## 4. Performance

- [ ] Any list that can grow without bound is virtualised and paged from the index with "continue after this row"
- [ ] Nothing reads note files while a list is drawn or scrolled
- [ ] No query per row
- [ ] A key press does the least work possible. A trace of fast typing shows no whole-note serialization
- [ ] Animation uses transform and opacity only, except the listed size changes
- [ ] Nothing new runs before the first frame
- [ ] Nothing runs while idle in the tray
- [ ] The quick benchmark set passes (no result 20% worse than the baseline)
- [ ] If a list, startup, the editor path, a job or memory was touched: measured on the packaged build on the reference machine against PERFORMANCE.md, the numbers recorded in the milestone report and the changelog, and every miss given a cause and a first fix

## 5. Notes and Files Safety

- [ ] The round-trip check passes. Any new syntax has its own sample note
- [ ] Opening a note without editing leaves the file and its modified time unchanged
- [ ] Saving after an edit changes only the edited blocks
- [ ] Where the feature writes files: ending the process mid-write 100 times never damages a note
- [ ] Where the feature runs a job: the random-stop test passes, 100 times
- [ ] Any format change has a version bump, an upgrade path or a rebuild, a test, and a SCHEMA.md update in the same commit
- [ ] Nothing new appears in the vault that SCHEMA.md does not list
- [ ] Names are valid on Windows, and no two differ only by case
- [ ] Nothing about sync or this PC is written inside a note
- [ ] Deletes go to the Windows Recycle Bin

## 6. Security and Privacy

- [ ] No new capability (network, file area, permission). If one is truly needed, ARCHITECTURE.md is changed first and Krishna agrees
- [ ] Every new request checks its sender and arguments, and every path stays inside the vault
- [ ] Note content is never run. A note with a script tag shows it as text
- [ ] Logs contain no note text and no names of encrypted notes
- [ ] Works with the network cable unplugged
- [ ] No new dependency without a DEPENDENCIES.md entry and review
- [ ] (Version 2) No readable copy of an encrypted note anywhere on disk

## 7. Tests

- [ ] At least one test written for the feature
- [ ] Domain logic: unit tests, including the edge and empty cases
- [ ] The round-trip check passes, and any new note syntax added a sample note
- [ ] Anything touching `SafeWriter` or a job: the kill test or the random-stop test passes
- [ ] Anything touching the index: the delete-and-rebuild test passes
- [ ] End-to-end test of the empty state, the filled state and one interaction, with names and roles asserted
- [ ] Every build check is green: tokens, contrast, motion, long dashes, layer imports, synchronous calls, types, lint

## 8. Documentation and Hygiene

- [ ] UTILITIES.md checked **before** writing anything new, and updated if anything reusable was created
- [ ] Any difference from the Features docs or the UI hand-off is reported to Krishna, never made silently
- [ ] CHANGELOG_INTERNAL.md entry added
- [ ] New pattern or library has an ADR
- [ ] No dead code, no commented-out blocks, no TODO without an owner and a reason
- [ ] Scope respected: no files touched outside the session's declared scope
- [ ] A UI slice was shown to Krishna beside the mockup screenshots before the next one started
- [ ] Committed with the format `M<N>: <feature> - <one line>`

---

## When a line cannot be ticked

Say which line, why, and what it blocks. Do not tick it and do not delete it. A feature can ship with a documented exception that **Krishna** accepted. It cannot ship with a silent one.
