# Wrriter UI hand-off: look, feel and behaviour

Oct 25, 2026 · @Krishna

This doc tells Antigravity how to make Wrriter look and move exactly like the Editor view mockup. The rule is to match the mockup, not to reinterpret it. Features 1 to 9 still say what the app does. This doc says how it looks and feels, and it wins wherever it disagrees with them (section 1 lists every place). A second doc, "Wrriter UI reference: exact styling from the editor view mockup", holds the exact values copied from the mockup, plus every icon. Screenshots of the mockup in light and dark go with both. Each part has build rules for Antigravity and a done checklist, in the same shape as the Features docs.

## How to read this doc

**Build rules**

- The mockup is the Editor view board, published 25 Oct 2026. Match it in light and dark, at 1440 x 900 and at narrower window widths.
- Copy values, do not eyeball. Every colour, size, space, radius, duration and curve comes from the reference doc. If a value is missing, ask Krishna. Do not invent one.
- Do not tidy, restyle or "improve" anything. If something looks wrong in the mockup, say so in the milestone report and keep it as drawn until Krishna answers.
- Order of authority: this doc, then the reference doc, then the screenshots, then Features 1 to 9.
- Section 12 lists things that exist only to preview options in the mockup. They are not built.
- Section 13 lists things the mockup does not draw. Build them from the same tokens and components, and show them to Krishna before moving on.
- Section 14 lists decisions that wait for Krishna. Do not build those parts until he answers. Everything else can start now.
- Every colour, size and duration lives in one token list in code. A build check fails if a style uses a raw colour, a spacing or font size that is not on the lists, or a transition time or curve that is not from the Features 8 list.

**Done when**

- [ ] Each finished slice is shown to Krishna next to the matching mockup screenshot, same window size, light and dark, with every visible difference listed
- [ ] The token check passes on every build
- [ ] The app looks the same on a PC that does not have Inter installed (Features 1)

## 1. What this changes in Features 1 to 9

Where the older docs and this doc disagree, this doc wins. Nothing else in Features 1 to 9 is touched.

| # | Topic | Older docs said | Now |
| --- | --- | --- | --- |
| 1 | Window buttons | Use Electron's title bar overlay, keep the native buttons, Wrriter draws none (Features 1) | Wrriter draws its own three round buttons, as in the mockup. The window is frameless. See section 4 for what keeps working |
| 2 | Tabs | In the title bar next to the window buttons (Features 1) | A quiet 32 px strip along the bottom of the editor pane. The toolbar holds back and forward, the note name and the new note button instead |
| 3 | Auto-hiding bars | Top and bottom bars hide until the cursor reaches the edge (Features 1, 8) | The toolbar is always visible and there is no bottom bar. Auto-hide is not built. The pin setting is removed |
| 4 | Status bar | Word count, character count, saved state, vault name (Features 1) | Removed from the screen. Where saved state and counts go is decision 5 in section 14 |
| 5 | Accent colours | Two: yellow and sky blue, sky blue by default. The accent marks links, checkboxes, focus rings and the caret (Features 1) | Five: sky, yellow, coral, mint, lilac. Yellow is the default, as the mockup shows. Inside the note nothing follows the accent except callouts (section 3) |
| 6 | Note column | A centred column of comfortable width (Features 2) | The note fills the pane. There is no width cap at any window size. 24 px of room each side by default, set in settings (section 5) |
| 7 | Block handles | Every block has a handle next to the fold arrow, shown on hover (Features 2) | Headings and callouts show no handle. A heading shows only its fold arrow. Other blocks keep a small grip. See section 7 |
| 8 | Dragging a heading | An unfolded heading moves alone, a folded one carries its content (Features 2) | A heading always moves together with its whole section, open or folded. See section 7 |
| 9 | Icon tiles | Notes, Inbox, Tags, and Journal later, four to a row (Features 1) | Six tiles, three to a row: Notes, Inbox, Tags, Search, Archive, Trash. Journal joins later. Archive and Trash wait on decision 4 in section 14 |
| 10 | Vaults | A strip of vault icons at the bottom of the sidebar (Features 1) | One button at the bottom of the sidebar that opens a vault menu |
| 11 | Folder tree toggle | An arrow on each folder (Features 1) | The folder icon is the toggle. Hovering the icon swaps it for a chevron |
| 12 | Note list | A small sort menu (Features 1) | A three-dot menu with the sort and view options in section 4. The sort icon is hidden until switched on |
| 13 | Callouts | A coloured bar and an icon (Features 2) | The exact look in section 6, with the colours taken from the chosen accent |
| 14 | Settings | Theme, accent, motion, pin the bars, background, start with Windows, quick capture (Features 1) | Pin the bars is removed. Note margin is added. See section 10 |
| 15 | Text in the app | No rule | No long dashes anywhere in the app's own text. See section 11 |

## 2. The look in one page

The feel is Apple Notes: calm neutral surfaces, thin dividers, a lot of room around the text. Inter everywhere, one accent at a time, rounded shapes with two radii.

- **Window.** One rounded window, 16 px corners, a one pixel edge line drawn over the border so the corners stay crisp. A 40 px toolbar runs across the top over all three panes.
- **First pane (248 px).** Six icon tiles, a divider, the folder tree, and at the bottom the vault button and the settings gear.
- **Notes pane (320 px).** A header with the pane toggle, the folder name and a three-dot menu. Under it the pinned notes, then the rest. Each row has a title, a date and one line of preview, and a small picture on the right if the note has an image.
- **Editor pane.** The note on a plain page. The date is centred above a large bold title, then the tags in colour, then the body. A three-dot button sits in the top right corner. A tabs strip runs along the bottom.
- **Light and dark.** Both are first-class. In light the toolbar and sidebar are warm greys and the list and editor are white. In dark the panes step down from #323232 to #1E1E1E.
- **Accent.** It colours the app around the note: the active tile and the selected rows. Inside the note it is replaced by a grey.

Screenshots sent with this doc show the look: slash menu open, top of a note, callouts, quote and code, images, colour and highlights, links and files, and a 1000 px wide window. Light and dark where it matters.

## 3. Colour, type and shape

**Build rules**

- The full token list is in the reference doc. These are the values that matter most.

Surfaces and text:

| Token | Light | Dark |
| --- | --- | --- |
| Toolbar | gradient #F4F3F1 to #EEEDEB | gradient #3A3A3A to #323232 |
| First pane | #F5F4F2 | #2B2B2B |
| Notes pane | #FFFFFF | #232323 |
| Editor and tabs strip | #FFFFFF | #1E1E1E |
| Menus and pop-ups | #FFFFFF | #353535 |
| Text | #1D1D1F | #F2F2F2 |
| Second text | #5E5E5E | #A6A6A6 |
| Third text | #6B6B6B | #9C9C9C |
| Hairline | black at 8% | white at 8% |
| Divider | black at 14% | white at 14% |
| Hover | black at 5% | white at 6% |

Accents. Each has a light and a dark value, and a text colour that sits on it:

| Accent | Light | Dark | Text on accent (light, dark) |
| --- | --- | --- | --- |
| Sky | #2F96E0 | #5BB8F2 | #FFFFFF, #062235 |
| Yellow (default) | #FFE066 | #FFE27A | #2A2208, #1D1700 |
| Coral | #E8604C | #FF8A75 | #FFFFFF, #2B1410 |
| Mint | #2FA58A | #52CDAA | #FFFFFF, #06241C |
| Lilac | #8B6FD6 | #B6A0F7 | #FFFFFF, #1D1238 |

- The active tile is a solid accent with the text colour above on it.
- The selected folder row and selected note row are a tint of the accent with normal text. Yellow is the exception: the selected rows are solid yellow with dark text in light, and in dark the folder row is #6A5418 and the note row is #8C6D1C with white text.
- Text greys are held at 4.5:1 on every pane and large text at 3:1, in both themes and on all five accents. Icons and outlines are held at 3:1. Anything new must pass the same.
- The five tag and text colours, light then dark: coral #C15343 / #EE8879, green #2A836F / #63BCA7, blue #2B7BB6 / #63B0E8, lilac #7F66C2 / #A893E0, ochre #9B6B1C / #E2AD54.
- The five highlight colours, light then dark: yellow #FFEB99, green #C8EDD3, blue #C6E1F8, pink #FAD0D8, lilac #E2D7F7. In dark they are translucent versions of the same hues (see the reference doc), with normal text on them. A phrase is either highlighted or coloured, never both, because the coloured inks do not reach 4.5:1 on the fills.
- Fixed colours that do not follow the accent: the blue tick on a done task (#2A8AD8, dark #3391E3), the danger text in menus (#C42B1C, dark #FF8A75), the vault circles (blue #456EB8 and green #2F7A62), and the three window button hovers in section 4.

Inside the note, the accent does not apply:

- Inside the note pane, the accent is replaced by a grey taken from the text colour: dark grey in light, light grey in dark, the same on all five accents. This covers the slash menu highlight, the quote mark and rules, the blockquote bar, bullets and number circles, links and their underlines, table cell focus, the image ring, handles and bar, text selection, the caret and keyboard focus rings, the three-dot menu highlight and the active tab marks.
- Three things keep their own colour on purpose: callouts, tags and the colour set (highlights, coloured text, the five-dot divider, the blue tick, file chips and the error colour).
- Callouts take the accent chosen in settings plus a second ink that depends on it (sky with coral, yellow with sky, coral with sky, mint with coral, lilac with amber). The mix formulas are in the reference doc. Do not simplify them.

Type, space and shape:

- One font, Inter, shipped inside the app. Weights 400, 500 (code header and pill only), 600, 700 and 800 (section headings, quote mark, callout titles and file type tiles only). Code uses Cascadia Code, then Cascadia Mono, then Consolas.
- Type sizes with line heights: 11/16 (labels, with 6% letter spacing, capitals), 13/18, 15/20, 18/30 for note text, 24, 38/48 for the note title. Added for note elements: 32/36, 23/30, 30/38 for the pull quote, 13/22 for code, 15/26 for callout text.
- Space scale: 4, 8, 12, 16, 24, 32, 48, 64. Nothing is off the scale except these set sizes: control height 32, toolbar 40, toolbar control 28, window button 24, tile 44 (48 in a four-column strip), tabs strip 32.
- Radii: 8 and 16, plus fully round for dots and circles. Callouts and the pull quote have square corners. File chips keep their uneven corners.
- Icons: line icons, 2 px stroke, round ends, at 12, 16, 20 and 24 px. All are in the reference doc.
- Focus ring: 2 px in the ink colour, 2 px away, on every button.

**Done when**

- [ ] Light and dark both match the mockup on all panes, with every colour taken from tokens
- [ ] A computed-style check across all five accents finds nothing inside the note pane that moves with the accent except callouts
- [ ] A contrast check passes at 4.5:1 for text (3:1 for large text) and 3:1 for icons and outlines, on all five accents, in both themes

## 4. Window and panes

### Window and toolbar

**Build rules**

- The window is frameless with a 16 px corner radius and a one pixel inner edge line in the divider colour. The window can be dragged by any empty part of the toolbar, and double-click maximises.
- The toolbar is 40 px, always visible, over the three panes. The panes start 16 px under its bottom edge, so the first thing in each pane lines up on one row.
- Left to right. The sidebar toggle (28 px, at 8 px from the left) hides and shows the first pane. Then back and forward (28 px, forward dimmed to 40% when there is nothing ahead, Alt+Left and Alt+Right). In the middle, centred on the window, the note name field. After it, 8 px away, the new note button (compose icon). On the right, the three window buttons.
- Note name field: 24 px tall, 8 px radius, a 6% tint of the text colour (10% on hover), width between 200 px and 360 px at 26% of the window, name in 13 px semibold, centred, cut with an ellipsis if long. No icon.
- Renaming from the field: click the name and it turns into a text box in place, with the name selected and a 2 px ring. Enter or a click elsewhere keeps the new name. Escape cancels. An empty name is refused and the old one stays. Spaces at the ends are trimmed and 60 characters is the limit. Renaming here edits the first line of the note, the same as typing it there (Features 2). The new name shows at once in the toolbar, the selected note row, the note title and the open tab.
- Window buttons: three 24 px circles, 8 px apart, 12 px from the right edge, filled with 8% of the text colour. Hover: minimise turns amber #FFC83D with dark ink #2B1F00, maximise turns green #3CC76A with dark ink #04290F, close turns red #C42B1C with a white icon. Pressed is one shade darker (#E5AE1F, #2AAE55, #A8271A) and the circle shrinks to 92%. The colours are the same in light and dark.
- Because the window is frameless, Antigravity must check and report on Windows 10 and 11: dragging, double-click to maximise, Win+arrow keys, drag to the screen edge to snap, resizing from every edge and corner, and the rounded corners staying crisp when maximised. The snap layouts flyout that appears when hovering a native maximise button will not be there. Antigravity says whether a workaround exists. Nothing else is given up.

**Done when**

- [ ] The toolbar matches the mockup, light and dark, and the name field renames the note as described, including Enter, Escape, empty and long names
- [ ] The three window buttons look and behave as described, and dragging, maximising and snapping work
- [ ] The report lists what happens to the snap layouts flyout

### First pane

**Build rules**

- 248 px wide with a one pixel divider on its right. It can be dragged to a different width and the width is remembered (Features 1). The pane slides shut at Slow (280 ms) from the toolbar toggle or the notes pane toggle. While it is shut its contents are out of the tab order.
- Six tiles in two rows of three: Notes, Inbox, Tags, Search, Archive, Trash. 16 px of room round the grid, 8 px between tiles, each 44 px tall with 16 px corners, a 22 px icon and a faint fill (5% of the text colour in light, 6% in dark). The active tile is solid accent. Hovering a tile that is not active darkens its icon. Pressed shrinks to 96%. Each tile shows its name as a tooltip and Search shows Ctrl+Shift+F.
- Under the tiles, a one pixel divider, then the label FOLDERS (11 px, capitals, third text).
- Folder rows are 32 px tall with 8 px corners. The icon is 20 px, the name 15 px, and the note count sits at the right in 13 px third text. Subfolders are indented 24 px. The selected row uses the selected look in section 3.
- The folder icon is also the expand toggle, but only for a folder that has subfolders. Hovering the icon (not the row) or tabbing to it swaps the icon for a 16 px chevron in the same place, over 180 ms. It points right when the folder is closed and turns down when it is open. Clicking opens or closes the folder, and the closed and open folder icons cross-fade at 180 ms. The click area is 28 by 32 px. Folders with no subfolders never change.
- Tag list: the Tags tile switches the lower part of the pane to tags (Features 1). The tag list is not drawn in the mockup, so build it from the folder row.
- At the bottom: a one pixel line, then the vault button (32 px tall) with a 24 px circle holding the vault's first letter, the vault name in 15 px semibold and an up and down chevron, and the settings gear at the right. The button opens a menu above it that lists the vaults with a check on the open one, and an Add vault item with a plus circle. The menu has the standard menu look below.

**Done when**

- [ ] The pane matches the mockup in both themes, with six tiles in two rows
- [ ] Hovering the icon of a folder with subfolders shows the chevron, clicking opens it, and hovering only the row does nothing
- [ ] The vault menu opens above the button, switches vaults and closes on an outside click

### Notes pane

**Build rules**

- 320 px wide with a one pixel divider on its right.
- The header is 48 px tall, 8 px under the toolbar band. From the left: the pane toggle icon at 24 px from the pane edge, 8 px, then the folder name in 18 px bold. The toggle shows a chevron that points left while the first pane is open and right while it is shut, and it opens and shuts the same pane as the toolbar toggle. The three-dot menu button (horizontal dots) is at the right.
- A sort icon sits next to the dots. It is hidden until Show sort icon is switched on.
- Group labels (PINNED with a small pin, then NOTES) are 11 px capitals in third text. The first group has 8 px above it and later groups 16 px.
- Rows have 12 px above and below and 16 px at the sides, 8 px corners, 4 px between rows. Three lines: the title in 15 px semibold, the date in 13 px third text, one line of preview in 13 px second text. The row is 80 px tall.
- A note with an image shows its first image at the right end of the row as a 48 px square with 8 px corners and a hairline edge, 12 px from the text. The text is narrower on those rows.
- The selected row uses the selected look in section 3. Hover is the flat hover tint.
- The notes pane three-dot menu is 248 px wide with these items: Sort by (with a chevron, showing Manual), Show sort icon, Show previews, Show dates, Show images, then a divider, then New folder and Select notes. The four Show items are checkable. Switching one off hides that part in every row at once. These choices are remembered between sessions.
- The list is virtualised and loads a page at a time (Features 1). Nothing in this section changes that.

**Done when**

- [ ] The pane matches the mockup in both themes
- [ ] The four Show switches hide and show their part in every row, and the choice is kept after a restart
- [ ] A note with an image shows its thumbnail, and a note without one does not leave a gap

### Editor pane and tabs strip

**Build rules**

- The editor pane takes the rest of the window. The note scrolls inside it. The note column is described in section 5 and the elements in section 6.
- The three-dot menu button (horizontal dots, 32 px) sits in the top right corner, 16 px from the right edge and 16 px under the toolbar. It has the page colour behind it so text that scrolls under it is hidden. A word can look cut off next to the dots, and that is the mask.
- Its menu is 272 px wide, ten items in four groups. Pin note or Unpin note, Duplicate, Move to folder. Find in note (Ctrl+F), Pop out. Share, Export as (with a chevron), Show in File Explorer. Archive, then Delete note in the danger colour. Share, Export as, Move to folder and Archive depend on decision 4 in section 14. Leave a menu item out until its decision is made.
- The tabs strip is 32 px tall along the bottom of the pane, the page colour, with a hairline above it. Tabs are 24 px tall with 8 px corners, 13 px third text, at most 200 px wide, with 12 px of room at the sides. The open tab has a 6% tint, normal text colour and a small close mark. A plus button at the end opens a new tab. The note scrolls above the strip. Tab behaviour comes from Features 1 and 8.

**Done when**

- [ ] The three-dot button, menu and tabs strip match the mockup in both themes
- [ ] The menu opens under the dots, lines up with the button's right edge and closes on an outside click

### Menus

**Build rules**

- One menu look for the vault menu, both three-dot menus and every right-click menu: 16 px corners, 8 px padding, the menu surface colour, a one pixel ring and the soft shadow from the reference doc.
- Items are 32 px tall with 8 px corners and 8 px of room at the sides. Icon, then 12 px, then the name in 15 px. Shortcut hints and chevrons sit at the right in 13 px second text. Hover is the flat tint. Checkable items show a 16 px check at the left or right as the mockup does. Danger items use the danger colour on text and icon. A divider is a one pixel line with 8 px round it.
- Only one menu is open at a time. A click outside closes it. Choosing an item closes it at once.
- A menu opens from the point it was opened from with the motion in section 9.

### When the window gets narrow

**Build rules**

- The first pane (248 px) and the notes pane (320 px) keep their widths. They do not shrink or hide by themselves. Dragging a divider changes them within the limits Antigravity proposes (section 13).
- The note column follows the editor pane (section 5). With both panes open the note reaches its 360 px floor at a window width of 976 px. Below that the pane scrolls sideways.
- The format toolbar over selected text stays inside the pane at any width.

## 5. The note column and the margin setting

The note fills the editor pane with a margin on each side, as Apple Notes does. There is no cap.

**Build rules**

- Width of the text: the pane width minus the margin on each side, never narrower than 360 px. There is no widest width. On a very wide window the text runs wide.
- Margin: 24 px each side by default. It is measured from the Apple Notes window, where it is about 26 px, and 24 is the nearest value on the space scale.
- Below 360 px of pane the text holds its 360 px width and the pane scrolls sideways. A thin bar appears at the bottom of the pane. Nothing is cut off.
- It follows free space as well as the window: hiding the first pane widens the note by 248 px.
- Padding of the column: 88 px above the first line (the 40 px toolbar plus 48), 64 px below the last.
- The width changes by the pane's real width, with no animation while the window is resized (Features 8). Hiding or showing a pane glides the text to its new place and the text takes its final width at the start, so it never re-wraps during the move.
- The margin is a setting, and the user can make it bigger or smaller (section 10). Range 16 to 96 px in steps of 4, default 24, applied at once with a live preview in the open note. The same value is used on both sides. The 360 px floor holds at every value.
- The heading fold arrow and the grab strip sit in the margin (section 7). They are 24 px wide at the default margin. At a smaller margin they shrink to the margin's width, and the arrow stays 16 px so it always fits.

**Done when**

- [ ] The text width follows the pane from 1440 px down to the floor, and matches the mockup at 1440, 1300, 1200, 1100 and 976 px with both panes open (824, 684, 584, 484 and 360 px of text)
- [ ] There is no width cap at 2560 px
- [ ] Hiding the first pane widens the text, and showing it again narrows it, without a jump
- [ ] Changing the margin in settings changes the open note at once, and the floor holds at every value
- [ ] Nothing in the note is cut off at any margin from 16 to 96 px

## 6. Rich text elements

Every element below is a TipTap node or mark. The look is in the reference doc. The markdown that goes to disk follows Features 2 and 5 and must not change.

**Build rules**

- Elements are listed in the order they appear in the Weekly plan note in the mockup, so the screenshots can be matched one by one.
- A note keeps its own style when saved and anything Wrriter does not understand is kept as written (Features 2, Keeping existing notes intact). Looks never change what is on disk.

| Element | TipTap | The look |
| --- | --- | --- |
| Date line | Not part of the note | Centred 13 px third text, 16 px above the title. Shows the note's modified date and time, for example 17 October 2026 at 08:12 |
| Title | First line of the note, heading 1 look | 38/48 bold, 3% tighter letters, 8 px below |
| Tags | Properties line, from the tags key (Features 4) | Plain bold text in the five tag colours, 15/20, 24 px tall, 8 px of room each side, a soft tint on hover. Which colour a tag gets is decision 3 in section 14 |
| Paragraph | Paragraph | 18/30, 12 px below, balanced line ends |
| Heading 2 | Heading 2 | 32/36, weight 800, 4% tighter letters, a one pixel rule in the text colour above it, 16 px of room between the rule and the text, 48 px above the rule and 16 px below the text |
| Heading 3 | Heading 3 | 23/30 bold, 2.5% tighter letters, 32 px above and 8 px below |
| Heading 4 to 6 | Heading 4 to 6 | 18, then 15 in second text, then 13 in third text. The mockup does not draw them, so line height and weight are in section 13 |
| Bold, italic | Bold, Italic | Bold is 700. Italic is the normal italic of Inter |
| Strikethrough | Strike | The text turns second text colour and the line is third text colour |
| Inline code | Code | Monospace at 86% of the text size, 3 px above and below and 8 px at the sides, 8 px corners, 6% fill (10% in dark) |
| Highlight | A mark with five colours | Padding 1 px and 4 px, 4 px corners, one of the five highlight colours. Storage is decision 1 in section 14 |
| Coloured text | A text colour mark with five colours | The five tag colours. Storage is decision 1 in section 14 |
| Note link | Wikilink | A soft pill, fully round, 9 px at the sides, 94% size, semibold, fill is the soft grey of the note pane |
| Web link | Link | Bold text with a globe icon in front (16 px, 4 px gap, outside the underline) and a 4 px underline in the grey, 3 px below the text |
| Bullet list | Bullet list | An 8 px round dot in the text colour, 12 px gap, 4 px between items, 18/30 text |
| Numbered list | Ordered list | A 24 px round badge with a soft grey fill and the number in 13 px bold. A nested level indents 36 px, uses a 20 px badge with 11 px numbers, and starts again at 1 |
| Task list | Task list | A 24 px round check with a 2 px third text border. Done: filled blue with a white 13 px tick, the text in third text with a line through it |
| Divider | Horizontal rule | Five round dots, 8 px, 20 px apart, in coral, amber, mint, sky and lilac, 32 px above and below, centred |
| Table | Table | 8 px corners with a one pixel divider outline, a header row with a 5% fill and 13 px second text semibold, 12 px by 16 px cell padding, hairlines between rows, the first column semibold, number columns right aligned with tabular figures. The focused cell has a 2 px grey outline |
| Pull quote | See decision 2 | A 3 px rule above in the text colour and a one pixel rule below, 24 px of room inside, a large quote mark (118 px, weight 800) in an 80 px column at the left, the text in 30/38 bold with 3.4% tighter letters. The mark is the text colour in light and second text in dark |
| Blockquote | Blockquote | A 3 px bar at the left in the grey, 16 px indent, 18/30 text in second text. A quote inside a quote is in third text with its own bar |
| Callout | Callout (Features 2) | Section below |
| Code block | Code block | A tile with 8 px corners and a 5% fill. A 36 px header with the language in 13 px third text at weight 500, and for Dataview blocks a small outlined Not run pill (20 px tall, 6 px corners). The code is 13/22 monospace, keywords bold, nothing coloured. 16 px of room at the sides and below |
| File chip | A link to a file (Features 5) | A ticket shape: 56 px tall, a notch each side, a slight tilt (-1.2, 0.9 and -0.5 degrees in turn), a coloured 36 by 38 type tile (PDF red, spreadsheet green, document blue) with the type in 11 px weight 800, the name in 13 px bold and the size in 11 px second text. A missing file is a dashed outline in coral with the text File not found: name |
| Image | Image (Features 2) | Left, centre or right on its own line, 16:10 in the mockup, 8 px corners, a hairline edge. 48 px above it for its bar and 24 px below |
| Selected image | Same | A 2 px grey ring, four 12 px square handles on the corners (white with a 1.5 px grey border) and a bar above with Align left, Centre, Align right and Remove. Selecting never moves the text |
| Placeholder | Placeholder | The third text colour. An empty last line says Type / for commands |
| Selected text | Selection | A 16% tint of the text colour. The caret is the text colour |

Callouts:

- A flat block with square corners, 16 px between it and its neighbours. Padding is 12 px above, 16 px at the right and below and 24 px at the left. A 6 px solid bar at the left in the callout colour.
- The header is a row at least 28 px tall: a 16 px icon at 2.4 stroke, 8 px, then the title in 15/20 weight 800. At the right end, a fold button of 26 px with the callout colour at 22% behind it and a chevron at 2.6 stroke. The body is 15/26 text starting 1 px under the header.
- Types and colours. Info: first ink bar, 15% first ink fill, icon in the deep first ink. Tip and warning: second ink bar, 15% second ink fill, icon in the deep second ink. Danger: a mix of the two for the bar, a fill of the second ink with a little of the first, icon in the text colour. A callout with no type, a Note, or a type Wrriter does not know has the grey look: a bar at 62% of the text colour, a 7% fill, icon in second text. In dark the colour fills are 17% instead of 15%, the grey fill is 9%, and the inks are used at full strength. The exact mixes are in the reference doc.
- Icons: info is a circle with an i (also used for Note), tip a lightbulb, warning a triangle with an exclamation mark, danger an octagon with an exclamation mark.
- A folded callout loses the 4 px of extra room below its header. Folding follows section 9.

**Done when**

- [ ] The Weekly plan note, rebuilt in the app with the same words, matches the mockup screenshots element by element in light and dark on all five accents
- [ ] Each element survives open, edit and save with the markdown on disk unchanged (the sample-note test in Features 2)
- [ ] All callout types render, and an unknown type keeps its name when saved

## 7. Block handles, folding and drag and drop

The aim is that dragging blocks that fold is easy, with no handle drawn for them.

**Build rules**

- Which blocks fold: headings 1 to 6 and callouts. These are the blocks with a toggle. Every other block is an ordinary block.
- Headings. A 16 px fold arrow sits in the left margin, centred on the first line of the heading. It fades in on hover at Fast and while the caret is in the heading. It stays visible while the heading is folded, so a folded section is never hidden without a sign. It points right when folded and down when open. A heading shows no grip and no other handle, ever. Clicking the arrow folds or unfolds (Features 2).
- The arrow is also the drag handle. A press and drag of more than 4 px on the arrow starts a drag. A click without drag is a fold. The pointer becomes a grab hand over the arrow. No second icon is drawn.
- Callouts. The fold chevron stays at the right end of the header, where the mockup has it. The callout shows no grip. The icon in its header and the 6 px bar at the left are the grab areas, and the 24 px strip in the margin next to the callout is invisible and grabs too. The pointer becomes a grab hand over each. A click on the icon opens the type dropdown (Features 2), and a press and drag of more than 4 px starts a drag.
- Other blocks (paragraphs, lists, images, tables, code, quotes) show a 24 px grip in the left margin, six round dots in third text, fading in on hover at Fast. Dragging the grip moves the block (Features 2). The grip is as drawn in the reference doc.
- When a drag starts on a heading or callout that is open, it folds to a single row for the drag, so you carry one small row. It opens again where it lands.
- A heading always moves with its whole section: everything under it up to the next heading of the same or a higher level, sub-headings included. This is the same whether the heading is open or folded. This replaces the Features 2 rule that an unfolded heading moves alone. Alt+Up and Alt+Down on a heading move the section the same way.
- During a drag: a faint copy of the block follows the pointer and the block lifts slightly with a soft shadow. A thin drop line in the grey shows where it will land and slides between positions at Fast. The note scrolls by itself when the pointer is near the top or bottom edge (Antigravity tunes the speed and reports it). Escape cancels and the block glides back. Dropping settles the block at Base.
- One Ctrl+Z puts the whole move back at once, with no animation (Features 2, 8). A move changes only the moved block's position and the file is otherwise saved exactly as it was.
- Keyboard: Alt+Up and Alt+Down move the block under the caret (Features 2). Drag is never the only way.
- Discoverability: the pointer changes on hover. The first time the pointer rests on a fold arrow or a callout grab area, a tooltip says Drag to move, then it never shows again (kept in app settings). The settings window has a read-only list of keyboard shortcuts that includes the move shortcut (section 10).
- Folding stays only a view (Features 2). A note always opens fully expanded and fold state is never written to disk. Fold all and unfold all are palette commands.
- With reduced motion the fold-for-drag and the glide back become instant.
- Cross-note dragging is not part of version 1.

**Done when**

- [ ] A heading, with the grip never drawn, can be dragged by its arrow and carries its whole section, open or folded
- [ ] A click on the arrow folds, and a drag from the same spot moves, without one triggering the other
- [ ] A callout can be dragged by its icon, bar or margin strip, and a click on the icon still opens the type dropdown
- [ ] An open heading folds during the drag and opens where it lands, and Escape puts everything back
- [ ] Alt+Up and Alt+Down move a heading with its section and a callout and a paragraph as single blocks
- [ ] One Ctrl+Z undoes a move, and the saved file differs from the original only in the moved block's position
- [ ] The tooltip Drag to move shows once and then never again

## 8. Slash menu and floating toolbar

**Build rules**

- Slash menu. Typing a slash alone on an empty line opens a menu directly under the line, 344 px wide and lined up with the text column. If there is no room below it opens above. A slash in the middle of a sentence does nothing.
- Twelve items in four groups, each with a drawn icon on a 36 px tile, a name, a one-line description and the markdown shortcut at the right where there is one. Text: Heading (#), Subheading (##), Quote (>). Lists: Bullet list (-), Numbered list (1.), Task list ([]). Blocks: Table, Code block (```), Callout, Warning, Divider (---). Media: Image.
- The list shows about eight rows and the next one is cut off to show there is more. A footer line reminds of the keys. A group title disappears when none of its items match.
- Typing filters by name and related words (head finds Heading and Subheading, todo finds Task list). Nothing matching says Nothing matches that, and Enter makes a normal new line.
- Keys: up and down move the highlight and wrap, Enter or Tab insert, Escape closes, left, right, Home and End close it, a click anywhere else closes it. Hovering moves the highlight and clicking inserts.
- The highlighted row has a grey fill with a grey outline. Its description and shortcut switch to the text colour. Group titles are second text.
- An inserted block is empty, in the same look as the elements in the note, with a grey placeholder (Heading, List item, To-do, Column, Write code, Write a note). The caret goes inside it. For Divider and Image it goes on the line after. Enter in a list adds an item, and Enter on an empty item or Backspace leaves the list. In a table Enter moves to the next cell and adds a row at the last. In a code block or callout Enter makes a new line inside it. Enter in a heading starts a normal line under it. Image opens the file picker.
- Floating format toolbar. Selecting text shows a pill above it, centred, 12 px above the selection: 16 px corners, a 4 px padding, the menu surface colour with a hairline and the soft shadow. In order: Text with a down arrow (block type), a list control with a down arrow, a divider, Bold, Italic, Strikethrough, Link, another divider, More. Buttons are 32 px with 8 px corners. It fades in at Fast and out when the selection clears. It never slides to follow the selection and it stays inside the pane.
- Every item in both is also a command in the palette (Features 2).

**Done when**

- [ ] The slash menu matches the mockup in both themes, with filtering, wrapping keys, the no-match state and flipping above near the bottom
- [ ] All twelve items insert the block described, with its placeholder and the caret in the right place
- [ ] The floating toolbar matches the mockup, and clicking elsewhere hides it

## 9. Motion

Features 8 holds the rules and stays in force: calm and precise, nothing bounces, typing never delayed, nothing longer than 300 ms, everything interruptible, only transform and opacity animate. These are the animations the mockup shows, with their exact values. They are all built from the four speeds and three curves in Features 8 (Fast 100 ms, Base 180 ms, Slow 280 ms, and the Arrive, Move and Leave curves).

**Build rules**

- Hover and press on anything clickable: the flat hover tint and the box shadow change at Fast on the Move curve. A tile, a tag, a tab, a tab strip button and a window button also change colour at Fast.
- Pressing: a tile shrinks to 96%, a tag to 97% and a window button to 92% at Fast.
- Sidebar toggle: the first pane slides shut and open by width at Slow on the Move curve, and its right border goes with it. The toolbar's left edge moves with the pane at Slow in the layouts where it follows it.
- Folder icon and chevron: the closed and open folder icons cross-fade at Base and scale between 86% and 100%. On hover the folder icon fades out and shrinks to 80% while the chevron fades in from 80% to 100%, at Base. The chevron turns 90 degrees when the folder opens, at Base.
- Menus (vault, notes pane and editor three-dot, slash menu, right-click): fade in from 0 while moving 4 px toward their place and growing from 96% to 100%, at Fast on the Arrive curve, from the point they were opened from. They close at once when an item is chosen.
- Rename field: the tint changes at Fast and the ring appears at once.
- Heading and callout folds: the section's height collapses while the content fades at Base, and the arrow turns at Fast (Features 8). If this cannot be done without risking the note, fold at once and tell Krishna.
- Drag and drop: lift, drop line, settle and glide back as in section 7.
- The tick of a task draws at Fast. The task circle fills at Fast.
- The caret glide, the selection fade and the new letter fade are as in Features 8.
- The find bar, command palette, quick switcher, dialogs, notices and tooltips are not in the mockup. Build them with the motion rules in Features 8.
- With reduced motion (Windows setting or the Motion setting), transitions become instant and menus appear without moving. State changes still show.
- A theme change is a cross-fade of the whole window at Slow (Features 8).

**Done when**

- [ ] Each animation above uses only values from the token list
- [ ] With slow motion on, each one can be judged against the mockup
- [ ] With reduced motion on, nothing slides or scales and every feature still works

## 10. Settings

**Build rules**

- Settings open from the gear at the bottom of the first pane, Ctrl+comma and the palette (Features 1).
- Added: Note margin. A slider from 16 to 96 px in steps of 4 with the value shown, default 24, a Reset button, and a live preview in the open note. Applies at once.
- Added: a read-only list of keyboard shortcuts, taken from the one list in code (Features 1).
- Kept: Theme (Follow Windows by default, Light, Dark), Accent (five), Motion (Follow Windows, Reduced, Full), keep running in the background, start with Windows, quick capture options.
- Removed: Pin the top and bottom bars.
- Choices made in the notes pane menu (sort icon, previews, dates, images) are remembered in app settings, and so is the fact that the Drag to move tooltip has been shown.
- Settings are stored in the app's data folder and not in any vault (Features 1).
- The settings window is not drawn in the mockup. Build it from section 13.

**Done when**

- [ ] The margin slider changes the note at once and the value survives a restart
- [ ] Pin the bars is gone and nothing else in settings has moved
- [ ] The shortcut list shows every shortcut in the code list

## 11. Wording and dashes

**Build rules**

- No long dashes (em or en) in any text the app shows: menus, tooltips, buttons, empty states, notices, settings, the installer, the README, release notes and error messages. Use a plain hyphen where a dash is needed, or rewrite the sentence.
- This does not apply to what a user types or pastes into a note. A note is never changed.
- Wording style: sentence case, plain verbs, no filler. A button says what it does and keeps the same name through the flow. An error says what went wrong and what to do about it, and does not apologise.
- A build check fails if a string in the app's own text contains a long dash.

**Done when**

- [ ] The check finds no long dash in the app's own text, and a note containing one is left untouched

## 12. Mockup-only items, not built

These are switches in the mockup's settings panel on the canvas. They preview states and options and are not app features.

- View jump, slashMenu, listMenu, noteMenu, vaultMenu, sortIcon, rename: they open menus or scroll the sample note so a state can be seen.
- windowWidth, noteMin, noteMax: they preview window widths and column limits. The real app has no width cap and a fixed floor of 360 px.
- strip (three per row or four in a row): build three per row.
- toolbar (full width, note list to editor, bottom of editor) and fill (current color or glass): build the full width toolbar with the current colour. The other positions and the glass fill were experiments and are not built unless Krishna asks.
- The sample content: the Weekly plan note, the other notes, the folders, the vault names P and W, the hill pictures and the dates.
- The first pane only and no panes boards, the Quick capture board and the layout elements board are older or parked. They show states (first pane hidden, both hidden) but not the current styling. The three pane Editor view is the visual truth. Hiding rules come from Features 1: the toolbar toggle hides the first pane, and Ctrl+backslash hides both panes.
- Columns, layout elements and the unnamed fourth element are parked for later versions. Flexible images stays planned.
- Features the mockup draws but does not make work: Share, Export as, Select notes, Sort by. See section 14.

## 13. Not drawn in the mockup

Build these from the same tokens, icons, menu look and motion, so they look like part of the same app. Show each to Krishna when it is done.

**Build rules**

- Find and replace bar (Features 2), command palette and quick switcher (Features 1, 4), the settings window, dialogs such as delete folder, notices and the error and conflict messages, tooltips, right-click menus for notes, folders, tabs, vaults and file chips, the Tags list in the first pane, the Search and Inbox views, the first-run screen with its two vault buttons, empty states, the quick capture and pop-out windows (Features 3), and the file picker for images.
- Use the menu look for anything that pops up, the 32 px row for lists, the 8 and 16 px radii, and the speeds in section 9.
- Heading 4, 5 and 6: sizes are 18, 15 and 13 and colours are text, second text and third text. Antigravity proposes the line heights and weights on the heading scale and shows them to Krishna.
- Pane widths: Antigravity proposes the smallest and largest width each pane can be dragged to, and the smallest window size, and shows them to Krishna. Defaults are 248 px, 320 px and a window of 1440 x 900.
- Colours in these screens must pass the same contrast checks as the rest (section 3).

## 14. Decisions waiting for Krishna

Each has my recommendation. Antigravity does not build the part it affects until Krishna answers. Say the number and yes to take the recommendation.

| # | Question | Recommendation | Affects |
| --- | --- | --- | --- |
| 1 | How are the five highlight colours and the five text colours written in the markdown file? Features 2 has no form for them, and `==text==` is kept as written | Write `<mark class="wr-m2">text</mark>` and `<span class="wr-c3">text</span>` (the number is the colour). Other apps show the text, and `<mark>` shows as a yellow highlight there. The alternative is to leave both out of version 1 | Highlight and coloured text in section 6, the sample-note test |
| 2 | The mockup has two quotes, a styled pull quote and a plain blockquote. A plain `>` can only be one of them | `>` is the blockquote. The pull quote is a callout of type quote, written `> [!quote]`, which other apps already show as a quote callout | Pull quote and blockquote |
| 3 | How does a tag get its colour (one of five)? | From the tag name, the same name always the same colour on every device. Nothing is stored. The alternative is a colour the user picks per tag | Tags row |
| 4 | What do the Archive and Trash tiles do, and which of Share, Export as, Move to folder and Select notes are in version 1? Delete goes to the Windows Recycle Bin today (Features 4) | Archive moves the note into a folder called Archive at the vault root, and the tile lists it. The Trash tile is dropped, since the Windows Recycle Bin already holds deleted notes, so the strip is five tiles and the sixth place stays free for Journal. Move to folder and Select notes are in version 1. Share and Export as are left out until a later version | Icon tiles, editor menu, notes pane menu |
| 5 | Where do the saved state and the word count live now that the bottom bar is gone? | At the right end of the tabs strip in 13 px third text: Saved or Saving, then the word count, for example 412 words. The character count shows in the word count's tooltip | Tabs strip |

## 15. Build order

The Features 7 milestones stay as they are. Within them, the UI is built in slices, each shown to Krishna against the screenshots before the next starts. Antigravity includes the slices in the milestone list it sends Krishna to approve (Features 7).

**Build rules**

1. Tokens and shell (M1). The token list and the build checks, the frameless rounded window with the toolbar, the window buttons, and the motion foundations.
2. Panes (M1 and M2). The first pane, the notes pane and the editor pane with the tabs strip, light and dark, all five accents.
3. The note (M2). The column and the margin setting, then the elements in section 6 in the order they are listed, a few at a time.
4. Menus and the slash menu (M2). The menu look, the three-dot menus, the vault menu, the slash menu and the floating toolbar.
5. Handles, folding and dragging (M2). Section 7, with the sample-note test running.
6. Things the mockup does not draw (M2 to M5). Section 13, as each feature arrives.
7. Motion polish (M5). Every animation reviewed with the slow-motion switch on (Features 8).

**Done when**

- [ ] Each slice is shown to Krishna beside the mockup screenshots before the next starts
- [ ] No slice is started while a decision it depends on is open in section 14

## Calls made in this doc

Where Krishna had not given a specific answer, I made the call. Tell me the number if you want one changed.

| # | Call | Source |
| --- | --- | --- |
| 1 | No long dashes in the app's own text, plain hyphens instead | Your answer: left to me |
| 2 | A heading shows only its fold arrow, never a grip | Your answer |
| 3 | No width cap on the note at any window size | Your answer |
| 4 | Note margin is a setting, 16 to 96 px, default 24, steps of 4. The lower end is 16 because the fold arrow is 16 px wide | Your request. Range is my call |
| 5 | Drag by the fold arrow, by the callout icon, bar or margin strip, with the block folding during the drag, a drop line, auto-scroll, Escape to cancel and a Drag to move tooltip shown once | Your go-ahead on my proposal |
| 6 | The move shortcut is Alt+Up and Alt+Down, the one already in Features 2 | My call |
| 7 | A heading drag always carries its whole section, open or folded | My call. It replaces the Features 2 rule |
| 8 | The fold arrow stays visible while a heading is folded | My call |
| 9 | Yellow is the default accent, as the mockup shows. Features 1 said sky blue | My call |
| 10 | The date line shows the modified date and time | My call |
| 11 | Only the full width toolbar with the current colour is built | My call |
| 12 | Window buttons are drawn by Wrriter and the window is frameless, as in the mockup | Your mockup. Features 1 said native |
