# Wrriter - SYSTEM.md

> Conventions, patterns, and "never do X" rules for every line of code in this repo.
> ARCHITECTURE.md decides the structure: processes, layers, who may call whom.
> This file decides the habits: how things are named, shaped, written, tested, and committed.
> If the two ever disagree, ARCHITECTURE.md wins and this file gets fixed.

Every Antigravity session starts with this file and ARCHITECTURE.md in context. Antigravity loads project rules automatically from `.agents/rules/` (and root `AGENTS.md`), and every session starts with the template in section 9 naming all relevant governance files explicitly.

---

## 1. Naming

| Thing | Convention | Example |
|---|---|---|
| React component file | PascalCase, one component per file | `NoteRow.tsx` |
| Feature view (no state) | `<Feature>View` | `NoteListView` |
| Feature container (wires controller to view) | `<Feature>` | `NoteList` |
| Controller hook | `use<Feature>` | `useNoteList` |
| View state | `<Feature>State`, a discriminated union | `NoteListState` |
| User intents | `<Feature>Event`, a discriminated union | `{ type: 'pinToggled', path }` |
| Main service | `<Domain>Service` | `NoteService`, `JobService` |
| Store | Noun for what it holds or does | `SafeWriter`, `VaultReader`, `JobsStore`, `IndexDb` |
| IPC request | `domain.verb` | `note.save`, `folder.move`, `index.notePage` |
| Domain module | Topic name, top-level pure functions | `names.ts`, `wikilinks.ts` |
| Other modules | kebab-case | `safe-writer.ts`, `use-note-list.ts` |
| Token | The CSS custom property name from the UI reference | `--tx2`, `--s-4`, `--t-base` |
| Test | A sentence | `it('keeps CRLF line endings when one paragraph is edited')` |
| Frontmatter key | As in SCHEMA.md, lowercase | `tags`, `status`, `created` |
| Branch | `m<N>/<feature>` | `m1/safe-writer` |

Domain words are the ones the Features docs use: Vault, Note, Folder, Tag, Property, Status, Inbox, Journal, Pinned, Wikilink, Backlink, Quick capture, Pop-out, Job, Attachment, File chip, Callout. Do not rename them in code.

---

## 2. TypeScript Rules

- `strict` mode on, plus `noUncheckedIndexedAccess`. The build fails on a type error.
- No `any`. Data from outside a process (IPC arguments, files, the index) arrives as `unknown` and is narrowed by a validator.
- No non-null assertion (`!`). Handle the missing case, or fail with a clear message when it is a programmer error.
- No `as` cast except right after a validator, with a comment saying why it is safe.
- Data passed between layers is `readonly`. Update by copying, never by mutating a shared object.
- Closed sets are discriminated unions. A `switch` over one is exhaustive with a `never` check and no `default`.
- No TypeScript `enum`. Use string literal unions. Any value written to disk or sent between processes is an explicit string, never derived from a code name, so renaming a constant cannot change a file.
- Named exports only. No default exports.
- Exported functions have explicit return types.
- No floating promises. Every promise is awaited or handled. A lint rule enforces it.
- A function that does more than one thing gets split. A file over about 400 lines gets split.
- Comments explain why, never what. No commented-out code.

---

## 3. Feature Shape

One folder per feature under `src/renderer/features/<feature>/`:

```
note-list/
  NoteListView.tsx      stateless: (state, onEvent) -> UI
  NoteList.tsx          wires the controller to the view
  use-note-list.ts      the controller
  note-list-state.ts    state and events in one file
  components/           pieces used only by this feature
```

The view and container split is mandatory. A view takes plain props, so it can be shown in the development component gallery and tested without a running main process.

### Controller pattern

The state library is not decided yet (DEPENDENCIES.md). This example uses plain React state. The shape stays the same whichever is chosen.

```tsx
export function useNoteList(folder: FolderRef): readonly [NoteListState, (e: NoteListEvent) => void] {
  const [state, setState] = useState<NoteListState>({ kind: 'loading' });

  useEffect(() => {
    const sub = window.wrriter.index.watchNotePage({ folder, after: null, limit: 100 }, (page) => {
      setState({ kind: 'content', rows: page.rows, next: page.next });
    });
    return () => sub.close();
  }, [folder]);

  const onEvent = useCallback(async (e: NoteListEvent): Promise<void> => {
    switch (e.type) {
      case 'pinToggled': {
        const r = await window.wrriter.note.setPinned({ path: e.path, pinned: e.pinned });
        if (!r.ok) showNotice(toMessage(r.error));
        return;
      }
      case 'opened': {
        openInTab(e.path, { newTab: e.newTab });
        return;
      }
    }
  }, []);

  return [state, onEvent] as const;
}
```

Rules:
- One state value per view. It is a snapshot.
- One-shot things (a notice, moving focus, opening a tab) go through a call or an event, never a boolean in state that someone must remember to reset.
- Reads come from index queries and main process events. Writes go through `window.wrriter`. A controller never reads a file.
- No business rules in a controller. If it has an `if` about what a note, link or tag may do, that `if` belongs in `shared/domain` or a main service.
- Note text never enters a controller's state. The editor owns it.

### Request handler and service pattern

```ts
// src/main/ipc/router.ts: every request enters here
handle('note.save', SaveNoteArgs, async (args, sender) => {
  const vault = vaults.forSender(sender);            // the sender is checked
  if (!vault.ok) return vault;
  const target = vault.value.resolveInside(args.path); // outsideVault if it escapes
  if (!target.ok) return target;
  return notes.save(vault.value, target.value, args.text);
});
```

```ts
// src/main/services/note-service.ts
export class NoteService {
  constructor(
    private readonly reader: VaultReader,
    private readonly writer: SafeWriter,
    private readonly index: IndexClient,
    private readonly clock: Clock,
  ) {}

  async save(vault: Vault, path: VaultPath, text: string): Promise<Result<SaveOutcome>> {
    const current = await this.reader.readBytes(vault, path);
    if (!current.ok) return current;
    const plan = planSave(current.value, text);            // pure, shared/markdown
    if (plan.unchanged) return ok({ written: false });
    const written = await this.writer.write(vault, path, plan.bytes);
    if (!written.ok) return written;                       // text stays in the editor, retry follows
    this.index.noteChanged(vault, path);                   // after the write completes
    return ok({ written: true });
  }
}
```

A service method: validate through `shared/domain`, do the work through its own stores, then send index updates and other side effects after the write completes, then return a `Result`.

### Errors

```ts
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError };

export type AppError =
  | { readonly kind: 'validation'; readonly field: string; readonly reason: string }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'outsideVault' }
  | { readonly kind: 'locked'; readonly path: string }        // another app holds the file
  | { readonly kind: 'diskFull' }
  | { readonly kind: 'vaultUnavailable' }
  | { readonly kind: 'ruleViolation'; readonly rule: string }
  | { readonly kind: 'unexpected'; readonly message: string };
```

- A `Result` crosses processes as plain data. Errors never cross as thrown exceptions.
- Stores, services and workers return `Result` for expected failures. They throw only for programmer errors.
- A catch block logs (without note text) and converts. It never silently ignores.
- The interface shows a short message from `toMessage()`: what went wrong and what to do. No apology, no stack trace, no raw exception text (UI hand-off section 11).

---

## 4. React Rules

- **Views are stateless.** State and event handlers come from the container.
- **Note text never enters React state or a store.** The editor owns it. The interface reads only counts and the saved state.
- **Stable keys.** Lists use stable identities from the index, never an array index, because rows reorder.
- **Virtualise** any list that can grow without bound. Only rows on screen are drawn.
- **Cheap rows.** Rows are memoised. Props are primitives or frozen objects. No new object or array literals passed into rows in a long list.
- **Motion outside React.** Animation, scroll and drag values never go through React state. CSS transitions, the Web Animations API and refs only.
- **Effects.** `useEffect` reacts to a key (subscribing, focusing). It is never where a business action starts.
- **Gallery.** Every shared component and every view has an entry in the development component gallery with fake data, in light and dark, on all five accents. A component without one is not done.
- **Tokens only.** `var(--s-4)`, `var(--tx2)`, `var(--r-s)`. No literal `16px`, `#1D1D1F`, `14px` or `180ms` in a component or stylesheet outside `tokens.css`.
- **Native elements first.** `button`, `input`, `ul`. Roles where needed: `menu`, `menuitem`, `menuitemcheckbox`, `tablist`, `tab`, `tree`, `treeitem`. Every control has an accessible name.
- **Focus.** Every button shows the focus ring from the UI hand-off. A closed pane's contents are out of the tab order.
- **Hover controls.** A control that appears on hover (the fold arrow, the block grip) also appears while the caret or keyboard focus is in that block.
- **No layout shift.** Notices and menus overlay content. Images reserve their height from the saved width, so text never jumps when they load.
- **Keyboard.** Every action has a keyboard path and a palette command. Drag is never the only way.

---

## 5. Time, IDs, Ordering

- **Time.** Domain code and services take a `Clock` (an interface in `shared/domain`). Production uses system time. Tests use a fixed clock. No `Date.now()` or `new Date()` without arguments outside the `Clock` implementation. `performance.now()` is allowed for frame timing only.
- **Today.** Always `clock.today()`, the PC's local date. It moves on past midnight while Wrriter is open (Features 3).
- **Formats.** Exactly as listed in SCHEMA.md: `remind` as `YYYY-MM-DDTHH:mm` in local time, journal notes as `YYYY-MM-DD.md`, quick notes as `Quick note YYYY-MM-DD HH.mm`, pasted images as `Pasted image YYYYMMDD-HHmmss.png`. The `created` format is open in SCHEMA.md.
- **IDs.** The vault id is a UUID v4 from an injected `IdGenerator`. Notes have no hidden IDs. A note is identified by its path inside the vault.
- **Ordering.** Manual order uses fractional keys from `shared/domain/ordering`. A drag writes one entry. Never renumber a whole folder for one move. A rebalance, when keys get too close, is its own operation.

---

## 6. Files and Index Conventions

- Inside the app, a note is a vault path: relative to the vault root, forward slashes. Stores turn it into a Windows path. Names are compared without regard to case, as Windows does.
- Every path that comes from a window is resolved and checked to be inside the vault before anything else happens.
- Every vault write goes through `SafeWriter`. It writes a dot-prefixed temp file beside the target, flushes it to disk, renames it over the target, keeps line endings and the byte order mark, and tells the watcher to ignore the event.
- Every change to many files is a job (ARCHITECTURE.md, Write path: many notes).
- The text of a note is read only in the index worker for indexing, in the editor when it opens, and by a job that changes it. Never while a list scrolls.
- Index queries use prepared statements with bound parameters. No string concatenation into SQL. Search text goes through one function, `ftsEscape`, and nowhere else.
- List pages use "continue after this row". Never `OFFSET`.
- Counts shown in the interface (folder counts, tag counts, backlinks) come from `COUNT` queries, not from loading rows.
- File names come only from `shared/domain/names`. Frontmatter edits come only from `shared/domain/frontmatter`.

---

## 7. Touching a Stored Format

Before changing anything Wrriter stores:

1. Find its scope in SCHEMA.md: `note`, `vault-meta`, `local` or `cache`.
2. If it changes what is written into a note (new syntax, a new frontmatter key): Krishna says yes first, a sample note is added to `tests/samples/`, and the round-trip check covers it.
3. If it is a `vault-meta` or `local` file: bump its version, write the upgrade from the old version, and test both.
4. If it is a `cache`: bump its version so the old one is deleted and rebuilt.
5. If it affects sync readiness (names, the vault id, anything in `.wrriter`), say so in SCHEMA.md.

The note save path, the only way a note reaches disk:

```ts
const plan = planSave(original, edited);   // pure: only edited blocks are re-serialized
if (plan.unchanged) return ok({ written: false });
return this.writer.write(vault, path, plan.bytes);
```

A service or worker that calls `fs` directly to write a vault file is a rejection.

---

## 8. Testing

The test tools are not chosen yet (DEPENDENCIES.md). These rules hold whichever are chosen.

- **Domain** (`shared/`): unit tests, table-driven. Target 100% of branches for names, titles, frontmatter, wikilinks and link rewriting, link resolution, tags, ordering, search filters, job plans and conflict names.
- **Round-trip check:** every sample note in `tests/samples/` is opened and saved without editing, and must stay byte for byte the same. Then one paragraph in each is edited, and only that paragraph may differ. It runs on every build and fails the build.
- **SafeWriter:** the Wrriter process is ended in the middle of a save of a large note, 100 times, and no note is ever damaged. Plus a locked file, Windows line endings and a byte order mark.
- **Jobs:** the random-stop test, 100 times each, for renaming a note with 5,000 links, moving a folder of 5,000 notes and renaming a tag used by 5,000 notes. After each restart every link is right and nothing else in any note changed.
- **Index:** against real better-sqlite3 inside a worker. Every query, every rebuild, and deleting the file.
- **Services:** with fake stores, a fixed `Clock` and a fixed `IdGenerator`. The happy path and each error path.
- **Controllers:** state and events, with a fake `window.wrriter`.
- **End to end:** on the packaged app, each view's empty state, filled state and one interaction. Accessible names and roles are asserted, not just text.
- **Build checks:** tokens, contrast on all five accents in both themes, motion values, long dashes, layer imports, and no synchronous file calls in the main process.
- **Performance:** the quick benchmark set on every build, failing at 20% worse than the baseline. The full set on the reference machine per milestone (PERFORMANCE.md).
- No real notes of Krishna's are used in any test. The generated vault and the sample notes only.
- No flaky tests. A flaky test is fixed or deleted the same day.

---

## 9. Git and Session Conventions

- One session = one feature = one commit. The session goal is one sentence.
- Commit message: `M<N>: <feature> - <one line>`.
- Update before committing: CHANGELOG_INTERNAL.md, UTILITIES.md if anything reusable was created, and the DONE.md checklist walked.
- A session never touches files outside its declared scope. If the work needs another file, stop and ask.
- No drive-by refactors. A refactor is its own session with its own scope.
- If a rule in ARCHITECTURE.md or SYSTEM.md blocks the straightforward solution, stop and say so. Do not route around it.
- Dependencies, format changes, SCHEMA.md and the sample notes need Krishna's review before they land.
- A finished UI slice is shown to Krishna next to the matching mockup screenshot, same window size, light and dark, with every visible difference listed, before the next slice starts.

### Session template (copy for every Antigravity session)

```
# Session Goal
[One sentence. One thing only.]

# Read First
- ARCHITECTURE.md - section: [layer or process touched]
- SYSTEM.md - sections: [which apply]
- Features doc: [number and section that describes the behaviour]
- UI hand-off: [section] and UI reference: [part] - [if building any UI]
- SCHEMA.md - [if a stored format or note syntax is touched]
- PERFORMANCE.md - [if a list, startup, the editor path, a job or memory is touched]
- UTILITIES.md - check BEFORE creating any component, helper or domain function
- DEPENDENCIES.md - [only if a library is being considered]

# Scope
- Create: [exact paths]
- Modify: [exact paths]
- Do NOT touch: [exact paths]

# Definition of Done
- [ ] Per DONE.md, every line
- [ ] Every Done when line of the feature in its Features doc and the UI hand-off
- [ ] Round-trip check and build checks pass
- [ ] Tests written and passing
- [ ] CHANGELOG_INTERNAL.md and UTILITIES.md updated
- [ ] Committed with the required message format

# North Star Check
- [ ] Convenience: is this extremely convenient for the note-taking it serves? Any friction left in?
- [ ] Speed: do the budget rows this touches still hold?
- [ ] Feel: pleasant and minimal, and the motion smooth and never in the way?
- [ ] Safety: can this damage a note, lose typed text, or leave a job half done?
- [ ] Match: does it match the mockup exactly, with every difference listed?
```

---

## 10. NEVER DO

### Architecture
- Never call `window.wrriter`, read a file or import from `main/` in a component.
- Never put an `if` about note, link, tag or name rules in a component or controller.
- Never import Node, Electron or the DOM into `shared/`.
- Never expose `ipcRenderer`, Node, `fs` or `shell` to a window.
- Never accept a request that is not on the fixed list.
- Never write a vault file except through `SafeWriter`.
- Never edit many files outside the pending jobs list.
- Never open the SQLite file outside the index worker.
- Never build a file name outside `shared/domain/names`, or edit frontmatter outside `shared/domain/frontmatter`.
- Never add a package or a top-level source folder without an ADR.

### Notes and files
- Never write a note whose bytes did not change.
- Never reformat a block that was not edited.
- Never change the line endings, byte order mark, final newline, bullet character, numbering or indentation a note already has.
- Never touch a frontmatter key Wrriter does not own, or reorder the keys.
- Never change text that Wrriter keeps word for word (comments, block IDs, embeds, raw HTML, Dataview and Templater blocks, maths, Mermaid, custom task states).
- Never undo a half-finished job. Finish it.
- Never delete a note or folder except to the Windows Recycle Bin. (Version 2 has one written exception for encryption.)
- Never delete an attachment by itself. (Version 2 has one written exception for encryption, after telling the user.)
- Never store a path on this PC inside a note.
- Never put anything in a vault that SCHEMA.md does not list.
- Never read, change or show a folder whose name starts with a dot, except Wrriter's own `.wrriter`.
- Never run anything from a note: no Dataview, no Templater, no script, no raw HTML.
- Never rename a journal note from its first line.
- Never create two names that differ only by upper and lower case.
- Never build SQL by string concatenation.
- Never put note text in logs, or the name of an encrypted note.

### Concurrency and time
- Never call a synchronous file function in the main process after startup.
- Never block the main process for more than 50 ms.
- Never do heavy work in a window: indexing, a job, an import, a full parse of a large note.
- Never turn the whole note back into markdown on a key press.
- Never read the clock or generate an ID or random value inside `shared/`.
- Never call `Date.now()` or `new Date()` without arguments outside the `Clock` implementation.
- Never run a timer, poll or animation while idle in the tray, except the next reminder (Version 2).

### UI
- Never hardcode a colour, spacing, font size, radius, duration or curve.
- Never let the accent colour anything inside the note pane except callouts, tags and the colour set.
- Never "improve", tidy or restyle what the mockup shows. Report what looks wrong and keep it as drawn.
- Never build a part the mockup does not draw without showing it to Krishna.
- Never add an animation site beyond Features 8 and the UI hand-off section 9 without an ADR.
- Never animate typing, undo, redo, scrolling, dragging, resizing, opening a note, switching tabs or list results.
- Never animate anything but transform and opacity, except the listed size changes.
- Never animate with timed scripts. Never let an animation block input or run longer than 300 ms.
- Never put note text, scroll positions or animation values in React state.
- Never use an array index as a key for a list that reorders.
- Never make drag the only way to do something.
- Never show a white flash at start or in a new window.
- Never show a long dash in the app's own text.
- Never write interface text that sounds like marketing. Plain words, sentence case, no exclamation marks, no apologies.

### Platform and privacy
- Never load remote content into a window, or allow navigation or new windows.
- Never use `file://` for vault files.
- Never trust a path from a window before resolving it inside the vault.
- Never start a network request except the dropped-image download.
- Never install, start or control Syncthing.
- Never check for updates or update by itself.
- Never need administrator rights.
- Never store the encryption password, or write a readable copy of an encrypted note to disk (Version 2).

### Dependencies and process
- Never add a dependency that is paid, closed-source, needs an account, phones home, or is not listed in DEPENDENCIES.md.
- Never add a library to avoid writing 20 lines of code.
- Never make a change outside the declared session scope.
- Never mark a feature done without the DONE.md checklist.
- Never refactor while building a feature.
- Never route around a blocked rule. Stop and ask.
- Never loosen a performance number. Report the miss and let Krishna decide.
- Never edit SCHEMA.md, a format version or the sample notes without Krishna's review.
- Never build a part that depends on an open decision.
